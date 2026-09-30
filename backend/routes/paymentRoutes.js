import express from 'express';
import {
  handlePaymentWebhook,
  getPaymentConnectionStatus,
  getAutomaticPayments,
  saveMerchantConfig,
  simulateTestPayment,
} from '../controllers/paymentController.js';
import { verifyWebhookSignature } from '../middleware/verifyWebhook.js';

const router = express.Router();

router.post('/webhook', verifyWebhookSignature, handlePaymentWebhook);
router.get('/status', getPaymentConnectionStatus);
router.get('/automatic', getAutomaticPayments);
router.post('/configure-merchant', saveMerchantConfig);
router.post('/simulate-test-payment', simulateTestPayment);

export default router;
