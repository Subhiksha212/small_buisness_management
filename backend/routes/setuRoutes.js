import express from 'express';
import {
  getSetuConfig,
  createConsent,
  getConsentStatus,
  verifyCallback,
  handleDirectCallback,
  createDataSession,
  getDataSession,
  fetchAndImportData,
  getBankTransactions,
  classifyBankTransaction,
} from '../controllers/setuController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Public Callback Landing Route
 * If Setu redirects user to Express backend: GET /api/setu/callback?id=...&status=...
 * Preserves all query parameters and routes user to React /setu-callback page.
 */
router.get('/callback', handleDirectCallback);

/**
 * Protected Endpoints (Require Valid Authenticated User)
 */
router.get('/config', protect, getSetuConfig);
router.post('/consents', protect, createConsent);
router.post('/verify-callback', protect, verifyCallback);
router.get('/consents/:id/status', protect, getConsentStatus);

/**
 * Stage 3: Account Aggregator Data APIs
 */
router.post('/sessions', protect, createDataSession);
router.get('/sessions/:id', protect, getDataSession);
router.post('/fetch-data', protect, fetchAndImportData);
router.get('/transactions', protect, getBankTransactions);
router.patch('/transactions/:id/classify', protect, classifyBankTransaction);

export default router;
