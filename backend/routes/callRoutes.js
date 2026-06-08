const express = require('express');
const router = express.Router();

/**
 * Initialize call routes with WebSocket support
 */
function initializeCallRoutes(io, callSessionManager) {
  /**
   * POST /api/call/initiate
   * Initiate new phone call session
   */
  router.post('/initiate', async (req, res) => {
    try {
      const { clientData } = req.body;

      const sessionId = await callSessionManager.createSession(clientData);

      res.json({
        success: true,
        sessionId,
        message: 'Call session initiated',
      });
    } catch (error) {
      console.error('Error initiating call:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/call/:sessionId/message
   * Send text message to agent
   */
  router.post('/:sessionId/message', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { message } = req.body;

      const result = await callSessionManager.processUserMessage(
        sessionId,
        message
      );

      if (!result) {
        return res.status(400).json({
          success: false,
          error: 'Session not found',
        });
      }

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error('Error processing message:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * POST /api/call/:sessionId/end
   * End call session
   */
  router.post('/:sessionId/end', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { reason } = req.body;

      const result = await callSessionManager.endSession(
        sessionId,
        reason || 'user_ended'
      );

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      console.error('Error ending call:', error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  });

  /**
   * GET /api/call/:sessionId/stats
   * Get session statistics
   */
  router.get('/:sessionId/stats', (req, res) => {
    const { sessionId } = req.params;
    const stats = callSessionManager.getSessionStats(sessionId);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Session not found',
      });
    }

    res.json({
      success: true,
      stats,
    });
  });

  return router;
}

/**
 * Initialize WebSocket event handlers
 */
function initializeWebSocketHandlers(io, callSessionManager) {
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    /**
     * Join call session room
     */
    socket.on('join-session', (data) => {
      const { sessionId } = data;
      socket.join(sessionId);
      console.log(`Client ${socket.id} joined session ${sessionId}`);

      socket.emit('session-joined', {
        sessionId,
        status: 'ready',
      });
    });

    /**
     * Receive audio chunk from client
     */
    socket.on('audio-chunk', async (data) => {
      const { sessionId, audioData } = data;

      try {
        // Convert base64 to buffer
        const audioBuffer = Buffer.from(audioData, 'base64');

        // Process audio
        await callSessionManager.processUserAudio(sessionId, audioBuffer);
      } catch (error) {
        console.error('Error processing audio chunk:', error);
        socket.emit('error', {
          message: 'Error processing audio',
        });
      }
    });

    /**
     * User interrupted agent (barge-in)
     */
    socket.on('barge-in', (data) => {
      const { sessionId } = data;
      callSessionManager.handleInterruption(sessionId);

      io.to(sessionId).emit('interruption', {
        message: 'User interrupted',
      });
    });

    /**
     * End call from client
     */
    socket.on('end-call', async (data) => {
      const { sessionId } = data;

      const result = await callSessionManager.endSession(
        sessionId,
        'user_ended'
      );

      io.to(sessionId).emit('call-ended', {
        result,
      });

      socket.leave(sessionId);
    });

    /**
     * Client disconnected
     */
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    /**
     * Error handling
     */
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });
}

module.exports = {
  initializeCallRoutes,
  initializeWebSocketHandlers,
};