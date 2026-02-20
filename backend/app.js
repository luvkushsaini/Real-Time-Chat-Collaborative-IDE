import express from 'express';
import morgan from 'morgan';
import connect from './db/db.js';
import userRoutes from './routes/user.routes.js';
import projectRoutes from './routes/project.routes.js';
import aiRoutes from './routes/ai.routes.js';
import collaborationRoutes from './routes/collaboration.routes.js';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import CustomError from './utils/CustomError.js';
import globalErrorHandler from './middleware/error.middleware.js';
connect();


const app = express();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use('/users', userRoutes);
app.use('/projects', projectRoutes);
app.use("/ai", aiRoutes)
app.use("/collaboration", collaborationRoutes)



app.get('/', (req, res) => {
    res.send('Hello World!');
});

// 404 Handler
app.all('*', (req, res, next) => {
    next(new CustomError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// Global Error Handler
app.use(globalErrorHandler);

export default app;
