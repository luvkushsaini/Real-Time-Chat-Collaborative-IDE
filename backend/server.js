import 'dotenv/config';
import http from 'http';
import app from './app.js';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import projectModel from './models/project.model.js';
import { generateResult } from './services/ai.service.js';

// Environment Variable Validation
const requiredEnvVars = ['JWT_SECRET', 'GOOGLE_AI_KEY', 'MONGODB_URI'];
requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
        console.warn(`\x1b[33mWarning: Environment variable ${envVar} is not defined. The app may not function correctly.\x1b[0m`);
    }
});

const port = process.env.PORT || 3000;



const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*'
    }
});


io.use(async (socket, next) => {

    try {

        const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.split(' ')[1];
        const projectId = socket.handshake.query.projectId;

        if (!mongoose.Types.ObjectId.isValid(projectId)) {
            return next(new Error('Invalid projectId'));
        }


        socket.project = await projectModel.findById(projectId);

        if (!socket.project) {
            return next(new Error('Project not found'));
        }


        if (!token) {
            return next(new Error('Authentication error'))
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded) {
            return next(new Error('Authentication error'))
        }


        socket.user = decoded;

        next();

    } catch (error) {
        next(error)
    }

})


io.on('connection', socket => {
    socket.roomId = socket.project._id.toString()


    console.log('a user connected');

    socket.on("join-project", ({ projectId, email, username }) => {
        socket.data.userEmail = email;
        socket.data.username = username;
        socket.join(projectId);
        socket.to(projectId).emit("collaborator-joined", { username, sender: email });
    });

    socket.on('project-message', async data => {

        const message = data.message;
        const aiIsPresentInMessage = message.includes('@ai');

        socket.broadcast.to(socket.roomId).emit('project-message', data)

        if (aiIsPresentInMessage) {
            const prompt = message.replace('@ai', '').trim();

            try {
                const result = await generateResult(prompt);
                let aiResponse;

                try {
                    aiResponse = JSON.parse(result);
                } catch (e) {
                    // Fallback if not valid JSON
                    aiResponse = { text: result };
                }

                // 1. Send the text message to everyone in the room
                io.to(socket.roomId).emit('project-message', {
                    message: aiResponse.text || "I've processed your request.",
                    sender: {
                        _id: 'ai',
                        email: 'Gemini AI'
                    },
                    timestamp: new Date().toISOString()
                });

                // 2. If the AI suggests file changes, broadcast them and save to DB
                if (aiResponse.fileTree) {
                    // Broadcast update to all clients in the room
                    io.to(socket.roomId).emit('project-update', {
                        fileTree: aiResponse.fileTree,
                        sender: { _id: 'ai', email: 'Gemini AI' }
                    });

                    // Persist to database
                    import('./services/project.service.js').then(projectService => {
                        projectService.updateFileTree({
                            projectId: socket.project._id.toString(),
                            fileTree: { ...socket.project.fileTree, ...aiResponse.fileTree }
                        }).catch(err => console.error("Failed to persist AI changes:", err));
                    });
                }

                // 3. Handle build/start commands if needed (could be sent as a separate message or log)
                if (aiResponse.buildCommand || aiResponse.startCommand) {
                    io.to(socket.roomId).emit('project-message', {
                        message: `Suggested commands:\n${aiResponse.buildCommand ? `Build: ${aiResponse.buildCommand.mainItem} ${aiResponse.buildCommand.commands.join(' ')}\n` : ''}${aiResponse.startCommand ? `Start: ${aiResponse.startCommand.mainItem} ${aiResponse.startCommand.commands.join(' ')}` : ''}`,
                        sender: { _id: 'ai', email: 'Gemini AI' },
                        timestamp: new Date().toISOString()
                    });
                }

            } catch (error) {
                console.error("Gemini AI Error:", error);
                io.to(socket.roomId).emit('project-message', {
                    message: "I encountered an error while processing your request. Please check my API key configuration.",
                    sender: { _id: 'ai', email: 'Gemini AI' },
                    timestamp: new Date().toISOString()
                });
            }
            return;
        }
    })

    socket.on('project-update', data => {
        socket.broadcast.to(socket.roomId).emit('project-update', data)
    })

    socket.on('typing', ({ projectId, sender }) => {
        socket.to(projectId).emit('typing', { sender });
    });

    socket.on('stop-typing', ({ projectId, sender }) => {
        socket.to(projectId).emit('stop-typing', { sender });
    });

    socket.on("leave-project", ({ projectId, sender, username }) => {
        // Notify everyone else in the room
        socket.in(projectId).emit("collaborator-left", { sender, username });
        // Remove from room
        socket.leave(projectId);
    });

    // Also handle on disconnect (tab close / crash)
    socket.on("disconnecting", () => {
        const rooms = [...socket.rooms];
        rooms.forEach(room => {
            if (room !== socket.id) {
                socket.in(room).emit("collaborator-left", {
                    sender: socket.data.userEmail, // set this on socket.data when user joins
                    username: socket.data.username
                });
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
});




server.listen(port, () => {
    console.log(`Server is running on port ${port}`);
})