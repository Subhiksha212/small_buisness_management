import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import sseService from '../services/sseService.js';

const router = express.Router();

/**
 * GET /api/events
 * Real-time Server-Sent Events (SSE) stream for authenticated users.
 * Supports token via Authorization header or ?token= query parameter (for native EventSource).
 */
router.get('/', async (req, res) => {
  try {
    let token = null;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ message: 'Authentication required for real-time events stream.' });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret && process.env.NODE_ENV === 'production') {
      return res.status(500).json({ message: 'Server configuration error.' });
    }
    const secretToUse = jwtSecret || 'smart_business_jwt_secret_key_987654321';
    const decoded = jwt.verify(token, secretToUse);

    const user = await User.findById(decoded.id).select('_id email');
    if (!user) {
      return res.status(401).json({ message: 'User not found for real-time event stream.' });
    }

    // Connect this response stream to the user's isolated SSE channel
    sseService.addClient(user._id, res, req);
  } catch (error) {
    console.error('SSE connection authorization failed:', error.message);
    return res.status(401).json({ message: 'Invalid or expired token for events stream.' });
  }
});

export default router;
