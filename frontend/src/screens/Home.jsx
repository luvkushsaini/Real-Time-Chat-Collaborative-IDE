import React, { useContext, useState, useEffect } from 'react'
import { UserContext } from '../context/user.context'
import axios from "../config/axios"
import { useNavigate } from 'react-router-dom'

const Home = () => {

    const { user } = useContext(UserContext)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [projectName, setProjectName] = useState('')
    const [project, setProject] = useState([])
    const [notifications, setNotifications] = useState([])
    const [activeTab, setActiveTab] = useState('Dashboard')
    const [searchQuery, setSearchQuery] = useState('')
    const [showNotifications, setShowNotifications] = useState(false)

    const navigate = useNavigate()

    const fetchProjects = () => {
        axios.get('/projects/all').then((res) => {
            setProject(res.data.projects)
        }).catch(err => {
            console.log(err)
        })
    }

    const fetchNotifications = () => {
        axios.get('/collaboration/notifications').then((res) => {
            setNotifications(res.data.data)
        }).catch(err => {
            console.log(err)
        })
    }

    const respondToInvite = (requestId, action) => {
        axios.post(`/collaboration/notifications/${requestId}/respond`, { action })
            .then(res => {
                setNotifications(prev => prev.filter(n => n._id !== requestId))
                if (action === 'accept') {
                    fetchProjects()
                }
            })
            .catch(err => {
                console.log(err)
                alert(err.response?.data?.message || `Failed to ${action} invite`)
            })
    }

    function createProject(e) {
        e.preventDefault()
        console.log({ projectName })

        axios.post('/projects/create', {
            name: projectName,
        })
            .then((res) => {
                console.log(res)
                setProject([...project, res.data.data]) // Accessing data nested property
                setIsModalOpen(false)
                setProjectName('')
            })
            .catch((error) => {
                console.log(error)
                alert(error.response?.data?.message || "Failed to create project")
            })
    }

    const handleLogout = () => {
        localStorage.removeItem('token')
        navigate('/login')
    }

    useEffect(() => {
        fetchProjects()
        fetchNotifications()

        // Poll for notifications every 30 seconds
        const interval = setInterval(fetchNotifications, 30000)
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="flex h-screen w-full bg-[#FAFAFA] font-sans selection:bg-blue-100">
            {/* Sidebar */}
            <aside className="hidden md:flex flex-col w-72 h-full bg-white border-r border-slate-200 flex-shrink-0">
                <div className="h-20 flex items-center px-8 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
                            <i className="ri-code-s-slash-line text-white text-xl font-bold"></i>
                        </div>
                        <span className="font-bold text-2xl text-slate-900 tracking-tight">IDE Cloud</span>
                    </div>
                </div>

                <div className="flex-grow p-6 space-y-8">
                    <section>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-4 ml-1">Main Menu</p>
                        <nav className="space-y-1">
                            <div
                                onClick={() => setActiveTab('Dashboard')}
                                className={`flex items-center gap-3 p-3 rounded-xl font-semibold transition-all group cursor-pointer
                                ${activeTab === 'Dashboard' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <i className={`ri-dashboard-line text-lg ${activeTab === 'Dashboard' ? 'scale-110' : 'group-hover:scale-110'}`}></i>
                                <span>Dashboard</span>
                            </div>
                            <div
                                onClick={() => setActiveTab('All Projects')}
                                className={`flex items-center gap-3 p-3 rounded-xl font-medium transition-all group cursor-pointer
                                ${activeTab === 'All Projects' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <i className={`ri-folder-6-line text-lg ${activeTab === 'All Projects' ? 'scale-110' : 'group-hover:scale-110'}`}></i>
                                <span>All Projects</span>
                            </div>
                            <div
                                onClick={() => setActiveTab('Statistics')}
                                className={`flex items-center gap-3 p-3 rounded-xl font-medium transition-all group cursor-pointer
                                ${activeTab === 'Statistics' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <i className={`ri-pie-chart-line text-lg ${activeTab === 'Statistics' ? 'scale-110' : 'group-hover:scale-110'}`}></i>
                                <span>Statistics</span>
                            </div>
                        </nav>
                    </section>

                    <section>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[2px] mb-4 ml-1">System</p>
                        <nav className="space-y-1">
                            <div
                                onClick={() => setActiveTab('Settings')}
                                className={`flex items-center gap-3 p-3 rounded-xl font-medium transition-all group cursor-pointer
                                ${activeTab === 'Settings' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <i className={`ri-settings-3-line text-lg ${activeTab === 'Settings' ? 'scale-110' : 'group-hover:scale-110'}`}></i>
                                <span>Settings</span>
                            </div>
                            <div
                                onClick={() => setActiveTab('Security')}
                                className={`flex items-center gap-3 p-3 rounded-xl font-medium transition-all group cursor-pointer
                                ${activeTab === 'Security' ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                            >
                                <i className={`ri-shield-user-line text-lg ${activeTab === 'Security' ? 'scale-110' : 'group-hover:scale-110'}`}></i>
                                <span>Security</span>
                            </div>
                        </nav>
                    </section>
                </div>

                <div className="p-6 m-4 bg-slate-50 rounded-2xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">
                            {user?.email?.[0].toUpperCase()}
                        </div>
                        <div className="flex-grow overflow-hidden">
                            <div className="font-bold text-slate-900 text-sm truncate">{user?.email?.split('@')[0]}</div>
                            <div className="text-[10px] text-slate-400 truncate">{user?.email}</div>
                        </div>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-grow flex flex-col h-full overflow-hidden">
                {/* Top Navigation Bar */}
                <header className="h-20 min-h-[80px] bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-10 z-20 sticky top-0">
                    <div className="flex-grow max-w-xl">
                        <div className="relative group">
                            <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search your projects..."
                                className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50 transition-all outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-6 ml-6">
                        <div className="flex items-center gap-2 p-2 px-3 bg-blue-50 text-blue-600 rounded-xl cursor-default">
                            <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
                            <span className="text-xs font-bold uppercase tracking-wider">Cloud Connected</span>
                        </div>
                        <div className="w-px h-6 bg-slate-200"></div>
                        <div className="relative">
                            <button
                                onClick={() => setShowNotifications(!showNotifications)}
                                className="relative w-10 h-10 rounded-xl hover:bg-slate-50 flex items-center justify-center transition-all group">
                                <i className="ri-notification-3-line text-xl text-slate-500 group-hover:text-blue-600"></i>
                                {notifications.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>}
                            </button>

                            {showNotifications && (
                                <div className="absolute right-0 mt-4 w-96 bg-white rounded-[32px] shadow-2xl border border-slate-100 p-6 z-50 animate-in slide-in-from-top-4 duration-300">
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Activities</h3>
                                        <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest">{notifications.length} Pending</span>
                                    </div>

                                    <div className="space-y-4 max-h-[400px] overflow-auto scrollbar-hide">
                                        {notifications.length > 0 ? (
                                            notifications.map((n) => (
                                                <div key={n._id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col gap-4">
                                                    <div className="flex items-start gap-4">
                                                        <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center text-blue-600 text-lg">
                                                            <i className="ri-folder-add-line"></i>
                                                        </div>
                                                        <div className="flex-grow">
                                                            <p className="text-sm font-bold text-slate-900">Invite to {n.project?.name}</p>
                                                            <p className="text-[10px] text-slate-400 font-medium">From {n.sender?.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => respondToInvite(n._id, 'accept')}
                                                            className="flex-grow py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all">
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() => respondToInvite(n._id, 'reject')}
                                                            className="flex-grow py-2.5 bg-white text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-slate-100 hover:bg-slate-100 transition-all">
                                                            Decline
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="py-12 flex flex-col items-center justify-center text-slate-300">
                                                <i className="ri-notification-off-line text-4xl mb-2"></i>
                                                <p className="text-xs font-bold uppercase tracking-widest">No pending invites</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                {/* Content Container */}
                <main className="flex-grow overflow-auto p-10 bg-[#FAFAFA]">
                    <div className="max-w-[1400px] mx-auto w-full">

                        {activeTab === 'Dashboard' && (
                            <>
                                {/* Welcome Header */}
                                <section className="mb-12 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div>
                                        <h1 className="text-4xl font-[900] text-slate-900 mb-2 tracking-tight">Dashboard</h1>
                                        <p className="text-slate-500 font-medium">Welcome back! You have <span className="font-bold text-blue-600 underline decoration-blue-100 underline-offset-4">{project.length} active</span> projects.</p>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl flex items-center gap-3 font-bold shadow-xl shadow-blue-200 transition-all hover:-translate-y-1 active:scale-95">
                                        <i className="ri-add-circle-line text-lg"></i>
                                        Create New Project
                                    </button>
                                </section>

                                {/* Quick Stats Placeholder */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-6 duration-700">
                                    <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50 group border-b-4 border-b-blue-500">
                                        <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 text-2xl mb-6 group-hover:scale-110 transition-transform">
                                            <i className="ri-folder-6-line"></i>
                                        </div>
                                        <div className="text-4xl font-black text-slate-900 mb-1">{project.length}</div>
                                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Projects</div>
                                    </div>
                                    <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50 group border-b-4 border-b-green-500">
                                        <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center text-green-600 text-2xl mb-6 group-hover:scale-110 transition-transform">
                                            <i className="ri-group-line"></i>
                                        </div>
                                        <div className="text-4xl font-black text-slate-900 mb-1">{project.reduce((acc, curr) => acc + curr.users.length, 0)}</div>
                                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">Collaborators</div>
                                    </div>
                                    <div className="p-8 bg-white rounded-[32px] border border-slate-100 shadow-sm transition-all hover:shadow-xl hover:shadow-slate-200/50 group border-b-4 border-b-orange-500">
                                        <div className="w-14 h-14 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600 text-2xl mb-6 group-hover:scale-110 transition-transform">
                                            <i className="ri-time-line"></i>
                                        </div>
                                        <div className="text-4xl font-black text-slate-900 mb-1">Active</div>
                                        <div className="text-sm font-bold text-slate-400 uppercase tracking-wider">System Status</div>
                                    </div>
                                </div>

                                {/* Projects Grid */}
                                <h2 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-3 px-2">
                                    Recent Projects
                                    <span className="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full uppercase tracking-widest">Newest First</span>
                                </h2>

                                <div className="projects grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                                    {project.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 4).map((p) => (
                                        <ProjectCard key={p._id} p={p} navigate={navigate} />
                                    ))}
                                </div>
                            </>
                        )}

                        {activeTab === 'All Projects' && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="mb-12">
                                    <h1 className="text-4xl font-[900] text-slate-900 mb-2 tracking-tight">All Projects</h1>
                                    <p className="text-slate-500 font-medium">Full list of your workspace collaborations.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
                                    {project.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())).map((p) => (
                                        <ProjectCard key={p._id} p={p} navigate={navigate} />
                                    ))}
                                </div>
                            </div>
                        )}

                        {activeTab === 'Settings' && (
                            <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="mb-12">
                                    <h1 className="text-4xl font-[900] text-slate-900 mb-2 tracking-tight">Settings</h1>
                                    <p className="text-slate-500 font-medium">Manage your account and preferences.</p>
                                </div>

                                <div className="bg-white rounded-[32px] border border-slate-100 p-8 shadow-sm space-y-8">
                                    <section className="flex items-center justify-between p-6 bg-slate-50 rounded-2xl border border-slate-100">
                                        <div className="flex items-center gap-4">
                                            <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-black">
                                                {user?.email?.[0].toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="text-lg font-bold text-slate-900">{user?.email?.split('@')[0]}</p>
                                                <p className="text-sm text-slate-500">{user?.email}</p>
                                            </div>
                                        </div>
                                        <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full uppercase tracking-widest border border-green-100">Online</span>
                                    </section>

                                    <div className="space-y-4">
                                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">Account Actions</h3>
                                        <button
                                            onClick={handleLogout}
                                            className="w-full flex items-center justify-between p-5 hover:bg-red-50 text-red-600 rounded-2xl border border-transparent hover:border-red-100 transition-all group"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                    <i className="ri-logout-box-r-line text-xl"></i>
                                                </div>
                                                <span className="font-bold">Logout session</span>
                                            </div>
                                            <i className="ri-arrow-right-s-line text-xl"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'Statistics' && (
                            <div className="flex flex-col items-center justify-center py-20 text-slate-300 animate-in fade-in duration-500">
                                <i className="ri-bar-chart-grouped-line text-8xl mb-6"></i>
                                <h1 className="text-2xl font-black text-slate-900 mb-2">Analytics</h1>
                                <p className="font-medium text-slate-500">Project statistics and activity logs coming soon.</p>
                            </div>
                        )}

                    </div>
                </main>
            </div>

            {/* Project Creation Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm z-50 p-6 animate-in fade-in duration-300">
                    <div className="bg-white p-10 rounded-[48px] shadow-2xl w-full max-w-xl border border-white relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-blue-600"></div>
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Create Workspace</h2>
                                <p className="text-slate-400 font-medium">Structure your new collaborative environment</p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all flex items-center justify-center">
                                <i className="ri-close-line text-2xl"></i>
                            </button>
                        </div>
                        <form onSubmit={createProject}>
                            <div className="mb-10">
                                <label className="block text-xs font-black text-slate-400 uppercase tracking-[2px] mb-4 ml-1">Project Identifier</label>
                                <div className="space-y-4">
                                    <input
                                        onChange={(e) => setProjectName(e.target.value)}
                                        value={projectName}
                                        placeholder="e.g. My Awesome IDE Project"
                                        type="text" className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-3xl text-lg font-bold placeholder:text-slate-300 focus:bg-white focus:border-blue-400 focus:ring-8 focus:ring-blue-50 outline-none transition-all shadow-inner" required />
                                    <div className="p-4 bg-blue-50 rounded-2xl flex items-start gap-4">
                                        <i className="ri-information-line text-blue-600 text-xl mt-0.5"></i>
                                        <p className="text-xs text-blue-700 leading-relaxed font-medium">Naming your project helps collaborators identify the workspace. You can invite others once the project is initialized.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button type="button" className="flex-grow py-5 text-slate-500 hover:text-slate-900 font-bold tracking-tight bg-slate-50 hover:bg-slate-100 rounded-3xl transition-all" onClick={() => setIsModalOpen(false)}>Cancel</button>
                                <button type="submit" className="flex-[2] py-5 bg-blue-600 hover:bg-blue-700 text-white rounded-3xl font-black tracking-tight shadow-xl shadow-blue-200 transition-all hover:-translate-y-1 active:scale-95">Initialise Project</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

const ProjectCard = ({ p, navigate }) => (
    <div key={p._id}
        onClick={() => {
            navigate(`/project`, {
                state: { project: p }
            })
        }}
        className="group relative bg-white border border-slate-100 p-8 rounded-[40px] shadow-sm hover:shadow-2xl hover:shadow-blue-900/10 cursor-pointer transition-all duration-500 hover:-translate-y-2 overflow-hidden flex flex-col justify-between h-[280px]">
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-bl-[80px] -mr-8 -mt-8 transition-transform group-hover:scale-150 duration-700"></div>

        <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white text-xl shadow-lg ring-4 ring-slate-50">
                    <i className="ri-code-s-slash-fill"></i>
                </div>
                <div className="flex -space-x-2">
                    {[...Array(Math.min(p.users.length, 3))].map((_, i) => (
                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-blue-100 flex items-center justify-center text-[10px] font-bold text-blue-600 shadow-sm relative z-20">
                            {i === 2 && p.users.length > 3 ? `+${p.users.length - 2}` : <i className="ri-user-line"></i>}
                        </div>
                    ))}
                </div>
            </div>
            <h2 className='font-black text-2xl text-slate-900 group-hover:text-blue-600 transition-colors duration-300 leading-tight mb-1'>{p.name}</h2>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest bg-slate-50 w-fit px-3 py-1.5 rounded-full border border-slate-100">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                {p.users.length} {p.users.length === 1 ? 'Dev' : 'Devs'}
            </div>
        </div>

        <div className="relative z-10 flex items-end justify-between">
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-[2px]">Workspace</span>
            <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300 transform translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 shadow-xl shadow-blue-200">
                <i className="ri-arrow-right-line text-lg"></i>
            </div>
        </div>
    </div>
)


export default Home
