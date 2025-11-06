import express from 'express';
import http from 'http';
import path from 'path';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import ACTIONS from './actions.js';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('build'));
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

const userSocketMap = {};
const roomUserMap = {}; // Track users by room and username

function getAllConnectedClients(roomId) {
    // Map
    return Array.from(io.sockets.adapter.rooms.get(roomId) || []).map(
        (socketId) => {
            return {
                socketId,
                username: userSocketMap[socketId],
            };
        }
    );
}

function removeUserFromRoom(roomId, username, socketId) {
    if (roomUserMap[roomId]) {
        delete roomUserMap[roomId][username];
        if (Object.keys(roomUserMap[roomId]).length === 0) {
            delete roomUserMap[roomId];
        }
    }
}

io.on('connection', (socket) => {
    console.log('socket connected', socket.id);

    socket.on(ACTIONS.JOIN, ({roomId, username}) => {
        if (userSocketMap[socket.id]) {
            console.log(`Socket ${socket.id} attempted to join again`);
            return;
        }
        
        // Initialize room tracking if needed
        if (!roomUserMap[roomId]) {
            roomUserMap[roomId] = {};
        }
        
        // Check if username is already in the room with a different socket
        if (roomUserMap[roomId] && roomUserMap[roomId][username]) {
            console.log(`User ${username} already in room ${roomId} with socket ${roomUserMap[roomId][username]}, disconnecting old connection`);
            // Disconnect the old socket
            const oldSocketId = roomUserMap[roomId][username];
            if (io.sockets.sockets.get(oldSocketId)) {
                io.sockets.sockets.get(oldSocketId).disconnect();
            }
            delete userSocketMap[oldSocketId];
            delete roomUserMap[roomId][username];
        }
        
        console.log(`User ${username} (${socket.id}) joining room ${roomId}`);
        userSocketMap[socket.id] = username;
        
        // Ensure room exists before setting username
        if (!roomUserMap[roomId]) {
            roomUserMap[roomId] = {};
        }
        roomUserMap[roomId][username] = socket.id;
        socket.join(roomId);
        
        const clients = getAllConnectedClients(roomId);
        console.log(`Room ${roomId} now has ${clients.length} clients:`, clients.map(c => c.username));
        
        // Notify everyone in the room (including the new user) about the updated client list
        io.in(roomId).emit(ACTIONS.JOINED, {
            clients,
            username,
            socketId: socket.id,
        });
    });

    socket.on(ACTIONS.CODE_CHANGE, ({roomId, code}) => {
        socket.in(roomId).emit(ACTIONS.CODE_CHANGE, {code});
    });

    socket.on(ACTIONS.SYNC_CODE, ({socketId, code}) => {
        io.to(socketId).emit(ACTIONS.CODE_CHANGE, {code});
    });

    socket.on(ACTIONS.LANGUAGE_CHANGE, ({roomId, language}) => {
        socket.in(roomId).emit(ACTIONS.LANGUAGE_CHANGE, {language});
    });

    socket.on(ACTIONS.TEST_CASES_CHANGE, ({roomId, testCases}) => {
        socket.in(roomId).emit(ACTIONS.TEST_CASES_CHANGE, {testCases});
    });

    socket.on(ACTIONS.SYNC_LANGUAGE, ({socketId, language}) => {
        io.to(socketId).emit(ACTIONS.LANGUAGE_CHANGE, {language});
    });

    socket.on(ACTIONS.SYNC_TEST_CASES, ({socketId, testCases}) => {
        io.to(socketId).emit(ACTIONS.TEST_CASES_CHANGE, {testCases});
    });

    socket.on('disconnecting', () => {
        const rooms = [...socket.rooms];
        const username = userSocketMap[socket.id];
        
        rooms.forEach((roomId) => {
            socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
                socketId: socket.id,
                username: username,
            });
            
            // Clean up room tracking
            removeUserFromRoom(roomId, username, socket.id);
        });
        
        delete userSocketMap[socket.id];
        socket.leave();
    });
});

// Serve response in production
app.get('/', (req, res) => {
    const htmlContent = '<h1>Welcome to the code editor server</h1>';
    res.setHeader('Content-Type', 'text/html');
    res.send(htmlContent);
});

const PORT = process.env.SERVER_PORT || 5000;
server.listen(PORT, () => console.log(`Listening on port ${PORT}`));