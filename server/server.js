/**
 * @fileoverview SynClass Presenter Command Center — Backend Entry Point.
 *
 * Boots Express + Socket.io, connects to MongoDB, mounts REST routes,
 * serves static file uploads, and initializes the socket controller.
 *
 * Start with: node server.js (or nodemon server.js for dev)
 */
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const sessionRoutes = require('./routes/session.routes');
const resourceRoutes = require('./routes/resource.routes');
const quizRoutes = require('./routes/quiz.routes');
const { initSocketController } = require('./socket/socketController');

const PORT = process.env.PORT || 3001;
const normalizeOrigin = (value) => {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/$/, '');
  }
};

const FRONTEND_URL = normalizeOrigin(
  process.env.FRONTEND_URL || process.env.CLIENT_URL || 'https://synclass.netlify.app'
);
const LOCAL_ORIGINS = ['http://localhost:5173', 'http://localhost:5174'];
const ALLOWED_ORIGINS = [...new Set([FRONTEND_URL, ...LOCAL_ORIGINS].filter(Boolean))];

// ─────────────────────────────────────────────────────────
// App Bootstrap
// ─────────────────────────────────────────────────────────
const app = express();
const httpServer = http.createServer(app);

// Socket.io with CORS configured for the deployed frontend and local dev
const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 30 * 1000, // 30 seconds
  },
});

// ─────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use(
  '/uploads',
  express.static(path.join(__dirname, 'uploads'), {
    dotfiles: 'ignore',
    maxAge: '1d',
  })
);

// ─────────────────────────────────────────────────────────
// REST API Routes
// ─────────────────────────────────────────────────────────
app.use('/api/sessions', sessionRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/quizzes', quizRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 fallback for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─────────────────────────────────────────────────────────
// Socket.io Controller
// ─────────────────────────────────────────────────────────
initSocketController(io);

// ─────────────────────────────────────────────────────────
// Server Start
// ─────────────────────────────────────────────────────────
const startServer = async () => {
  await connectDB();
  httpServer.listen(PORT, () => {
    console.log(`\n🚀 SynClass Server running on http://localhost:${PORT}`);
    console.log(`   Allowed frontend origins: ${ALLOWED_ORIGINS.join(', ')}`);
    console.log(`   MongoDB: ${process.env.MONGO_URI || 'mongodb://localhost:27017/synclass'}\n`);
  });
};

startServer();
