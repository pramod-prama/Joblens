# 🧠 React + Node + Ollama AI Project

This project is a full-stack web application built using **React.js** for the frontend and **Node.js** for the backend, with **Ollama** integrated for local AI model inference.

---

## 📁 Project Structure

root/
│
├── backend/ # Backend (Node.js + Express + Ollama)
│ ├── server.js # Main server file
│ ├── package.json # Backend dependencies
│ ├── .env # Environment variables (Ollama, ports, etc.)
│ └── ... # Other backend files
│
├── frontend/ # Frontend (React.js)
│ ├── src/
│ │ ├── components/ # React components
│ │ ├── pages/ # Page-level components
│ │ ├── App.js # Root component
│ │ └── index.js # Entry point
│ ├── package.json # Frontend dependencies
│ └── ...
│
└── README.md # Project documentation

---

## ⚙️ Tech Stack

| Layer           | Technology       | Description                             |
| --------------- | ---------------- | --------------------------------------- |
| Frontend        | React.js         | Dynamic, component-based UI             |
| Backend         | Node.js, Express | RESTful API and server logic            |
| AI Integration  | Ollama           | Local AI model inference using Node SDK |
| Package Manager | npm / yarn       | Dependency management                   |

---

## 🚀 Features

- 🧩 Modular full-stack architecture (frontend + backend)
- 🤖 AI-powered responses using **Ollama**
- 🔗 REST API connection between frontend and backend
- ⚡ Fast local inference — no external API needed
- 🧠 Easy model configuration and swapping

---

## 🧰 Prerequisites

Before running the project, ensure you have:

- **Node.js** (v18+)
- **npm** or **yarn**
- **Ollama** installed locally  
  → [Download Ollama](https://ollama.com/download)

---

## 🔧 Setup Instructions

### Setup the Backend

cd backend
npm install

### Start the backend server:

npm start

## Setup the Frontend

cd ../frontend
npm install
npm start\

## Start Ollama Server

Ensure Ollama is running locally:

ollama serve

(Optional) You can also pull a model manually:

ollama pull qwen2.5:3b

### Create a .env file inside the backend/ folder and add:

PORT=5000
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
