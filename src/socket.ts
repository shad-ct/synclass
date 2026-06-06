/**
 * @fileoverview Socket.io singleton client.
 * Import `socket` anywhere in the frontend to use the shared connection.
 * The socket does NOT auto-connect — call socket.connect() explicitly after
 * the user is identified.
 */
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3001';

export const socket = io(SERVER_URL, {
  autoConnect: false,       // Connect manually to avoid premature connections
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 10000,
  withCredentials: true,
});

export default socket;
