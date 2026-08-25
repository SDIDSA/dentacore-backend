const { Server } = require('socket.io');
const logger = require('./config/logger');

let io = null;

function initSocket(server) {
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()) : ['http://localhost:4000', 'http://localhost:5173'],
      credentials: true,
    },
    path: '/ws',
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.tenantId = decoded.tenant_id;
      socket.join(`tenant:${decoded.tenant_id}`);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('WS client connected', { userId: socket.userId, tenantId: socket.tenantId });

    socket.on('subscribe:patient', (patientId) => {
      if (patientId) socket.join(`patient:${socket.tenantId}:${patientId}`);
    });

    socket.on('unsubscribe:patient', (patientId) => {
      if (patientId) socket.leave(`patient:${socket.tenantId}:${patientId}`);
    });

    socket.on('disconnect', () => {
      logger.info('WS client disconnected', { userId: socket.userId });
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error('Socket.io not initialized');
  return io;
}

function emitToTenant(tenantId, event, data) {
  if (io) {
    io.to(`tenant:${tenantId}`).emit(event, data);
  }
}

function emitToPatient(tenantId, patientId, event, data) {
  if (io) {
    io.to(`patient:${tenantId}:${patientId}`).emit(event, data);
  }
}

module.exports = { initSocket, getIO, emitToTenant, emitToPatient };
