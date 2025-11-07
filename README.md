# CodeSync

A real-time collaborative code editor with built-in code execution and testing capabilities.

## Demo Video

[Watch Demo Video](https://drive.google.com/file/d/1esT3lopXhMY4LuoESsTMF-LigJJs34ro/view?usp=sharing)

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd CodeSync
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env` file in the root directory:

```env
VITE_BACKEND_URL=http://localhost:5000
VITE_RAPID_API_ONECOMPILER_KEY=your_rapid_api_key_here
SERVER_PORT=5000
```

4. Start the development server:

```bash
npm run dev
```

5. In a separate terminal, start the Socket.IO server:

```bash
node server.js
```

6. Open your browser and navigate to:

```
http://localhost:5173
```

## Tech Stack

### Frontend

- React
- TypeScript
- Recoil
- CodeMirror
- Socket.IO Client
- React Router
- React Hot Toast
- Vite

### Backend

- Node.js
- Express
- Socket.IO

## Usage

### Creating a Room

1. Enter your username on the home page
2. Click "Create New Room" to generate a unique room ID
3. Share the room ID with collaborators

### Joining a Room

1. Enter your username
2. Paste the room ID
3. Click "Join Room"

### Writing Code

1. Select your programming language from the dropdown
2. Write or edit code in the editor
3. Changes sync automatically with all users in the room

### Running Code

1. Click "Run Code" to execute your program
2. View output in the execution panel below
3. Check for errors and execution time

### Creating Test Cases

1. Switch to "Tests" mode in the execution panel
2. Click "Show" to expand the test case creator
3. Add test cases with inputs and expected outputs
4. Click "Run Custom Tests" to execute all tests
5. Test cases sync across all users in the room

## Configuration

### Environment Variables

- `VITE_BACKEND_URL`: Backend server URL (default: http://localhost:5000)
- `VITE_RAPID_API_ONECOMPILER_KEY`: RapidAPI key for code execution service
- `SERVER_PORT`: Server port (default: 5000)

### Supported Languages

- JavaScript: Function-based testing
- Python: Program I/O testing
- Java: Program I/O testing
