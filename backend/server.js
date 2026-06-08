const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Managers and routes
const CallSessionManager = require('./managers/CallSessionManager');
const {
  initializeCallRoutes,
  initializeWebSocketHandlers,
} = require('./routes/callRoutes');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Initialize WebSocket server
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:5173', // Vite dev server
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Initialize managers
const callSessionManager = new CallSessionManager(io);

// Routes
app.get('/', (req, res) => {
  res.send('AI Conversational Phone Agent Backend Running');
});

// Call management routes
const callRoutes = initializeCallRoutes(io, callSessionManager);
app.use('/api/call', callRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    activeSessions: callSessionManager.sessions.size,
  });
});

// Initialize WebSocket handlers
initializeWebSocketHandlers(io, callSessionManager);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 WebSocket server ready for connections`);
  console.log(`🤖 Agent: ${process.env.AGENT_NAME} (${process.env.AGENT_ROLE})`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };