import { Server } from 'socket.io';
import Room from '../models/Room.js';
import Message from '../models/Message.js';
import Drawing from '../models/Drawing.js';

export default (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket) => {
    // Join room
    socket.on('join-room', async ({ roomId, username }) => {
      socket.join(roomId);

      // Add user to room
      await Room.findOneAndUpdate(
        { roomId },
        { $addToSet: { activeUsers: username } },
        { upsert: true, new: true }
      );

      // Send updated user list
      const room = await Room.findOne({ roomId });
      io.to(roomId).emit('users-list', room.activeUsers);

      // Send history (messages + drawing)
      const [messages, drawing] = await Promise.all([
        Message.find({ roomId }).sort({ timestamp: 1 }),
        Drawing.findOne({ roomId }),
      ]);
      socket.emit('room-history', {
        messages,
        elements: drawing?.elements || [],
      });
    });

    // Drawing event
    socket.on('drawing', async (elements) => {
      const roomId = elements?.[0]?.roomId || socket.rooms.values().next().value;
      if (!roomId) return;
      await Drawing.findOneAndUpdate(
        { roomId },
        { elements },
        { upsert: true }
      );
      socket.to(roomId).emit('drawing', elements);
    });

    // Chat event
    socket.on('chat-message', async (message) => {
      const newMsg = new Message(message);
      await newMsg.save();
      io.to(message.roomId).emit('chat-message', newMsg);
    });

    // Clear canvas event
    socket.on('clear-canvas', async (roomId) => {
      await Drawing.findOneAndUpdate(
        { roomId },
        { elements: [] },
        { upsert: true }
      );
      io.to(roomId).emit('drawing', []);
    });

    // Handle disconnects
    socket.on('disconnecting', async () => {
      for (const roomId of socket.rooms) {
        if (roomId !== socket.id) {
          // Optionally: Remove user from room's activeUsers
        }
      }
    });
  });
};
