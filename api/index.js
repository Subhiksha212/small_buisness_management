import app from '../backend/server.js';
import connectDB from '../backend/config/db.js';

/**
 * Vercel Serverless Function entry point.
 * Ensures the MongoDB connection is cached and alive across lambda invocations,
 * normalizes URL routes, and delegates request execution to Express.
 */
export default async function handler(req, res) {
  try {
    await connectDB();
  } catch (error) {
    console.error('Database connection error in serverless handler:', error);
    return res.status(500).json({
      message: 'Database connection failed. Please ensure MONGODB_URI is configured correctly in Vercel environment variables.',
      error: error.message,
    });
  }

  // Ensure request URL maintains the /api prefix expected by Express route registrations
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }

  return app(req, res);
}
