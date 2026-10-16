import express from 'express';
import {
  handlePaymentWebhook,
  getPaymentConnectionStatus,
  getAutomaticPayments,
  saveMerchantConfig,
  simulateTestPayment,
  recordUpiPayment,
  createRazorpayOrder,
  verifyRazorpayOrder,
  syncGatewayPayments,
  checkLivePayment,
} from '../controllers/paymentController.js';
import { verifyWebhookSignature } from '../middleware/verifyWebhook.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

import { protect } from '../middleware/authMiddleware.js';
import { checkReferenceNumber } from '../controllers/paymentController.js';

const router = express.Router();

// Public webhook endpoint with signature verification
router.post('/webhook', verifyWebhookSignature, handlePaymentWebhook);

// Protected endpoints for authenticated shop owner
router.get('/status', protect, getPaymentConnectionStatus);
router.get('/automatic', protect, getAutomaticPayments);
router.post('/configure-merchant', protect, saveMerchantConfig);
router.post('/simulate-test-payment', protect, simulateTestPayment);
router.post('/simulate', protect, simulateTestPayment);
router.post('/record-upi', protect, recordUpiPayment);
router.post('/record', protect, recordUpiPayment);
router.get('/check-reference', protect, checkReferenceNumber);

// Real-time Gateway Endpoints
router.post('/create-order', protect, createRazorpayOrder);
router.post('/verify-order', protect, verifyRazorpayOrder);
router.get('/sync-gateway', protect, syncGatewayPayments);
router.get('/live-check', protect, checkLivePayment);

export default router;
