// REMINDER: Add VITE_GEMINI_API_KEY=your_key to frontend/.env
import React, { useState, useEffect, useContext, useRef } from 'react';
import { UserContext } from '../context/user.context';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { getWebContainer } from '../config/webContainer';

// --- Syntax Highlighting Component ---
function SyntaxHighlightedCode(props) {
    const ref = useRef(null);
    useEffect(() => {
        if (ref.current && props.className?.includes('lang-')) {
            hljs.highlightElement(ref.current);
            ref.current.removeAttribute('data-highlighted');
        }
    }, [props.className, props.children]);
    return <code {...props} ref={ref} className={`${props.className} rounded p-1`} />;
}

// --- Gemini AI Function ---
async function askGemini(prompt, code = "") {
    const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    if (!API_KEY) throw new Error("Missing Gemini API Key");

    const body = {
        contents: [
            {
                parts: [
                    {
                        text: `You are an expert coding assistant embedded in a collaborative IDE. Be concise, professional, and helpful.\n\nCurrent code context:\n\`\`\`\n${code}\n\`\`\`\n\nUser: ${prompt}`,
                    },
                ],
            },
        ],
    };

    const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${API_KEY}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }
    );

    if (!res.ok) throw new Error("Gemini API Error");
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini.";
}

const Project = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user } = useContext(UserContext);

    // --- State Management ---
    const [project, setProject] = useState(location.state?.project || {});
    const [activePanel, setActivePanel] = useState('CHAT'); // CHAT, AI, TEAM
    const [messages, setMessages] = useState([]);
    const [message, setMessage] = useState('');
    const [fileTree, setFileTree] = useState(project.fileTree || {});
    const [currentFile, setCurrentFile] = useState(null);
    const [openFiles, setOpenFiles] = useState([]);
    const [webContainer, setWebContainer] = useState(null);
    const [iframeUrl, setIframeUrl] = useState(null);
    const [terminalOutput, setTerminalOutput] = useState('');
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiMessages, setAiMessages] = useState([
        { role: 'ai', text: 'Hi! I\'m your **Gemini AI assistant**. Ask me anything about your code, debugging, or best practices!' }
    ]);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [fileName, setFileName] = useState('');
    const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');

    const [typingUsers, setTypingUsers] = useState([]);
    const typingTimeoutRef = useRef(null);

    // --- File Context Menu & Modals ---
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, file: null });
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // --- Resizing Logic ---
    const [leftWidth, setLeftWidth] = useState(300);
    const [explorerWidth, setExplorerWidth] = useState(220);
    const isResizingLeft = useRef(false);
    const isResizingExplorer = useRef(false);

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (isResizingLeft.current) {
                const newWidth = Math.max(200, Math.min(600, e.clientX));
                setLeftWidth(newWidth);
            } else if (isResizingExplorer.current) {
                const newWidth = Math.max(150, Math.min(400, e.clientX - leftWidth));
                setExplorerWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            isResizingLeft.current = false;
            isResizingExplorer.current = false;
            document.body.style.cursor = 'default';
            document.body.classList.remove('select-none');
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [leftWidth]);

    const messageBoxRef = useRef(null);
    const aiEndRef = useRef(null);
    const saveTimeout = useRef(null);

    // --- Tab Colors ---
    const getTabStyle = (tab) => {
        const isActive = activePanel === tab;
        return `px-3 py-1 text-[11px] font-semibold tracking-wider rounded-md transition-all duration-200 uppercase whitespace-nowrap
                ${isActive ? 'bg-bg-tertiary text-text-primary border-l-2 border-accent' : 'text-text-secondary hover:text-text-primary hover:bg-bg-secondary'}`;
    };

    // --- Initialization & Sockets ---
    useEffect(() => {
        if (!project?._id) {
            navigate('/');
            return;
        }

        const socketInstance = initializeSocket(project._id);

        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container);
                console.log("WebContainer initialized");
            });
        }

        receiveMessage('project-message', data => {
            setMessages(prev => [...prev, data]);
        });

        receiveMessage('project-update', data => {
            setFileTree(prev => ({ ...prev, ...data.fileTree }));
        });

        receiveMessage('typing', ({ sender }) => {
            if (sender !== user?.email) {
                setTypingUsers(prev => {
                    if (!prev.includes(sender)) return [...prev, sender];
                    return prev;
                });
            }
        });

        receiveMessage('stop-typing', ({ sender }) => {
            setTypingUsers(prev => prev.filter(email => email !== sender));
        });

        const handleClickOutside = () => {
            setContextMenu({ visible: false, x: 0, y: 0, file: null });
            setIsSettingsOpen(false);
        };
        window.addEventListener('click', handleClickOutside);

        // Fetch latest project data
        axios.get(`/projects/get-project/${project._id}`).then(res => {
            setProject(res.data.project);
            setFileTree(res.data.project.fileTree || {});
        }).catch(err => {
            console.error("Failed to fetch project data:", err);
        });

        return () => {
            socketInstance.off('project-message');
            socketInstance.off('project-update');
            socketInstance.off('typing');
            socketInstance.off('stop-typing');
            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
            sendMessage('stop-typing', { projectId: project._id, sender: user?.email });
        };
    }, [project?._id]);

    useEffect(() => {
        if (messageBoxRef.current) {
            messageBoxRef.current.scrollTop = messageBoxRef.current.scrollHeight;
        }
    }, [messages]);

    useEffect(() => {
        aiEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages, isAiLoading]);

    // --- Handlers ---
    const handleSendChat = (e) => {
        e?.preventDefault();
        if (!message.trim() || !user) return;

        const messageData = {
            messageId: Date.now() + Math.random().toString(36).substr(2, 9),
            projectId: project._id,
            senderId: user._id,
            senderName: user.email?.split('@')[0] || 'Unknown',
            message,
            sender: user,
            timestamp: new Date().toISOString()
        };

        sendMessage('project-message', messageData);
        setMessages(prev => [...prev, messageData]);
        setMessage('');

        // Stop typing immediately on send
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        sendMessage('stop-typing', { projectId: project._id, sender: user?.email });
    };

    const handleSendAI = async (text) => {
        if (!text.trim() || isAiLoading) return;
        setAiMessages(prev => [...prev, { role: 'user', text }]);
        setIsAiLoading(true);

        try {
            const currentCode = currentFile ? (fileTree[currentFile]?.file?.contents || '') : '';
            const reply = await askGemini(text, currentCode);
            setAiMessages(prev => [...prev, { role: 'ai', text: reply }]);
        } catch (error) {
            setAiMessages(prev => [...prev, { role: 'ai', text: '⚠️ Error connecting to Gemini. Check your API key in .env' }]);
        } finally {
            setIsAiLoading(false);
        }
    };

    const handleCodeUpdate = (updatedContent) => {
        if (!currentFile) return;

        const ft = {
            ...fileTree,
            [currentFile]: {
                ...fileTree[currentFile],
                file: {
                    ...fileTree[currentFile].file,
                    contents: updatedContent
                }
            }
        };

        setFileTree(ft);

        sendMessage('project-update', {
            fileTree: { [currentFile]: ft[currentFile] }
        });

        if (saveTimeout.current) clearTimeout(saveTimeout.current);
        saveTimeout.current = setTimeout(() => {
            axios.put('/projects/update-file-tree', {
                projectId: project._id,
                fileTree: ft
            }).catch(console.error);
        }, 3000);
    };

    const deleteFile = (fileName) => {
        if (!window.confirm(`Are you sure you want to delete ${fileName}?`)) return;
        const ft = { ...fileTree };
        delete ft[fileName];
        setFileTree(ft);
        if (currentFile === fileName) setCurrentFile(null);
        setOpenFiles(prev => prev.filter(f => f !== fileName));

        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).catch(console.error);

        sendMessage('project-update', { fileTree: ft });
    };

    const renameFile = () => {
        if (!newFileName.trim()) return;
        const oldName = contextMenu.file;
        const ft = { ...fileTree };
        ft[newFileName] = ft[oldName];
        delete ft[oldName];

        setFileTree(ft);
        if (currentFile === oldName) setCurrentFile(newFileName);
        setOpenFiles(prev => prev.map(f => f === oldName ? newFileName : f));

        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).catch(console.error);

        sendMessage('project-update', { fileTree: ft });
        setIsRenameModalOpen(false);
        setNewFileName('');
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/login');
    };

    const createNewFile = () => {
        if (!fileName.trim()) return;
        const ft = {
            ...fileTree,
            [fileName]: { file: { contents: '' } }
        };
        setFileTree(ft);
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).catch(console.error);
        setFileName('');
        setIsCreateModalOpen(false);
    };

    const sendInvite = () => {
        if (!inviteEmail.trim()) return;
        axios.post(`/collaboration/projects/${project._id}/invite`, {
            email: inviteEmail
        }).then(() => {
            alert('Invite sent successfully');
            setIsInviteModalOpen(false);
            setInviteEmail('');
        }).catch(err => {
            alert(err.response?.data?.message || 'Failed to send invite');
        });
    };

    const runCode = async () => {
        setTerminalOutput('⚡ Running project...\n');
        await webContainer.mount(fileTree);

        if (currentFile && currentFile.endsWith('.js')) {
            setTerminalOutput(prev => prev + `> node ${currentFile}\n`);
            const runProcess = await webContainer.spawn("node", [currentFile]);
            runProcess.output.pipeTo(new WritableStream({
                write(chunk) { setTerminalOutput(prev => prev + chunk); }
            }));
            return;
        }

        setTerminalOutput(prev => prev + '> npm install\n');
        const installProcess = await webContainer.spawn("npm", ["install"]);
        installProcess.output.pipeTo(new WritableStream({
            write(chunk) { setTerminalOutput(prev => prev + chunk); }
        }));
        const exitCode = await installProcess.exit;

        if (exitCode === 0) {
            setTerminalOutput(prev => prev + '> npm start\n');
            const startProcess = await webContainer.spawn("npm", ["start"]);
            startProcess.output.pipeTo(new WritableStream({
                write(chunk) { setTerminalOutput(prev => prev + chunk); }
            }));
            webContainer.on('server-ready', (port, url) => setIframeUrl(url));
        }
    };

    // --- UI Components ---
    const Avatar = ({ char, color, size = 28 }) => (
        <div
            className={`rounded-full flex items-center justify-center font-bold text-white border-2 border-white/10 shadow-sm transition-transform hover:scale-110 cursor-pointer`}
            title={char}
            style={{ width: size, height: size, fontSize: size * 0.4, backgroundColor: color || 'var(--bg-tertiary)' }}
        >
            {char ? char[0].toUpperCase() : '?'}
        </div>
    );

    return (
        <div className="h-screen w-screen flex flex-col bg-bg-primary text-text-primary overflow-hidden font-inter selection:bg-accent/30">

            {/* --- TOP NAVIGATION BAR (52px) --- */}
            <header className="h-[52px] bg-bg-primary border-b border-border flex items-center px-4 gap-6 shrink-0 z-50">
                {/* Logo Section */}
                <div
                    onClick={() => navigate('/')}
                    className="flex items-center gap-3 min-w-[140px] cursor-pointer hover:opacity-80 transition-opacity"
                >
                    <div className="w-[28px] h-[28px] rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center shadow-lg shadow-accent/20">
                        <i className="ri-code-s-slash-line text-white text-sm font-bold"></i>
                    </div>
                    <div>
                        <h1 className="text-[13px] font-bold tracking-tight leading-none text-text-primary">{project.name || 'Project'}</h1>
                        <span className="text-[9px] text-green font-bold tracking-widest leading-none mt-1 inline-block uppercase">● LIVE</span>
                    </div>
                </div>

                <div className="w-px h-6 bg-border mx-2" />

                {/* All Projects Button */}
                <button
                    onClick={() => navigate('/')}
                    className="text-[11px] font-bold text-text-secondary hover:text-text-primary transition-colors flex items-center gap-2"
                >
                    <i className="ri-layout-grid-line"></i> ALL PROJECTS
                </button>

                {/* Tab Switcher */}
                <nav className="flex items-center gap-2">
                    {['CHAT', 'AI', 'TEAM'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActivePanel(tab)}
                            className={getTabStyle(tab)}
                        >
                            {tab}
                        </button>
                    ))}
                </nav>

                <div className="flex-1" />

                <div className="flex items-center gap-4 relative">
                    <div className="flex -space-x-2">
                        {project.users?.map((u, i) => (
                            <div key={i} title={u.email} className="z-[10]">
                                <Avatar char={u.email} color={`hsl(${i * 137}, 60%, 50%)`} size={28} />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={runCode}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-md bg-gradient-to-r from-[#238636] to-[#2ea043] hover:shadow-[0_0_15px_rgba(46,160,67,0.4)] text-white text-xs font-bold transition-all active:scale-95"
                    >
                        <i className="ri-play-fill text-sm"></i>
                        Run
                    </button>

                    <div className="w-px h-6 bg-border mx-1" />

                    {/* Settings / User Dropdown */}
                    <div className="relative">
                        <button
                            onClick={(e) => { e.stopPropagation(); setIsSettingsOpen(!isSettingsOpen); }}
                            className="p-1.5 rounded-lg hover:bg-bg-secondary text-text-secondary hover:text-text-primary transition-all"
                        >
                            <i className="ri-settings-4-line text-lg"></i>
                        </button>

                        {isSettingsOpen && (
                            <div className="absolute right-0 mt-2 w-48 bg-bg-secondary border border-border rounded-xl shadow-2xl py-2 z-[100] animate-fadeInUp">
                                <div className="px-4 py-2 border-b border-border mb-1">
                                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">Logged in as</p>
                                    <p className="text-xs font-semibold truncate text-text-primary">{user?.email}</p>
                                </div>
                                <button
                                    onClick={() => navigate('/')}
                                    className="w-full text-left px-4 py-2 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-colors flex items-center gap-3"
                                >
                                    <i className="ri-layout-grid-line"></i> My Projects
                                </button>
                                <button
                                    onClick={handleLogout}
                                    className="w-full text-left px-4 py-2 text-xs text-red hover:bg-red/10 transition-colors flex items-center gap-3"
                                >
                                    <i className="ri-logout-box-r-line"></i> Logout
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* --- MAIN LAYOUT (Columns) --- */}
            <main className="flex-1 flex overflow-hidden">

                {/* 1. LEFT PANEL: Chat / AI / Team */}
                <aside
                    style={{ width: `${leftWidth}px` }}
                    className="bg-bg-primary border-r border-border flex flex-col shrink-0 overflow-hidden transition-[width] duration-0"
                >
                    {activePanel === 'CHAT' && (
                        <div className="flex flex-col h-full animate-fadeInUp">
                            <div className="p-3 border-b border-border flex items-center justify-between">
                                <span className="text-[11px] font-bold text-text-secondary tracking-[0.08em] uppercase flex items-center gap-2">
                                    <i className="ri-chat-3-line text-sm"></i> TEAM CHAT
                                </span>
                            </div>
                            <div
                                ref={messageBoxRef}
                                className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 scrollbar-hide"
                            >
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`flex flex-col ${msg.senderId === user._id ? 'items-end' : 'items-start'}`}>
                                        <span className="text-[9px] text-text-muted uppercase tracking-wider mb-1 px-1">
                                            {msg.senderId === user._id ? 'You' : msg.senderName}
                                        </span>
                                        <div className={`max-w-[85%] px-3 py-2 text-[13px] leading-relaxed rounded-2xl shadow-sm
                                            ${msg.senderId === user._id
                                                ? 'bg-gradient-to-br from-accent to-[#8b5cf6] text-white rounded-tr-none shadow-accent/20'
                                                : 'bg-bg-secondary border border-bg-tertiary text-text-primary rounded-tl-none'}`}
                                        >
                                            {msg.message}
                                        </div>
                                        <span className="text-[8px] text-text-muted mt-1 px-1">
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <div className="p-3 bg-bg-primary border-t border-border">
                                {/* Typing Indicator UI */}
                                <div className={`overflow-hidden transition-all duration-200 ease-in-out flex items-center gap-2 px-3
                                    ${typingUsers.length > 0 ? 'h-8 opacity-100 mb-1' : 'h-0 opacity-0'}`}
                                >
                                    <div className="flex -space-x-1.5 items-center">
                                        {typingUsers.slice(0, 3).map((email, idx) => (
                                            <div key={idx} className="z-[5]">
                                                <Avatar
                                                    char={email}
                                                    color={`hsl(${idx * 137}, 60%, 50%)`}
                                                    size={20}
                                                />
                                            </div>
                                        ))}
                                        {typingUsers.length > 3 && (
                                            <div className="w-5 h-5 rounded-full bg-bg-tertiary border border-border flex items-center justify-center text-[8px] font-bold text-text-secondary z-[10]">
                                                +{typingUsers.length - 3}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className="text-[12px] text-text-secondary italic font-inter">
                                            {typingUsers.length === 1 && `${typingUsers[0].split('@')[0]} is typing...`}
                                            {typingUsers.length === 2 && `${typingUsers[0].split('@')[0]} and ${typingUsers[1].split('@')[0]} are typing...`}
                                            {typingUsers.length >= 3 && `${typingUsers[0].split('@')[0]}, ${typingUsers[1].split('@')[0]} and ${typingUsers.length - 2} others are typing...`}
                                        </p>
                                        <div className="flex gap-1 items-center h-4">
                                            {[0, 0.15, 0.3].map((delay, i) => (
                                                <div
                                                    key={i}
                                                    className="w-1.25 h-1.25 bg-accent rounded-full"
                                                    style={{ width: '5px', height: '5px', animation: `bounce 1s ease infinite ${delay}s` }}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <form onSubmit={handleSendChat} className="flex gap-2 bg-bg-secondary border border-border rounded-lg p-1 focus-within:border-accent transition-colors">
                                    <input
                                        autoFocus={activePanel === 'CHAT'}
                                        value={message}
                                        onChange={(e) => {
                                            setMessage(e.target.value);
                                            sendMessage('typing', { projectId: project._id, sender: user?.email });
                                            if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                                            typingTimeoutRef.current = setTimeout(() => {
                                                sendMessage('stop-typing', { projectId: project._id, sender: user?.email });
                                            }, 1500);
                                        }}
                                        placeholder="Type a message..."
                                        className="flex-1 bg-transparent border-none px-2 py-1.5 text-xs text-text-primary focus:ring-0"
                                    />
                                    <button type="submit" className="w-8 h-8 rounded-md bg-gradient-to-br from-accent to-[#8b5cf6] flex items-center justify-center text-white hover:opacity-90">
                                        <i className="ri-send-plane-2-fill"></i>
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {activePanel === 'AI' && (
                        <div className="flex flex-col h-full animate-fadeInUp">
                            <div className="p-3 border-b border-border flex items-center gap-2">
                                <div className="w-5 h-5 rounded bg-gradient-to-br from-[#4285f4] to-[#34a853] flex items-center justify-center">
                                    <i className="ri-sparkling-2-line text-white text-[10px]"></i>
                                </div>
                                <span className="text-[11px] font-bold text-text-secondary tracking-[0.08em] uppercase">GEMINI AI</span>
                                <span className="ml-auto text-[8px] text-green tracking-widest font-bold uppercase">● Connected</span>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 scrollbar-hide">
                                {aiMessages.map((msg, idx) => (
                                    <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                        {msg.role === 'ai' && (
                                            <div className="w-6 h-6 rounded bg-gradient-to-br from-[#4285f4] to-[#ea4335] shrink-0 mt-1 flex items-center justify-center">
                                                <i className="ri-sparkling-2-line text-white text-xs"></i>
                                            </div>
                                        )}
                                        <div className={`p-3 rounded-xl text-[12.5px] leading-relaxed max-w-[90%]
                                            ${msg.role === 'user'
                                                ? 'bg-gradient-to-br from-accent to-[#8b5cf6] text-white rounded-tr-none shadow-lg shadow-accent/10 font-inter'
                                                : 'bg-bg-secondary border border-bg-tertiary text-text-primary font-mono whitespace-pre-wrap'}`}
                                        >
                                            {msg.role === 'ai' ? (
                                                <Markdown options={{ overrides: { code: SyntaxHighlightedCode } }}>{msg.text}</Markdown>
                                            ) : msg.text}
                                        </div>
                                    </div>
                                ))}
                                {isAiLoading && (
                                    <div className="flex gap-3">
                                        <div className="w-6 h-6 rounded bg-gradient-to-br from-[#4285f4] to-[#ea4335] shrink-0 flex items-center justify-center">
                                            <i className="ri-sparkling-2-line text-white text-xs"></i>
                                        </div>
                                        <div className="bg-bg-secondary border border-bg-tertiary p-3 rounded-xl flex gap-1.5 items-center">
                                            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-slow"></div>
                                            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-slow delay-100"></div>
                                            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse-slow delay-200"></div>
                                        </div>
                                    </div>
                                )}
                                <div ref={aiEndRef} />
                            </div>

                            <div className="px-3 py-2 flex flex-wrap gap-1.5 border-t border-border/50">
                                {["Explain code", "Find bugs", "Optimize", "Refactor"].map(tag => (
                                    <button
                                        key={tag}
                                        onClick={() => handleSendAI(tag)}
                                        className="px-2.5 py-1 rounded-full border border-bg-tertiary text-[10px] text-text-secondary hover:border-accent hover:text-accent transition-all"
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>

                            <div className="p-3 bg-bg-primary border-t border-border">
                                <form onSubmit={(e) => { e.preventDefault(); handleSendAI(e.target.prompt.value); e.target.prompt.value = ''; }} className="flex gap-2 bg-bg-secondary border border-border rounded-lg p-1 focus-within:border-[#4285f4] transition-colors">
                                    <input
                                        name="prompt"
                                        autoFocus={activePanel === 'AI'}
                                        placeholder="Ask Gemini about your code..."
                                        className="flex-1 bg-transparent border-none px-2 py-1.5 text-xs text-text-primary focus:ring-0"
                                    />
                                    <button type="submit" className="w-8 h-8 rounded-md bg-gradient-to-br from-[#4285f4] to-[#34a853] flex items-center justify-center text-white">
                                        <i className="ri-sparkling-2-line"></i>
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}

                    {activePanel === 'TEAM' && (
                        <div className="flex flex-col h-full animate-fadeInUp">
                            <div className="p-3 border-b border-border flex items-center justify-between">
                                <span className="text-[11px] font-bold text-text-secondary tracking-[0.08em] uppercase flex items-center gap-2">
                                    <i className="ri-group-line text-sm"></i> TEAM MEMBERS ({project.users?.length || 0})
                                </span>
                                <button onClick={() => setIsInviteModalOpen(true)} className="p-1 hover:text-accent text-text-muted transition-colors">
                                    <i className="ri-user-add-line"></i>
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 scrollbar-hide">
                                {project.users?.map((u, i) => (
                                    <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-bg-secondary border border-bg-tertiary hover:border-border transition-colors">
                                        <Avatar char={u.email} color={`hsl(${i * 137}, 60%, 50%)`} size={30} />
                                        <div className="overflow-hidden">
                                            <p className="text-xs font-semibold text-text-primary truncate">{u.email?.split('@')[0] || 'Member'}</p>
                                            <span className="text-[10px] text-green font-medium">● Online</span>
                                        </div>
                                        <span className="ml-auto text-[9px] font-mono text-text-muted">
                                            {u._id === user?._id ? 'you' : 'collab'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </aside>

                {/* Resizer Handle 1 */}
                <div
                    onMouseDown={() => {
                        isResizingLeft.current = true;
                        document.body.style.cursor = 'col-resize';
                        document.body.classList.add('select-none');
                    }}
                    className="w-[1.5px] hover:w-1 bg-border hover:bg-accent cursor-col-resize transition-all z-50 active:bg-accent"
                />

                {/* 2. FILE EXPLORER */}
                <aside
                    style={{ width: `${explorerWidth}px` }}
                    className="bg-bg-primary border-r border-border flex flex-col shrink-0 overflow-hidden transition-[width] duration-0"
                >
                    <div className="p-3 border-b border-border flex items-center justify-between">
                        <span className="text-[10px] font-bold text-text-secondary tracking-widest uppercase">EXPLORER</span>
                        <button onClick={() => setIsCreateModalOpen(true)} className="p-1 text-text-muted hover:text-text-primary">
                            <i className="ri-file-add-line"></i>
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
                        {Object.keys(fileTree).map((file) => (
                            <button
                                key={file}
                                onClick={() => {
                                    setCurrentFile(file);
                                    if (!openFiles.includes(file)) setOpenFiles([...openFiles, file]);
                                }}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, file });
                                }}
                                className={`w-full flex items-center gap-2 px-3.5 py-1.5 text-xs transition-colors border-l-2
                                    ${currentFile === file
                                        ? 'bg-bg-secondary border-accent text-text-primary'
                                        : 'border-transparent text-text-secondary hover:bg-bg-secondary/50 hover:text-text-primary'}`}
                            >
                                <span className="text-sm">
                                    {file.endsWith('.js') ? '🟡' : file.endsWith('.css') ? '🎨' : file.endsWith('.html') ? '🌐' : '📄'}
                                </span>
                                <span className="truncate">{file}</span>
                            </button>
                        ))}
                    </div>

                    {/* Context Menu Component */}
                    {contextMenu.visible && (
                        <div
                            style={{ top: contextMenu.y, left: contextMenu.x }}
                            className="fixed bg-bg-secondary border border-border rounded-lg shadow-2xl py-1 z-[1000] w-36 animate-fadeInUp"
                        >
                            <button
                                onClick={() => { setIsRenameModalOpen(true); setNewFileName(contextMenu.file); setContextMenu({ ...contextMenu, visible: false }); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-tertiary hover:text-text-primary flex items-center gap-2"
                            >
                                <i className="ri-edit-line"></i> Rename
                            </button>
                            <button
                                onClick={() => { deleteFile(contextMenu.file); setContextMenu({ ...contextMenu, visible: false }); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-red hover:bg-red/10 flex items-center gap-2"
                            >
                                <i className="ri-delete-bin-line"></i> Delete
                            </button>
                        </div>
                    )}
                </aside>

                {/* Resizer Handle 2 */}
                <div
                    onMouseDown={() => {
                        isResizingExplorer.current = true;
                        document.body.style.cursor = 'col-resize';
                        document.body.classList.add('select-none');
                    }}
                    className="w-[1.5px] hover:w-1 bg-border hover:bg-accent cursor-col-resize transition-all z-50 active:bg-accent"
                />

                {/* 3. CODE EDITOR (Flex: 1) */}
                <section className="flex-1 flex flex-col overflow-hidden bg-bg-primary relative">

                    {/* Tabs Bar */}
                    <div className="h-9 min-h-[36px] bg-bg-secondary border-b border-border flex items-center overflow-x-auto scrollbar-hide">
                        {openFiles.map(file => (
                            <div
                                key={file}
                                onClick={() => setCurrentFile(file)}
                                className={`h-full min-w-[120px] flex items-center gap-2 px-3 border-r border-border cursor-pointer transition-colors relative
                                    ${currentFile === file ? 'bg-bg-primary border-t-2 border-accent text-text-primary' : 'text-text-secondary hover:bg-bg-tertiary'}`}
                            >
                                <span className="text-[10px]">
                                    {file.endsWith('.js') ? '🟡' : '📄'}
                                </span>
                                <span className="text-[11px] font-medium tracking-wide truncate">{file}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        const nextFiles = openFiles.filter(f => f !== file);
                                        setOpenFiles(nextFiles);
                                        if (currentFile === file) setCurrentFile(nextFiles[nextFiles.length - 1] || null);
                                    }}
                                    className="ml-auto hover:text-red transition-colors"
                                >
                                    <i className="ri-close-line text-xs"></i>
                                </button>
                            </div>
                        ))}
                    </div>

                    {/* Editor Content */}
                    <div className="flex-1 flex overflow-hidden font-mono">
                        {currentFile ? (
                            <>
                                {/* Line Numbers */}
                                <div className="w-[42px] bg-bg-primary border-r border-border flex flex-col items-end py-4 text-text-muted text-[12px] select-none text-right font-mono">
                                    {(fileTree[currentFile]?.file?.contents || '').split('\n').map((_, i) => (
                                        <div key={i} className="px-2.5 h-[21px] flex items-center">{i + 1}</div>
                                    ))}
                                </div>
                                {/* Textarea */}
                                <textarea
                                    spellCheck={false}
                                    value={fileTree[currentFile]?.file?.contents || ''}
                                    onChange={(e) => handleCodeUpdate(e.target.value)}
                                    className="flex-1 bg-bg-primary border-none outline-none resize-none px-4 py-4 text-text-primary text-[13px] leading-[21px] font-mono selection:bg-accent/40"
                                />
                            </>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center opacity-10">
                                <i className="ri-code-s-slash-line text-[100px] mb-4"></i>
                                <span className="text-sm font-black tracking-[0.5em] uppercase">Select a file</span>
                            </div>
                        )}
                    </div>

                    {/* Terminal Section (Floating logic integration) */}
                    {terminalOutput && (
                        <div className="h-[180px] bg-[#0A0D12] border-t border-border flex flex-col z-20">
                            <div className="px-4 py-1.5 border-b border-border flex items-center justify-between">
                                <span className="text-[9px] font-black tracking-widest text-text-muted uppercase">Terminal</span>
                                <button onClick={() => setTerminalOutput('')} className="text-[9px] text-red uppercase font-bold hover:underline">Close</button>
                            </div>
                            <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] text-[#A5B4FC] scrollbar-hide">
                                <pre className="whitespace-pre-wrap">{terminalOutput}</pre>
                            </div>
                        </div>
                    )}

                    {/* Preview (Iframe) */}
                    {iframeUrl && (
                        <div className="absolute right-0 top-0 bottom-0 w-1/2 bg-white border-l-4 border-accent shadow-2xl z-40 flex flex-col animate-fadeInUp">
                            <div className="h-10 bg-bg-secondary flex items-center px-4 justify-between">
                                <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest">Environment Preview</span>
                                <button onClick={() => setIframeUrl(null)} className="text-text-muted hover:text-red transition-colors">
                                    <i className="ri-close-line"></i>
                                </button>
                            </div>
                            <iframe src={iframeUrl} className="flex-1 w-full" />
                        </div>
                    )}

                    {/* Status Bar */}
                    <footer className="h-6 bg-bg-secondary border-t border-border flex items-center px-3 gap-6 shrink-0 z-30">
                        <div className="flex items-center gap-1.5 text-[10.5px] font-semibold text-green">
                            <span className="w-1.5 h-1.5 rounded-full bg-green shadow-lg shadow-green/20"></span>
                            JS
                        </div>
                        <span className="text-[10px] text-text-muted font-medium">UTF-8</span>
                        <div className="flex-1" />
                        <div className="flex items-center gap-4">
                            <span className="text-[10px] text-yellow font-bold flex items-center gap-1">
                                <i className="ri-flashlight-line"></i> Live Sync Active
                            </span>
                            <span className="text-[10px] text-text-muted">{project.users?.length || 0} peers</span>
                        </div>
                    </footer>
                </section>
            </main>

            {/* --- MODALS --- */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-bg-secondary border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fadeInUp">
                        <h2 className="text-lg font-bold mb-4">Create New File</h2>
                        <input
                            autoFocus
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && createNewFile()}
                            placeholder="filename.js"
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2.5 text-sm mb-6 focus:border-accent outline-none"
                        />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
                            <button onClick={createNewFile} className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all">Create</button>
                        </div>
                    </div>
                </div>
            )}

            {isInviteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-bg-secondary border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fadeInUp">
                        <h2 className="text-lg font-bold mb-4">Invite Member</h2>
                        <input
                            autoFocus
                            value={inviteEmail}
                            onChange={(e) => setInviteEmail(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                            placeholder="email@example.com"
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2.5 text-sm mb-6 focus:border-accent outline-none"
                        />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setIsInviteModalOpen(false)} className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
                            <button onClick={sendInvite} className="px-6 py-2 bg-green hover:opacity-90 text-white rounded-lg text-xs font-bold transition-all">Send Invite</button>
                        </div>
                    </div>
                </div>
            )}

            {isRenameModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-bg-secondary border border-border p-6 rounded-2xl w-full max-w-md shadow-2xl animate-fadeInUp">
                        <h2 className="text-lg font-bold mb-4">Rename File</h2>
                        <input
                            autoFocus
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && renameFile()}
                            placeholder="newname.js"
                            className="w-full bg-bg-tertiary border border-border rounded-lg px-4 py-2.5 text-sm mb-6 focus:border-accent outline-none"
                        />
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setIsRenameModalOpen(false)} className="px-4 py-2 text-xs font-bold text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
                            <button onClick={renameFile} className="px-6 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-xs font-bold transition-all">Rename</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Project;
