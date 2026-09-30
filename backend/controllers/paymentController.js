import { processVerifiedPayment } from '../services/paymentService.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';

let merchantConfig = {
  provider: 'Google Pay',
  merchantVpa: '',
  cardProvider: 'Razorpay',
};

// Webhook endpoint: POST /api/payments/webhook
export const handlePaymentWebhook = async (req, res) => {
  try {
    const payload = req.body;

    const providerTransactionId =
      payload.providerTransactionId || payload.id || payload.payment_id || payload.txnId || payload.utr || `TXN_${Date.now()}`;
    const amount = payload.amount ? Number(payload.amount) : 0;
    const paymentMethod =
      payload.paymentMethod || (payload.method === 'upi' ? 'UPI' : payload.method === 'card' ? 'Card' : 'UPI');
    const paymentStatus = payload.paymentStatus || 'success';
    const provider = payload.provider || payload.upiApp || merchantConfig.provider || 'Google Pay';
    const direction = payload.direction || (payload.type === 'debit' || payload.type === 'Expense' ? 'sent' : 'received');

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid payment amount.' });
    }

    const result = await processVerifiedPayment({
      userId: req.user?._id,
      direction,
      category: payload.category || 'Stock',
      providerTransactionId,
      amount,
      paymentMethod,
      paymentStatus,
      provider,
      upiApp: payload.upiApp || provider,
      utrNumber: payload.utrNumber || providerTransactionId,
      description: payload.description || `Automatic ${paymentMethod} payment (${direction === 'sent' ? 'Outflow' : 'Inflow'})`,
    });

    res.status(200).json({
      success: true,
      message: result.duplicate ? 'Duplicate webhook acknowledged.' : 'Automatic payment processed successfully.',
      record: result.record,
      type: result.type,
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({ message: 'Failed to process payment webhook.' });
  }
};

// Check Connection Status: GET /api/payments/status
export const getPaymentConnectionStatus = async (req, res) => {
  try {
    let user = req.user;
    if (!user) {
      user = await User.findOne();
    }

    const providerKey = process.env.PAYMENT_PROVIDER_KEY;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    const vpa = user?.merchantVpa || merchantConfig.merchantVpa || '';
    const upiProvider = user?.upiProvider || merchantConfig.provider || 'Google Pay';
    const cardProvider = user?.cardProvider || merchantConfig.cardProvider || 'Razorpay';

    const isConfigured = Boolean(
      (providerKey && webhookSecret) || (vpa && vpa.trim() !== '')
    );

    res.status(200).json({
      upiConnected: isConfigured,
      cardConnected: isConfigured,
      providerName: isConfigured ? upiProvider : 'Not Connected',
      merchantVpa: vpa,
      upiProvider: upiProvider,
      cardProvider: cardProvider,
    });
  } catch (error) {
    console.error('Error getting status:', error);
    res.status(500).json({ message: 'Failed to check status' });
  }
};

// Update Merchant Config: POST /api/payments/configure-merchant
export const saveMerchantConfig = async (req, res) => {
  try {
    const { provider, merchantVpa, cardProvider } = req.body;

    if (provider) merchantConfig.provider = provider;
    if (merchantVpa !== undefined) merchantConfig.merchantVpa = merchantVpa.trim();
    if (cardProvider) merchantConfig.cardProvider = cardProvider;

    let user = req.user;
    if (!user) {
      user = await User.findOne();
    }

    if (user) {
      if (provider) user.upiProvider = provider;
      if (merchantVpa !== undefined) user.merchantVpa = merchantVpa.trim();
      if (cardProvider) user.cardProvider = cardProvider;
      await user.save();
    }

    const isConfigured = Boolean(merchantConfig.merchantVpa && merchantConfig.merchantVpa !== '');

    res.status(200).json({
      message: 'Payment configuration saved and active.',
      upiConnected: isConfigured,
      cardConnected: isConfigured,
      merchantConfig: {
        provider: merchantConfig.provider,
        merchantVpa: merchantConfig.merchantVpa,
        cardProvider: merchantConfig.cardProvider,
      },
    });
  } catch (error) {
    console.error('Error saving merchant config:', error);
    res.status(500).json({ message: 'Failed to save merchant config.' });
  }
};

// Developer / Test Mode: Simulate Automatic Webhook: POST /api/payments/simulate-test-payment
export const simulateTestPayment = async (req, res) => {
  try {
    const {
      amount = 500,
      paymentMethod = 'UPI',
      direction = 'received', // 'received' (Sale) or 'sent' (Expense)
      upiApp = 'Google Pay',
      category = 'Stock',
      utrNumber,
      note,
    } = req.body;

    let targetUserId = req.user?._id;
    if (!targetUserId) {
      const defaultUser = await User.findOne();
      targetUserId = defaultUser?._id;
    }

    const randomUtr = utrNumber || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const providerTransactionId = `TEST_${upiApp.toUpperCase().replace(/\s+/g, '_')}_${randomUtr}`;

    const desc = note || (direction === 'sent'
      ? `Simulated GPay transfer sent to Supplier for ${category} [UTR: ${randomUtr}]`
      : `Simulated GPay customer payment received [UTR: ${randomUtr}]`);

    const result = await processVerifiedPayment({
      userId: targetUserId,
      direction,
      category,
      providerTransactionId,
      amount: Number(amount),
      paymentMethod,
      paymentStatus: 'success',
      provider: upiApp,
      upiApp: upiApp,
      utrNumber: randomUtr,
      description: desc,
    });

    res.status(201).json({
      success: true,
      message: direction === 'sent'
        ? `Outflow recorded: ₹${amount} sent via ${upiApp} (Expense registered).`
        : `Inflow recorded: ₹${amount} received via ${upiApp} (Sale registered).`,
      record: result.record,
      type: result.type,
    });
  } catch (error) {
    console.error('Error simulating test payment:', error);
    res.status(500).json({ message: error.message || 'Failed to simulate test payment.' });
  }
};

// Record UPI Payment (Direct Inflow/Outflow Entry with Live UTR): POST /api/payments/record-upi
export const recordUpiPayment = async (req, res) => {
  try {
    const {
      direction = 'received', // 'received' or 'sent'
      amount,
      upiApp = 'Google Pay',
      utrNumber = '',
      senderReceiver = '',
      category = 'Stock',
      note = '',
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Please enter an amount greater than 0.' });
    }

    let targetUserId = req.user?._id;
    if (!targetUserId) {
      const defaultUser = await User.findOne();
      targetUserId = defaultUser?._id;
    }

    const cleanUtr = utrNumber ? utrNumber.trim() : `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const txnId = `UPI_${cleanUtr}`;

    const desc = note.trim() || (direction === 'sent'
      ? `Paid ₹${amount} to ${senderReceiver || 'Vendor'} via ${upiApp} [UTR: ${cleanUtr}]`
      : `Received ₹${amount} from ${senderReceiver || 'Customer'} via ${upiApp} [UTR: ${cleanUtr}]`);

    const result = await processVerifiedPayment({
      userId: targetUserId,
      direction,
      category,
      providerTransactionId: txnId,
      amount: Number(amount),
      paymentMethod: 'UPI',
      paymentStatus: 'success',
      provider: upiApp,
      upiApp: upiApp,
      utrNumber: cleanUtr,
      description: desc,
    });

    res.status(201).json({
      success: true,
      message: direction === 'sent'
        ? `₹${amount} UPI Outflow logged successfully.`
        : `₹${amount} UPI Inflow logged successfully.`,
      record: result.record,
      type: result.type,
    });
  } catch (error) {
    console.error('Error recording UPI payment:', error);
    res.status(500).json({ message: error.message || 'Failed to record UPI payment.' });
  }
};

// Get Automatic Payments List: GET /api/payments/automatic
export const getAutomaticPayments = async (req, res) => {
  try {
    let query = { entryMethod: 'automatic' };
    if (req.user?._id) {
      query.userId = req.user._id;
    }

    const [automaticSales, automaticExpenses] = await Promise.all([
      Sale.find(query).sort({ createdAt: -1 }).limit(10),
      Expense.find(query).sort({ createdAt: -1 }).limit(10),
    ]);

    const formattedSales = automaticSales.map(s => ({
      _id: s._id,
      amount: s.amount,
      direction: 'received',
      type: 'Sale',
      paymentMethod: s.paymentMethod,
      provider: s.provider || s.upiApp || 'Google Pay',
      providerTransactionId: s.providerTransactionId || s.utrNumber,
      paymentStatus: s.paymentStatus || 'success',
      createdAt: s.createdAt,
      description: s.description,
    }));

    const formattedExpenses = automaticExpenses.map(e => ({
      _id: e._id,
      amount: e.amount,
      direction: 'sent',
      type: 'Expense',
      paymentMethod: e.paymentMethod,
      provider: e.provider || e.upiApp || 'Google Pay',
      providerTransactionId: e.providerTransactionId || e.utrNumber,
      paymentStatus: e.paymentStatus || 'success',
      createdAt: e.createdAt,
      description: e.description,
    }));

    const allAuto = [...formattedSales, ...formattedExpenses].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    res.status(200).json(allAuto);
  } catch (error) {
    console.error('Error fetching automatic payments:', error);
    res.status(500).json({ message: 'Failed to fetch automatic payments.' });
  }
};
