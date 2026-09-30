import { processVerifiedPayment } from '../services/paymentService.js';
import Sale from '../models/Sale.js';

let merchantConfig = {
  provider: 'Razorpay',
  merchantVpa: '',
  cardProvider: 'Razorpay',
};

// Webhook endpoint: POST /api/payments/webhook
export const handlePaymentWebhook = async (req, res) => {
  try {
    const payload = req.body;

    const providerTransactionId =
      payload.providerTransactionId || payload.id || payload.payment_id || payload.txnId || `TXN_${Date.now()}`;
    const amount = payload.amount ? Number(payload.amount) : 0;
    const paymentMethod =
      payload.paymentMethod || (payload.method === 'upi' ? 'UPI' : payload.method === 'card' ? 'Card' : 'UPI');
    const paymentStatus = payload.paymentStatus || 'success';
    const provider = payload.provider || merchantConfig.provider || 'Authorized Payment Gateway';

    if (!providerTransactionId || !amount) {
      return res.status(400).json({ message: 'Invalid webhook payload structure.' });
    }

    const result = await processVerifiedPayment({
      providerTransactionId,
      amount,
      paymentMethod,
      paymentStatus,
      provider,
      description: payload.description || `Automatic ${paymentMethod} Payment`,
    });

    res.status(200).json({
      success: true,
      message: result.duplicate ? 'Duplicate webhook acknowledged.' : 'Automatic payment processed successfully.',
      sale: result.sale,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ message: 'Failed to process payment webhook.' });
  }
};

// Check True Connection Status: GET /api/payments/status
export const getPaymentConnectionStatus = async (req, res) => {
  const providerKey = process.env.PAYMENT_PROVIDER_KEY;
  const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

  // Connection is true ONLY if actual environment credentials exist or merchant credentials configured
  const isConfigured = Boolean((providerKey && webhookSecret) || (merchantConfig.merchantVpa && merchantConfig.merchantVpa.trim() !== ''));

  res.status(200).json({
    upiConnected: isConfigured,
    cardConnected: isConfigured,
    providerName: isConfigured ? merchantConfig.provider : 'Not Connected',
    merchantVpa: merchantConfig.merchantVpa,
    cardProvider: merchantConfig.cardProvider,
  });
};

// Update Merchant Config: POST /api/payments/configure-merchant
export const saveMerchantConfig = async (req, res) => {
  try {
    const { provider, merchantVpa, cardProvider } = req.body;

    if (provider) merchantConfig.provider = provider;
    if (merchantVpa !== undefined) merchantConfig.merchantVpa = merchantVpa;
    if (cardProvider) merchantConfig.cardProvider = cardProvider;

    const isConfigured = Boolean(
      (process.env.PAYMENT_PROVIDER_KEY && process.env.PAYMENT_WEBHOOK_SECRET) ||
      (merchantConfig.merchantVpa && merchantConfig.merchantVpa.trim() !== '')
    );

    res.status(200).json({
      message: 'Merchant payment configuration updated.',
      upiConnected: isConfigured,
      cardConnected: isConfigured,
      merchantConfig,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to save merchant config.' });
  }
};

// Developer / Test Mode: Simulate Automatic Webhook (Explicit Test Data): POST /api/payments/simulate-test-payment
export const simulateTestPayment = async (req, res) => {
  try {
    const { amount = 1000, paymentMethod = 'UPI' } = req.body;
    const providerTransactionId = `TEST_TXN_${paymentMethod.toUpperCase()}_${Date.now()}`;

    const result = await processVerifiedPayment({
      providerTransactionId,
      amount: Number(amount),
      paymentMethod,
      paymentStatus: 'success',
      provider: 'Test Gateway (Sandbox)',
      description: 'TEST PAYMENT — NOT REAL MONEY',
    });

    res.status(201).json({
      message: `TEST PAYMENT — NOT REAL MONEY processed.`,
      sale: result.sale,
    });
  } catch (error) {
    console.error('Error simulating test payment:', error);
    res.status(500).json({ message: 'Failed to simulate test payment.' });
  }
};

// Get Automatic Payments List: GET /api/payments/automatic
export const getAutomaticPayments = async (req, res) => {
  try {
    const automaticSales = await Sale.find({ entryMethod: 'automatic' }).sort({ createdAt: -1 });
    res.status(200).json(automaticSales);
  } catch (error) {
    console.error('Error fetching automatic payments:', error);
    res.status(500).json({ message: 'Failed to fetch automatic payments.' });
  }
};
