import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Room from './models/Room.js';
import { generateRoomId, validateRoomId, generateUserId } from './utils/helpers.js';

dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL || "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:5175"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

app.use(cors({
  origin: [
    process.env.CLIENT_URL || "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175"
  ],
  credentials: true
}));
app.use(express.json());

// Store active rooms and users in memory for real-time operations
const activeRooms = new Map();
const activeUsers = new Map();
let useDatabase = false;

// MongoDB connection with fallback
const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/whiteboard', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    });
    console.log('Connected to MongoDB');
    useDatabase = true;
  } catch (error) {
    console.log('MongoDB not available, using in-memory storage');
    console.log('To enable database persistence, start MongoDB or set MONGODB_URI');
    useDatabase = false;
  }
};

connectToMongoDB();

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentRoomId = null;
  let currentUsername = null;
  let currentUserId = null;

  // Create room
  socket.on('create-room', async (data) => {
    try {
      const { roomId, username, roomType = 'public' } = data;
      
      // Check if room already exists
      let existingRoom = null;
      if (useDatabase) {
        existingRoom = await Room.findOne({ roomId });
      } else {
        existingRoom = activeRooms.get(roomId);
      }
      
      if (existingRoom) {
        socket.emit('error', { message: 'Room already exists' });
        return;
      }

      // Create room in database if available
      if (useDatabase) {
        const room = new Room({
          roomId,
          creatorId: socket.id,
          roomType,
          createdAt: new Date(),
          canvasData: null,
          chatMessages: []
        });
        await room.save();
      }

      // Add room to active rooms
      activeRooms.set(roomId, {
        roomId,
        creatorId: socket.id,
        roomType,
        users: [],
        canvasData: null,
        chatMessages: []
      });

      // Join the room
      socket.join(roomId);
      currentRoomId = roomId;
      currentUsername = username;
      currentUserId = generateUserId();
      
      // Add user to room
      const user = {
        id: socket.id,
        userId: currentUserId,
        username,
        isCreator: true,
        permission: 'edit',
        isOnline: true,
        joinedAt: new Date().toISOString()
      };

      activeUsers.set(socket.id, { ...user, roomId });
      activeRooms.get(roomId).users.push(user);

      socket.emit('room-created', {
        roomId,
        room: activeRooms.get(roomId),
        users: activeRooms.get(roomId).users,
        permission: 'edit'
      });

      console.log(`Room ${roomId} created by ${username}`);
    } catch (error) {
      console.error('Error creating room:', error);
      socket.emit('error', { message: 'Failed to create room' });
    }
  });

  // Handle join room requests
  socket.on('join-room', async ({ roomId, username }) => {
    try {
      currentRoomId = roomId;
      currentUsername = username;
      currentUserId = generateUserId();
      
      console.log(`${username} (${socket.id}) joining room ${roomId}`);
      
      let room = activeRooms.get(roomId);
      
      // If room doesn't exist, check database or create placeholder
      if (!room) {
        if (useDatabase) {
          const dbRoom = await Room.findOne({ roomId });
          if (!dbRoom) {
            socket.emit('room-not-found', { message: 'Room not found' });
            return;
          }

          // Restore room to active rooms
          room = {
            roomId: dbRoom.roomId,
            creatorId: dbRoom.creatorId,
            roomType: dbRoom.roomType,
            users: [],
            canvasData: dbRoom.canvasData,
            chatMessages: dbRoom.chatMessages || [],
            joinRequests: [] // Add join requests array
          };
          activeRooms.set(roomId, room);
          console.log(`Restored room ${roomId} from database`);
        } else {
          // For in-memory storage, if room doesn't exist, it means the creator hasn't created it yet
          socket.emit('room-not-found', { message: 'Room not found. Please ask the room creator to create the room first.' });
          return;
        }
      } else {
        // Ensure existing room has all required properties
        if (!room.joinRequests) {
          room.joinRequests = [];
        }
        if (!room.chatMessages) {
          room.chatMessages = [];
        }
        if (!room.canvasData) {
          room.canvasData = [];
        }
      }

      // If user is the creator, allow immediate join
      if (room.creatorId && socket.id === room.creatorId) {
        const user = {
          id: socket.id,
          userId: currentUserId,
          username,
          isCreator: true,
          permission: 'edit',
          isOnline: true,
          joinedAt: new Date().toISOString()
        };

        activeUsers.set(socket.id, { ...user, roomId });
        room.users.push(user);
        
        socket.join(roomId);
        
        console.log(`Room ${roomId} now has ${room.users.length} users`);
        
        // Send current state to new user
        socket.emit('room-joined', {
          room,
          users: room.users,
          permission: user.permission
        });
        
        socket.emit('drawing', room.canvasData || []);
        socket.emit('chat-history', room.chatMessages.slice(-50));
        
        // Notify others about new user
        socket.to(roomId).emit('user-joined', {
          user,
          users: room.users
        });
        
        console.log(`${username} (Creator) successfully joined room ${roomId}`);
        return;
      }

      // For non-creators, create a join request
      const joinRequest = {
        id: socket.id,
        userId: currentUserId,
        username,
        requestedAt: new Date().toISOString(),
        status: 'pending'
      };

      // Ensure joinRequests array exists
      if (!room.joinRequests) {
        room.joinRequests = [];
      }

      room.joinRequests.push(joinRequest);
      
      // Notify the creator about the join request
      const creator = room.users.find(u => u.isCreator);
      if (creator) {
        io.to(creator.id).emit('join-request', {
          request: joinRequest,
          roomId
        });
        
        // Send pending status to the requesting user
        socket.emit('join-request-pending', {
          message: 'Join request sent to room leader. Waiting for approval...',
          roomId
        });
        
        console.log(`Join request from ${username} sent to room ${roomId} leader`);
      } else {
        // If no creator is currently in the room, send a message to the user
        socket.emit('join-request-pending', {
          message: 'Room creator is not currently online. Please try again later.',
          roomId
        });
        console.log(`${username} tried to join room ${roomId} but creator is offline`);
      }
      
    } catch (error) {
      console.error('Error processing join request:', error);
      socket.emit('error', { message: 'Failed to process join request' });
    }
  });

  // Handle join request approval/rejection
  socket.on('respond-join-request', ({ requestId, approved, roomId }) => {
    try {
      const room = activeRooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }

      // Ensure joinRequests array exists
      if (!room.joinRequests) {
        room.joinRequests = [];
      }

      // Check if the responder is the creator
      const responder = room.users.find(u => u.id === socket.id);
      if (!responder || !responder.isCreator) {
        socket.emit('error', { message: 'Only room leader can approve/reject join requests' });
        return;
      }

      const request = room.joinRequests.find(r => r.id === requestId);
      if (!request) {
        socket.emit('error', { message: 'Join request not found' });
        return;
      }

      // Update request status
      request.status = approved ? 'approved' : 'rejected';
      request.respondedBy = socket.id;
      request.respondedAt = new Date().toISOString();

      if (approved) {
        // Add user to room
        const user = {
          id: request.id,
          userId: request.userId,
          username: request.username,
          isCreator: false,
          permission: 'edit',
          isOnline: true,
          joinedAt: new Date().toISOString()
        };

        room.users.push(user);
        
        // Get the requesting user's socket
        const requestingSocket = io.sockets.sockets.get(request.id);
        if (requestingSocket) {
          requestingSocket.join(roomId);
          
          // Send approval to requesting user
          requestingSocket.emit('join-request-approved', {
            room,
            users: room.users,
            permission: user.permission
          });
          
          requestingSocket.emit('drawing', room.canvasData || []);
          requestingSocket.emit('chat-history', room.chatMessages.slice(-50));
          
          // Update their current room info
          requestingSocket.currentRoomId = roomId;
          requestingSocket.currentUsername = request.username;
          requestingSocket.currentUserId = request.userId;
          
          activeUsers.set(request.id, { ...user, roomId });
        }
        
        // Notify all users in room about new user
        io.to(roomId).emit('user-joined', {
          user,
          users: room.users
        });
        
        console.log(`${request.username} approved to join room ${roomId}`);
      } else {
        // Notify requesting user about rejection
        const requestingSocket = io.sockets.sockets.get(request.id);
        if (requestingSocket) {
          requestingSocket.emit('join-request-rejected', {
            message: 'Your join request was rejected by the room leader.',
            roomId
          });
        }
        
        console.log(`${request.username} rejected from room ${roomId}`);
      }

      // Remove the request from pending list
      room.joinRequests = room.joinRequests.filter(r => r.id !== requestId);
      
      // Notify creator about the response
      socket.emit('join-request-responded', {
        requestId,
        approved,
        username: request.username
      });
      
    } catch (error) {
      console.error('Error responding to join request:', error);
      socket.emit('error', { message: 'Failed to respond to join request' });
    }
  });

  // Handle drawing updates
  socket.on('drawing', (elements) => {
    if (!currentRoomId) return;
    
    const room = activeRooms.get(currentRoomId);
    if (room) {
      room.canvasData = elements;
      socket.to(currentRoomId).emit('drawing', elements);
    }
  });

  // Handle canvas clearing
  socket.on('clear-canvas', async () => {
    if (!currentRoomId) return;
    
    const room = activeRooms.get(currentRoomId);
    if (room) {
      room.canvasData = [];
      
      // Update database if available
      if (useDatabase) {
        try {
          await Room.findOneAndUpdate(
            { roomId: currentRoomId },
            { canvasData: [] }
          );
        } catch (error) {
          console.error('Error clearing canvas in database:', error);
        }
      }
      
      io.to(currentRoomId).emit('clear-canvas');
      console.log(`Canvas cleared in room ${currentRoomId} by ${currentUsername}`);
    }
  });

  // Handle chat messages
  socket.on('chat-message', async (message) => {
    if (!currentRoomId) return;
    
    const room = activeRooms.get(currentRoomId);
    if (room) {
      // Add timestamp if not provided
      if (!message.timestamp) {
        message.timestamp = new Date().toLocaleTimeString();
      }
      
      // Add message to room history
      room.chatMessages.push(message);
      
      // Keep only last 100 messages to prevent memory issues
      if (room.chatMessages.length > 100) {
        room.chatMessages = room.chatMessages.slice(-100);
      }
      
      console.log(`Chat message in room ${currentRoomId}: ${currentUsername}: ${message.message}`);
      
      // Save to database if available
      if (useDatabase) {
        try {
          await Room.findOneAndUpdate(
            { roomId: currentRoomId },
            { 
              chatMessages: room.chatMessages,
              lastActivity: new Date()
            }
          );
        } catch (error) {
          console.error('Error saving chat message to database:', error);
        }
      }
      
      // Broadcast to all users in the room
      io.to(currentRoomId).emit('chat-message', message);
    }
  });

  // Handle typing indicators
  socket.on('user-typing', (data) => {
    if (!currentRoomId) return;
    
    console.log(`Typing indicator in room ${currentRoomId}: ${currentUsername} ${data.isTyping ? 'started' : 'stopped'} typing`);
    
    // Broadcast typing status to other users in the room
    socket.to(currentRoomId).emit('user-typing', {
      username: currentUsername,
      isTyping: data.isTyping
    });
  });

  // Handle canvas state updates for persistence
  socket.on('canvas-update', async (data) => {
    if (!currentRoomId) return;
    
    const room = activeRooms.get(currentRoomId);
    if (room) {
      room.canvasData = data.canvasData;
      
      // Save to database if available
      if (useDatabase) {
        try {
          await Room.findOneAndUpdate(
            { roomId: currentRoomId },
            { 
              canvasData: data.canvasData,
              lastActivity: new Date()
            }
          );
        } catch (error) {
          console.error('Error saving canvas data:', error);
        }
      }
      
      // Broadcast to other users
      socket.to(currentRoomId).emit('canvas-data', data.canvasData);
    }
  });

  // Handle disconnections
  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    if (!currentRoomId) return;
    
    const room = activeRooms.get(currentRoomId);
    if (room && room.users.some(u => u.id === socket.id)) {
      const user = room.users.find(u => u.id === socket.id);
      room.users = room.users.filter(u => u.id !== socket.id);
      
      console.log(`${user?.username} left room ${currentRoomId}`);
      
      // Notify remaining users
      socket.to(currentRoomId).emit('user-left', {
        userId: socket.id,
        users: room.users
      });
      
      // If room is empty, remove it from active rooms but keep in database
      if (room.users.length === 0) {
        activeRooms.delete(currentRoomId);
        console.log(`Room ${currentRoomId} removed from active rooms (no users left)`);
      }
    }
    
    activeUsers.delete(socket.id);
  });

  // Handle errors
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    rooms: activeRooms.size,
    totalUsers: Array.from(activeRooms.values()).reduce((sum, room) => sum + room.users.length, 0),
    timestamp: new Date().toISOString(),
    database: useDatabase ? 'connected' : 'in-memory'
  });
});

// API endpoint to get room info
app.get('/api/rooms/:roomId', async (req, res) => {
  try {
    const { roomId } = req.params;
    
    if (!validateRoomId(roomId)) {
      return res.status(400).json({ error: 'Invalid room ID format' });
    }
    
    let room = null;
    if (useDatabase) {
      room = await Room.findOne({ roomId });
    }
    
    if (!room && !activeRooms.has(roomId)) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const activeRoom = activeRooms.get(roomId);
    
    res.json({
      roomId: roomId,
      roomType: room?.roomType || activeRoom?.roomType || 'public',
      createdAt: room?.createdAt || new Date(),
      lastActivity: room?.lastActivity || new Date(),
      activeUsers: activeRoom?.users.length || 0,
      hasCanvasData: !!(room?.canvasData || activeRoom?.canvasData),
      chatMessageCount: (room?.chatMessages?.length || activeRoom?.chatMessages?.length) || 0
    });
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`CORS origin: ${process.env.CLIENT_URL || "http://localhost:5173"}`);
  console.log(`Storage: ${useDatabase ? 'MongoDB' : 'In-memory'}`);
});
