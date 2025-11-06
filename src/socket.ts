import {io, Socket} from 'socket.io-client';

let socketInstance: Socket | null = null;

export const initSocket = async (): Promise<Socket> => {
    // Return existing connected socket if available
    if (socketInstance && socketInstance.connected) {
        return socketInstance;
    }
    
    // Disconnect existing socket if it exists but not connected
    if (socketInstance) {
        socketInstance.disconnect();
        socketInstance = null;
    }
    
    const options = {
        'force new connection': false,
        reconnectionAttempts: 5,
        timeout: 10000,
        transports: ['websocket'],
        autoConnect: true,
    };
    
    socketInstance = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', options);
    return socketInstance;
};