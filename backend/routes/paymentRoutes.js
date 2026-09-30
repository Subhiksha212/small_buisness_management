import express from 'express';
import {
  handlePaymentWebhook,
  getPaymentConnectionStatus,
  getAutomaticPayments,
  saveMerchantConfig,
  simulateTestPayment,
  recordUpiPayment,
} from '../controllers/paymentController.js';
import { verifyWebhookSignature } from '../middleware/verifyWebhook.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Soft auth middleware: attaches req.user if token is present, but doesn't hard-block if absent
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'smart_business_jwt_secret_key_987654321');
      req.user = await User.findById(decoded.id).select('-passwordHash');
    } catch (e) {
      // Ignore token failure for optional auth
    }
  }
  next();
};

const router = express.Router();

router.post('/webhook', verifyWebhookSignature, handlePaymentWebhook);
router.get('/status', optionalAuth, getPaymentConnectionStatus);
router.get('/automatic', optionalAuth, getAutomaticPayments);
router.post('/configure-merchant', optionalAuth, saveMerchantConfig);
router.post('/simulate-test-payment', optionalAuth, simulateTestPayment);
router.post('/simulate', optionalAuth, simulateTestPayment);
router.post('/record-upi', optionalAuth, recordUpiPayment);
router.post('/record', optionalAuth, recordUpiPayment);

export default router;
