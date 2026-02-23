const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const { connectDB } = require('./utils/database');

const app = express();

// ============================================
// REAL-TIME SSE SETUP
// ============================================
const sseClients = new Map(); // userId -> [{ id, res }]

function addSSEClient(userId, res) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, []);
  }
  const clientId = Date.now();
  sseClients.get(userId).push({ id: clientId, res });
  console.log(`✅ SSE Client connected: User ${userId}, Client ${clientId}`);
  return clientId;
}

function removeSSEClient(userId, clientId) {
  if (sseClients.has(userId)) {
    const userClients = sseClients.get(userId);
    const index = userClients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      userClients.splice(index, 1);
      console.log(`❌ SSE Client disconnected: User ${userId}, Client ${clientId}`);
    }
    if (userClients.length === 0) {
      sseClients.delete(userId);
    }
  }
}

function broadcastSSE(event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sentCount = 0;
  sseClients.forEach((userClients) => {
    userClients.forEach(client => {
      try {
        client.res.write(message);
        sentCount++;
      } catch (error) {
        console.error('Error broadcasting SSE:', error);
      }
    });
  });
  console.log(`📡 Broadcast '${event}' to ${sentCount} connections`);
}

// Make broadcast function available globally
global.broadcastSSE = broadcastSSE;
// ============================================

// Middleware
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.sendStatus(200);
});

// ⚠️ CHANGED: Disabled CSP and Frameguard to allow iframe embedding from different ports/IPs
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    frameguard: false, // Allow iframe embedding
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Static files
app.use('/uploads', express.static('uploads'));
app.use('/pdfjs', express.static('pdfjs'));
app.use('/web', express.static('pdfjs'));

// ============================================
// SSE ENDPOINT - Real-time Updates
// ============================================
app.get('/api/events/stream', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Get user ID from auth header (simple version - adjust based on your auth)
  const userId = req.headers['x-user-id'] || 1; // Default to user 1 if no auth

  // Send initial connection message
  res.write(`event: connected\ndata: ${JSON.stringify({
    message: 'Connected to real-time updates',
    userId,
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Add client to active connections
  const clientId = addSSEClient(userId, res);

  // Send heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`: heartbeat\n\n`);
    } catch (error) {
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval);
    removeSSEClient(userId, clientId);
  });
});
// ============================================

// ✅ IMPORT ROUTES HERE (after app is initialized)
const authRoutes = require('./routes/auth');
const faasRoutes = require('./routes/faas');
const approvalRoutes = require('./routes/approvals');
const printRoutes = require('./routes/print');
const dashboardRoutes = require('./routes/dashboard');
const pdfViewerRoutes = require('./routes/pdfViewer');
const usersRoutes = require('./routes/users');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/faas', faasRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/print', printRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pdf', pdfViewerRoutes);
app.use('/api/users', usersRoutes);

// File serving routes (add these BEFORE the health check)
const path = require('path');
const fs = require('fs');

app.get('/api/files/pdf/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const pythonDir = path.resolve(__dirname, './python');
    const pdfDir = path.join(pythonDir, 'generated/generated-pdf');
    const filePath = path.join(pdfDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'PDF not found' });
    }

    const stat = fs.statSync(filePath);

    // ⚠️ CHANGED: Added headers to allow iframe embedding
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    res.setHeader('Cache-Control', 'no-cache');
    // Remove headers that block iframes
    res.removeHeader('Content-Security-Policy');
    res.removeHeader('X-Frame-Options');

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

  } catch (error) {
    res.status(500).json({ error: 'Failed to serve PDF' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    allowedOrigins: 'all',
    sse: 'enabled'
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    console.log('✅ Database connected successfully');

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🌐 CORS enabled for ALL origins`);
      console.log(`📡 SSE real-time updates enabled`);
      console.log(`📡 Access via:`);
      console.log(`   http://localhost:${PORT}`);
      console.log(`   http://<your-ip>:${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();  