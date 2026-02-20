import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webcontainer'


function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)

            // hljs won't reprocess the element unless this attribute is removed
            ref.current.removeAttribute('data-highlighted')
        }
    }, [props.className, props.children])

    return <code {...props} ref={ref} />
}


const Project = () => {

    const location = useLocation()

    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState(new Set()) // Initialized as Set
    const [project, setProject] = useState(location.state.project)
    const [message, setMessage] = useState('')
    const { user } = useContext(UserContext)
    const messageBox = React.createRef()

    const [users, setUsers] = useState([])
    const [messages, setMessages] = useState([]) // New state variable for messages
    const [fileTree, setFileTree] = useState({})

    const [currentFile, setCurrentFile] = useState(null)
    const [openFiles, setOpenFiles] = useState([])

    const [webContainer, setWebContainer] = useState(null)
    const [iframeUrl, setIframeUrl] = useState(null)

    const [runProcess, setRunProcess] = useState(null)
    const [terminalOutput, setTerminalOutput] = useState('')
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
    const [fileName, setFileName] = useState('')
    const [contextMenu, setContextMenu] = useState({ x: 0, y: 0, visible: false, selectedFile: null })
    const [isRenameModalOpen, setIsRenameModalOpen] = useState(false)
    const [newFileName, setNewFileName] = useState('')
    const [theme, setTheme] = useState('dark') // 'dark' or 'light'

    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }

            return newSelectedUserId;
        });


    }


    function addCollaborators() {

        axios.put("/projects/add-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            console.log(res.data)
            setIsModalOpen(false)

        }).catch(err => {
            console.log(err)
        })

    }

    function createNewFile() {
        if (!fileName) return;
        const newFileTree = {
            ...fileTree,
            [fileName]: {
                file: {
                    contents: ''
                }
            }
        }
        setFileTree(newFileTree)
        saveFileTree(newFileTree)
        setFileName('')
        setIsCreateModalOpen(false)
    }

    function renameFile() {
        if (!newFileName || !contextMenu.selectedFile) return;

        const oldFileName = contextMenu.selectedFile;
        const fileContent = fileTree[oldFileName];

        const newFileTree = { ...fileTree };
        delete newFileTree[oldFileName];
        newFileTree[newFileName] = fileContent;

        setFileTree(newFileTree);
        saveFileTree(newFileTree);

        if (currentFile === oldFileName) {
            setCurrentFile(newFileName);
        }

        setOpenFiles(prev => prev.map(f => f === oldFileName ? newFileName : f));

        setIsRenameModalOpen(false);
        setNewFileName('');
        setContextMenu({ ...contextMenu, visible: false });
    }

    function handleContextMenu(e, file) {
        e.preventDefault();
        setContextMenu({
            x: e.pageX,
            y: e.pageY,
            visible: true,
            selectedFile: file
        });
    }

    useEffect(() => {
        const handleClick = () => setContextMenu({ ...contextMenu, visible: false });
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu]);

    const send = () => {

        sendMessage('project-message', {
            message,
            sender: user
        })
        setMessages(prevMessages => [...prevMessages, { sender: user, message }]) // Update messages state
        setMessage("")

    }

    function WriteAiMessage(message) {

        const messageObject = JSON.parse(message)

        return (
            <div
                className='overflow-auto bg-slate-950 text-white rounded-sm p-2'
            >
                <Markdown
                    children={messageObject.text}
                    options={{
                        overrides: {
                            code: SyntaxHighlightedCode,
                        },
                    }}
                />
            </div>)
    }

    useEffect(() => {

        initializeSocket(project._id)

        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container)
                console.log("container started")
            })
        }


        receiveMessage('project-message', data => {

            console.log(data)

            if (data.sender._id == 'ai') {


                const message = JSON.parse(data.message)

                console.log(message)

                webContainer?.mount(message.fileTree)

                if (message.fileTree) {
                    setFileTree(prev => ({
                        ...prev,
                        ...message.fileTree
                    }))
                }
                setMessages(prevMessages => [...prevMessages, data]) // Update messages state
            } else {


                setMessages(prevMessages => [...prevMessages, data]) // Update messages state
            }
        })


        axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {

            console.log(res.data.project)

            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
        })

        axios.get('/users/all').then(res => {

            setUsers(res.data.users)

        }).catch(err => {

            console.log(err)

        })

    }, [])

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).then(res => {
            console.log(res.data)
        }).catch(err => {
            console.log(err)
        })
    }


    // Removed appendIncomingMessage and appendOutgoingMessage functions

    function scrollToBottom() {
        messageBox.current.scrollTop = messageBox.current.scrollHeight
    }

    return (
        <main className='h-screen w-screen flex'>
            <section className="left relative flex flex-col h-screen min-w-96 bg-slate-300">
                <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute z-10 top-0'>
                    <button className='flex gap-2' onClick={() => setIsModalOpen(true)}>
                        <i className="ri-add-fill mr-1"></i>
                        <p>Add collaborator</p>
                    </button>
                    <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                        <i className="ri-group-fill"></i>
                    </button>
                </header>
                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col h-full relative">

                    <div
                        ref={messageBox}
                        className="message-box p-1 flex-grow flex flex-col gap-1 overflow-auto max-h-full scrollbar-hide">
                        {messages.map((msg, index) => (
                            <div key={index} className={`${msg.sender._id === 'ai' ? 'max-w-80' : 'max-w-52'} ${msg.sender._id == user._id.toString() && 'ml-auto'}  message flex flex-col p-2 bg-slate-50 w-fit rounded-md`}>
                                <small className='opacity-65 text-xs'>{msg.sender.email}</small>
                                <div className='text-sm'>
                                    {msg.sender._id === 'ai' ?
                                        WriteAiMessage(msg.message)
                                        : <p>{msg.message}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="inputField w-full flex absolute bottom-0">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className='p-2 px-4 border-none outline-none flex-grow' type="text" placeholder='Enter message' />
                        <button
                            onClick={send}
                            className='px-5 bg-slate-950 text-white'><i className="ri-send-plane-fill"></i></button>
                    </div>
                </div>
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                    <header className='flex justify-between items-center px-4 p-2 bg-slate-200'>

                        <h1
                            className='font-semibold text-lg'
                        >Collaborators</h1>

                        <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                            <i className="ri-close-fill"></i>
                        </button>
                    </header>
                    <div className="users flex flex-col gap-2">

                        {project.users && project.users.map(user => {


                            return (
                                <div className="user cursor-pointer hover:bg-slate-200 p-2 flex gap-2 items-center">
                                    <div className='aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.email}</h1>
                                </div>
                            )


                        })}
                    </div>
                </div>
            </section>

            <section className="right  bg-red-50 flex-grow h-full flex">

                <div className="explorer h-full max-w-64 min-w-52 bg-slate-200">
                    <header className='flex justify-between items-center p-2 px-4 bg-slate-300'>
                        <h1 className='font-semibold'>Files</h1>
                        <button onClick={() => setIsCreateModalOpen(true)} className='p-1'>
                            <i className="ri-add-line"></i>
                        </button>
                    </header>
                    <div className="file-tree w-full">
                        {
                            Object.keys(fileTree).map((file, index) => (
                                <button
                                    key={index}
                                    onClick={() => {
                                        setCurrentFile(file)
                                        setOpenFiles([...new Set([...openFiles, file])])
                                    }}
                                    onContextMenu={(e) => handleContextMenu(e, file)}
                                    className={`tree-element cursor-pointer p-2 px-4 flex items-center gap-2 w-full ${currentFile === file ? 'bg-slate-400' : 'bg-slate-300'}`}>
                                    <p
                                        className='font-semibold text-lg'
                                    >{file}</p>
                                </button>))

                        }
                    </div>

                </div>


                <div className="code-editor flex flex-col flex-grow h-full shrink">

                    <div className="top flex justify-between w-full">

                        <div className="files flex">
                            {
                                openFiles.map((file, index) => (
                                    <button
                                        key={index}
                                        onClick={() => setCurrentFile(file)}
                                        className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 ${theme === 'dark' ? 'bg-slate-800 text-white' : 'bg-slate-300 text-black'} ${currentFile === file ? (theme === 'dark' ? 'bg-slate-700 border-b-2 border-blue-500' : 'bg-slate-400') : ''}`}>
                                        <p
                                            className='font-semibold text-lg'
                                        >{file}</p>
                                    </button>
                                ))
                            }
                        </div>

                        <div className="actions flex gap-2 items-center px-2">
                            <button
                                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                                className={`p-2 px-3 rounded-full transition-all ${theme === 'dark' ? 'bg-slate-700 text-yellow-400 hover:bg-slate-600' : 'bg-slate-200 text-gray-800 hover:bg-slate-300'}`}
                                title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
                            >
                                <i className={theme === 'dark' ? "ri-sun-line" : "ri-moon-line"}></i>
                            </button>
                            <button
                                onClick={async () => {
                                    setTerminalOutput('Running...\n')
                                    await webContainer.mount(fileTree)

                                    if (currentFile && currentFile.endsWith('.js')) {
                                        // If it's a JS file, try to run it directly
                                        setTerminalOutput(prev => prev + `Executing ${currentFile}...\n`)
                                        const runFileProcess = await webContainer.spawn("node", [currentFile])

                                        runFileProcess.output.pipeTo(new WritableStream({
                                            write(chunk) {
                                                setTerminalOutput(prev => prev + chunk)
                                            }
                                        }))

                                        const exitCode = await runFileProcess.exit;
                                        setTerminalOutput(prev => prev + `\nProcess finished with exit code ${exitCode}\n`)
                                        return;
                                    }

                                    // Fallback to npm install and npm start
                                    setTerminalOutput(prev => prev + 'Starting full build (npm install)...\n')
                                    const installProcess = await webContainer.spawn("npm", ["install"])

                                    installProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            setTerminalOutput(prev => prev + chunk)
                                        }
                                    }))

                                    const exitCode = await installProcess.exit;
                                    if (exitCode !== 0) {
                                        setTerminalOutput(prev => prev + '\nBuild failed\n')
                                        return;
                                    }

                                    setTerminalOutput(prev => prev + '\nBuild successful. Starting application...\n')

                                    if (runProcess) {
                                        runProcess.kill()
                                    }

                                    let tempRunProcess = await webContainer.spawn("npm", ["start"]);

                                    tempRunProcess.output.pipeTo(new WritableStream({
                                        write(chunk) {
                                            setTerminalOutput(prev => prev + chunk)
                                        }
                                    }))

                                    setRunProcess(tempRunProcess)

                                    webContainer.on('server-ready', (port, url) => {
                                        console.log(port, url)
                                        setIframeUrl(url)
                                    })

                                }}
                                className={`p-2 px-4 rounded font-medium transition-all ${theme === 'dark' ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-slate-300 text-black hover:bg-slate-400'}`}
                            >
                                run
                            </button>
                        </div>
                    </div>
                    <div className={`bottom flex flex-grow max-w-full shrink overflow-auto ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                        {
                            fileTree[currentFile] && (
                                <div className={`code-editor-area h-full overflow-auto flex-grow ${theme === 'dark' ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
                                    <pre
                                        className="h-full">
                                        <code
                                            className={`h-full outline-none font-mono ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}
                                            contentEditable
                                            suppressContentEditableWarning
                                            onInput={(e) => {
                                                // Prevent state update on every keystroke to avoid re-render reset
                                                // We will update state only on blur or manually
                                            }}
                                            onBlur={(e) => {
                                                const updatedContent = e.target.innerText;
                                                const ft = {
                                                    ...fileTree,
                                                    [currentFile]: {
                                                        file: {
                                                            contents: updatedContent
                                                        }
                                                    }
                                                }
                                                setFileTree(ft)
                                                saveFileTree(ft)
                                            }}
                                            dangerouslySetInnerHTML={{ __html: hljs.highlightAuto(fileTree[currentFile].file.contents).value }}
                                            style={{
                                                whiteSpace: 'pre-wrap',
                                                padding: '1rem',
                                                paddingBottom: '25rem',
                                                display: 'block'
                                            }}
                                        />
                                    </pre>
                                </div>
                            )
                        }
                    </div>

                    {terminalOutput && (
                        <div className={`terminal h-48 p-2 overflow-auto font-mono text-xs border-t ${theme === 'dark' ? 'bg-black text-green-400 border-gray-800' : 'bg-slate-100 text-slate-800 border-slate-300'}`}>
                            <header className={`flex justify-between items-center mb-1 border-b ${theme === 'dark' ? 'border-green-900' : 'border-slate-300'}`}>
                                <span className="font-bold uppercase tracking-wider opacity-70">Terminal Output</span>
                                <button onClick={() => setTerminalOutput('')} className='text-red-500 hover:text-red-400 font-bold'>CLEAR</button>
                            </header>
                            <pre className='whitespace-pre-wrap'>{terminalOutput}</pre>
                        </div>
                    )}

                </div>

                {iframeUrl && webContainer &&
                    (<div className="flex min-w-96 flex-col h-full">
                        <div className="address-bar">
                            <input type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl} className="w-full p-2 px-4 bg-slate-200" />
                        </div>
                        <iframe src={iframeUrl} className="w-full h-full"></iframe>
                    </div>)
                }


            </section>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-md w-96 max-w-full relative">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Select User</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="users-list flex flex-col gap-2 mb-16 max-h-96 overflow-auto">
                            {users.map(user => (
                                <div key={user.id} className={`user cursor-pointer hover:bg-slate-200 ${Array.from(selectedUserId).indexOf(user._id) != -1 ? 'bg-slate-200' : ""} p-2 flex gap-2 items-center`} onClick={() => handleUserClick(user._id)}>
                                    <div className='aspect-square relative rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.email}</h1>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addCollaborators}
                            className='absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-md'>
                            Add Collaborators
                        </button>
                    </div>
                </div>
            )}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-md w-96 max-w-full">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Create New File</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">File Name</label>
                            <input
                                value={fileName}
                                onChange={(e) => setFileName(e.target.value)}
                                type="text" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" placeholder='e.g. index.js' />
                        </div>
                        <div className="flex justify-end">
                            <button onClick={createNewFile} className='px-4 py-2 bg-blue-600 text-white rounded-md'>Create</button>
                        </div>
                    </div>
                </div>
            )}
            {isRenameModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white p-6 rounded-md w-96 max-w-full">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Rename File</h2>
                            <button onClick={() => setIsRenameModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700">New File Name</label>
                            <input
                                value={newFileName}
                                onChange={(e) => setNewFileName(e.target.value)}
                                type="text" className="mt-1 block w-full p-2 border border-gray-300 rounded-md" />
                        </div>
                        <div className="flex justify-end">
                            <button onClick={renameFile} className='px-4 py-2 bg-blue-600 text-white rounded-md'>Rename</button>
                        </div>
                    </div>
                </div>
            )}

            {contextMenu.visible && (
                <div
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    className="fixed bg-white shadow-md rounded-md py-2 w-32 z-50 border border-slate-200"
                >
                    <button
                        onClick={() => {
                            setNewFileName(contextMenu.selectedFile);
                            setIsRenameModalOpen(true);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-100 flex items-center gap-2"
                    >
                        <i className="ri-edit-line"></i> Rename
                    </button>
                    <button
                        onClick={() => {
                            const newFileTree = { ...fileTree };
                            delete newFileTree[contextMenu.selectedFile];
                            setFileTree(newFileTree);
                            saveFileTree(newFileTree);
                            if (currentFile === contextMenu.selectedFile) setCurrentFile(null);
                            setOpenFiles(prev => prev.filter(f => f !== contextMenu.selectedFile));
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-100 text-red-600 flex items-center gap-2"
                    >
                        <i className="ri-delete-bin-line"></i> Delete
                    </button>
                </div>
            )}
        </main>
    )
}

export default Project