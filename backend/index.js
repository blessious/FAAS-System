const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

const logger = require('./utils/logger');
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
  logger.sse('CONNECT', `User ${userId}`);
  return clientId;
}

function removeSSEClient(userId, clientId) {
  if (sseClients.has(userId)) {
    const userClients = sseClients.get(userId);
    const index = userClients.findIndex(c => c.id === clientId);
    if (index !== -1) {
      userClients.splice(index, 1);
      logger.sse('DISCONNECT', `User ${userId}`);
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
        logger.debug(`SSE broadcast error: ${error.message}`);
      }
    });
  });
  if (sentCount > 0) {
    logger.debug(`SSE broadcast '${event}' to ${sentCount} connections`);
  }
}

function sendToUserSSE(userId, event, data) {
  const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  let sentCount = 0;
  const userClients = sseClients.get(String(userId));
  if (userClients) {
    userClients.forEach(client => {
      try {
        client.res.write(message);
        sentCount++;
      } catch (error) {
        logger.debug(`SSE send error for user ${userId}: ${error.message}`);
      }
    });
  }
}

// Make functions available globally
global.broadcastSSE = broadcastSSE;
global.sendToUserSSE = sendToUserSSE;
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

// Custom HTTP logging - only log important requests (POST, PUT, DELETE, errors)
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    
    // Log only if: mutation request (POST/PUT/DELETE) OR error response
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method) || status >= 400) {
      const statusColor = status >= 400 ? '❌' : '✅';
      logger.debug(`${req.method} ${req.path} ${status} ${duration}ms`);
    }
  });
  next();
});

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

  // Get user ID from query param or header (simple version - adjust based on your auth)
  const userId = req.query.userId || req.headers['x-user-id'] || 'anonymous';

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
const notificationRoutes = require('./routes/notifications');
const chatRoutes = require('./routes/chat');

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/faas', faasRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/print', printRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/pdf', pdfViewerRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/chat', chatRoutes);

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
  logger.error('Unhandled error', err.message);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectDB();
    logger.success('Database connected');

    app.listen(PORT, '0.0.0.0', () => {
      logger.startup(`Server running on port ${PORT}`);
      logger.info(`CORS: enabled for all origins`);
      logger.info(`SSE: real-time updates enabled`);
      logger.info(`Access: http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error.message);
    process.exit(1);
  }
};

startServer();