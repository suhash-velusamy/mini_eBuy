const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io = null;

const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
      methods: ['GET', 'POST'],
    },
  });

  // Socket authentication middleware
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');

      if (token) {
        try {
          const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET || 'campus_auction_default_secret_key_2026'
          );
          const user = await User.findById(decoded.id).select('-passwordHash');
          if (user) {
            socket.user = user;
          }
        } catch (err) {
          // Token invalid: allow connection as guest
          socket.user = null;
        }
      } else {
        socket.user = null;
      }
      next();
    } catch (err) {
      next();
    }
  });

  io.on('connection', (socket) => {
    // If authenticated, join user's private notification room
    if (socket.user) {
      const userRoom = `user:${socket.user._id.toString()}`;
      socket.join(userRoom);
    }

    // Client requests to join an auction room
    socket.on('join:auction', (auctionId) => {
      if (auctionId) {
        socket.join(`auction:${auctionId}`);
      }
    });

    // Client requests to leave an auction room
    socket.on('leave:auction', (auctionId) => {
      if (auctionId) {
        socket.leave(`auction:${auctionId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean up automatically handled by socket.io
    });
  });

  return io;
};

const getIO = () => {
  return io;
};

// Emit public update to everyone in the auction room
const emitToAuction = (auctionId, event, data) => {
  if (io) {
    io.to(`auction:${auctionId}`).emit(event, data);
  }
};

// Emit private notification/message to a specific user
const emitToUser = (userId, event, data) => {
  if (io && userId) {
    io.to(`user:${userId.toString()}`).emit(event, data);
  }
};

module.exports = {
  initSocket,
  getIO,
  emitToAuction,
  emitToUser,
};
