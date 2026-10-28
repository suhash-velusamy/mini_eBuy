require('dotenv').config();
const http = require('http');
const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { initSocket } = require('./sockets/socketManager');
const { initAuctionScheduler } = require('./services/auctionService');

// Import routes
const authRoutes = require('./routes/authRoutes');
const auctionRoutes = require('./routes/auctionRoutes');
const userRoutes = require('./routes/userRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const watchRoutes = require('./routes/watchRoutes');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5174',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
];

app.use(
  cors({
    origin: function (origin, callback) {
      // allow requests with no origin (e.g. mobile apps or curl)
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive for local campus development
      }
    },
    credentials: true,
  })
);

// Standard middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Static uploads serving
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/auctions', auctionRoutes);
app.use('/api/listings', auctionRoutes); // CampusBid alias
app.use('/api/users', userRoutes);
app.use('/api/me', userRoutes); // CampusBid alias
app.use('/api/notifications', notificationRoutes);
app.use('/api/watches', watchRoutes);

// Server time endpoint for clock synchronization
app.get('/api/time', (req, res) => {
  res.status(200).json({
    time: new Date().toISOString(),
    timestamp: Date.now(),
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'CampusBid / Campus Auction API server is operational',
    timestamp: new Date().toISOString(),
  });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);

  // Multer file upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size too large. Maximum allowed size is 5MB.',
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`,
    });
  }

  // Mongoose validation errors
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((val) => val.message);
    return res.status(400).json({
      success: false,
      message: messages.join('. '),
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

// Initialize Socket.IO
initSocket(server);

// Initialize node-cron for auction expiration
initAuctionScheduler();

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n[Server Error] Port ${PORT} (${HOST}) is already in use by another process.`);
    console.error(`To resolve this issue:`);
    console.error(`  1. Kill any existing process on port ${PORT}:`);
    console.error(`     Run: npm run free-port`);
    console.error(`     or in PowerShell: Get-Process node | Stop-Process -Force`);
    console.error(`  2. Or change PORT in backend/.env (e.g. PORT=5001).\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

server.listen(PORT, HOST, () => {
  console.log(`=========================================`);
  console.log(` Campus Auction Backend Server Running   `);
  console.log(` Port: ${PORT}                           `);
  console.log(` Host: ${HOST}                           `);
  console.log(` Local URL: http://localhost:${PORT}      `);
  console.log(` Client URL: ${process.env.CLIENT_URL || 'http://localhost:5174'} `);
  console.log(`=========================================`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down Campus Auction backend gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
