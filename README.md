# 💻 Real-Time Collaborative Cloud IDE

A powerful, web-based collaborative IDE that brings the full developer experience to the browser. Build, chat, and debug in real-time with your team.

---

## 🚀 Key Features

- **⚡ Interactive Terminal**: Full terminal experience powered by `xterm.js` and **WebContainers API**. Run `node`, `npm`, and other commands directly in your browser.
- **✍️ Real-time Collaboration**: Live code synchronization and remote cursor presence using **Socket.IO** and **CodeMirror 6**.
- **🧠 AI Coding Assistant**: Embedded **Gemini AI** flash assistant to help with code generation, debugging, and explanations.
- **📁 Real-time File System**: Dynamic file tree management with automatic synchronization between the editor and the WebContainer environment.
- **💬 Integrated Team Chat**: Communicate with your team via in-room chat for seamless pair programming.
- **🎨 Modern Dark UI**: Premium, high-performance interface with JetBrains Mono font and responsive layouts.

---

## 🖥️ Tech Stack

**Frontend**  
- **React + Vite**: Fast, modern UI library and build tool.
- **CodeMirror 6**: Extensible code editor with custom collaboration extensions.
- **xterm.js**: Industry-standard terminal emulator with fit and web-links addons.
- **WebContainers API**: Browser-based Node.js runtime for running commands locally.
- **Tailwind CSS**: For consistent, high-performance styling.

**Backend**  
- **Node.js + Express**: Scalable server-side infrastructure.
- **Socket.IO**: Real-time, bi-directional event-based communication.
- **MongoDB + Mongoose**: For project, user, and file system persistence.

**AI Integration**
- **Google Gemini Pro**: Integrated through Flash 1.5 for low-latency coding assistance.

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- MongoDB instance (Local or Atlas)
- Gemini API Key

### Backend Setup
1. `cd backend`
2. `npm install`
3. Create a `.env` file:
   ```env
   PORT=3000
   MONGO_URI=your_mongodb_uri
   JWT_SECRET=your_jwt_secret
   ```
4. `npm run dev`

### Frontend Setup
1. `cd frontend`
2. `npm install`
3. Create a `.env` file:
   ```env
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_API_URL=http://localhost:3000
   ```
4. `npm run dev`

---

## 🤝 Contributing

This project is built for high-performance collaboration. Feel free to explore the codebase and submit PRs for new features or improvements.
