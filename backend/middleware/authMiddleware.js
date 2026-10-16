import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    try {
      token = authHeader.slice(7).trim();
      if (!token) {
        return res.status(401).json({ message: 'Not authorized, no token provided' });
      }

      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret && process.env.NODE_ENV === 'production') {
        console.error('[SECURITY CRITICAL] JWT_SECRET must be configured in production environment.');
        return res.status(500).json({ message: 'Internal server configuration error.' });
      }
      const secretToUse = jwtSecret || 'smart_business_secret_key_123';
      const decoded = jwt.verify(token, secretToUse);

      req.user = await User.findById(decoded.id).select('-passwordHash');

      if (!req.user) {
        return res.status(401).json({ message: 'Not authorized, user not found' });
      }

      return next();
    } catch (error) {
      console.error('Auth verification failed:', error.message);
      return res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }
};
