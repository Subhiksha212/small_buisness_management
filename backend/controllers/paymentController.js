import { processVerifiedPayment } from '../services/paymentService.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import razorpayService from '../services/razorpayService.js';

let merchantConfig = {
  provider: 'Google Pay',
  merchantVpa: '',
  cardProvider: 'Razorpay',
};

/**
 * Webhook endpoint: POST /api/payments/webhook
 * Protected by verifyWebhookSignature middleware.
 * req.verifiedPaymentData contains cryptographically verified and normalized payment data.
 */
export const handlePaymentWebhook = async (req, res) => {
  try {
    const verified = req.verifiedPaymentData;
    if (!verified) {
      return res.status(400).json({
        error: 'UnverifiedWebhook',
        message: 'Webhook data has not been verified by security middleware.',
      });
    }

    const {
      provider,
      eventType,
      providerPaymentId,
      providerOrderId,
      amount,
      currency,
      status: paymentStatus,
      paymentMethod,
      upiApp,
      utrNumber,
      isTest,
      direction = 'received',
      paidTo = '',
      category = 'Stock',
      description = '',
    } = verified;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ error: 'InvalidAmount', message: 'Payment amount must be greater than zero.' });
    }

    const result = await processVerifiedPayment({
      userId: req.user?._id,
      direction,
      category,
      paidTo,
      provider: provider || req.paymentProvider || 'Unknown',
      providerPaymentId,
      providerOrderId,
      amount: Number(amount),
      currency: currency || 'INR',
      paymentMethod: paymentMethod || 'UPI',
      paymentStatus: paymentStatus || 'success',
      upiApp: upiApp || provider,
      utrNumber,
      description,
      isTest: Boolean(isTest || process.env.PAYMENT_ENV === 'sandbox'),
    });

    if (result.duplicate) {
      return res.status(200).json({
        success: true,
        duplicate: true,
        message: 'Duplicate webhook acknowledged. No duplicate records created.',
        transactionId: providerPaymentId,
      });
    }

    if (result.error === 'AmountMismatch') {
      return res.status(400).json({
        success: false,
        error: result.error,
        message: result.message,
      });
    }

    res.status(200).json({
      success: true,
      message: result.message || 'Payment processed successfully.',
      record: result.record,
      type: result.type,
      order: result.order,
    });
  } catch (error) {
    console.error('[SECURITY/ERROR] Webhook processing exception:', error.message);
    res.status(500).json({ error: 'WebhookProcessingFailed', message: 'Failed to process payment webhook.' });
  }
};

/**
/**
 * Check Connection Status: GET /api/payments/status
 * Shows real gateway status, sync history, and personal UPI limitations
 */
export const getPaymentConnectionStatus = async (req, res) => {
  try {
    let user = req.user;
    if (!user && req.user?._id) {
      user = await User.findById(req.user._id);
    }

    const providerKey = process.env.PAYMENT_PROVIDER_KEY;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const paymentEnv = process.env.PAYMENT_ENV || 'sandbox';
    const providerName = process.env.PAYMENT_PROVIDER || 'Razorpay';

    const isGatewayConfigured = Boolean(providerKey && webhookSecret);
    const syncStatus = razorpayService.getSyncStatus();
    const vpa = user?.merchantVpa || merchantConfig.merchantVpa || '';
    const upiProvider = user?.upiProvider || merchantConfig.provider || 'Google Pay';
    const cardProvider = user?.cardProvider || merchantConfig.cardProvider || 'Razorpay';

    let gatewayStatus = 'Not Configured';
    if (isGatewayConfigured) {
      if (syncStatus.lastSuccessfulSyncTime) {
        gatewayStatus = paymentEnv === 'sandbox' ? 'Sandbox Active' : 'Live Connected';
      } else {
        gatewayStatus = paymentEnv === 'sandbox' ? 'Sandbox Configured' : 'Live Configured';
      }
    }

    res.status(200).json({
      gatewayStatus,
      isGatewayConfigured,
      environment: paymentEnv,
      providerName: isGatewayConfigured ? providerName : 'None Configured',
      upiConnected: Boolean(vpa && vpa.trim() !== '') || isGatewayConfigured,
      cardConnected: isGatewayConfigured,
      merchantVpa: vpa,
      upiProvider,
      cardProvider,
      isSyncing: syncStatus.isSyncing,
      lastSuccessfulSyncTime: syncStatus.lastSuccessfulSyncTime,
      lastSyncError: syncStatus.lastSyncError,
      autoIngestionAvailable: isGatewayConfigured,
      personalUpiCapability: {
        canDisplayQr: Boolean(vpa && vpa.trim() !== ''),
        canRecordManually: true,
        canAutoFetchBankStatement: false,
        notice:
          'Personal UPI handles (GPay/PhonePe) do not provide automated transaction history feeds. Confirmed payments must be recorded or reconciled manually via UTR reference numbers.',
      },
    });
  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({ message: 'Failed to check payment status.' });
  }
};

/**
 * Check if a reference number / UTR already exists: GET /api/payments/check-reference?utr=...
 */
export const checkReferenceNumber = async (req, res) => {
  try {
    const { utr } = req.query;
    if (!utr || !utr.trim()) {
      return res.status(400).json({ message: 'Reference number or UTR is required.' });
    }

    const cleanUtr = utr.trim();
    const userId = req.user?._id;

    const existing = await Sale.findOne({
      userId,
      $or: [{ utrNumber: cleanUtr }, { referenceNumber: cleanUtr }, { providerTransactionId: cleanUtr }],
    });

    if (existing) {
      return res.status(200).json({
        exists: true,
        message: `Warning: Reference #${cleanUtr} was already recorded on ${new Date(
          existing.createdAt
        ).toLocaleDateString()} for ₹${existing.amount}.`,
        transaction: {
          id: existing._id,
          amount: existing.amount,
          date: existing.createdAt,
          paymentMethod: existing.paymentMethod,
        },
      });
    }

    res.status(200).json({
      exists: false,
      message: 'Reference number is unique.',
    });
  } catch (error) {
    console.error('Error checking reference number:', error);
    res.status(500).json({ message: error.message || 'Failed to check reference number.' });
  }
};

/**
 * Update Merchant Config: POST /api/payments/configure-merchant
 */
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

    const providerKey = process.env.PAYMENT_PROVIDER_KEY;
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;
    const isConfigured = Boolean((providerKey && webhookSecret) || (merchantConfig.merchantVpa && merchantConfig.merchantVpa !== ''));

    res.status(200).json({
      message: 'Payment configuration saved successfully.',
      upiConnected: isConfigured,
      cardConnected: Boolean(providerKey && webhookSecret),
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

/**
 * Developer / Test Mode: Simulate Automatic Webhook: POST /api/payments/simulate-test-payment
 * STRICTLY DEVELOPMENT / SANDBOX ONLY. Disabled in production.
 */
export const simulateTestPayment = async (req, res) => {
  try {
    const isSandboxAllowed = process.env.PAYMENT_ENV === 'sandbox' || process.env.NODE_ENV !== 'production';
    if (!isSandboxAllowed) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Payment simulation is strictly disabled in production environment.',
      });
    }

    const {
      amount = 500,
      paymentMethod = 'UPI',
      direction = 'received',
      upiApp = 'UPI',
      category = 'Stock',
      utrNumber,
      paidTo = '',
      note,
      orderId,
    } = req.body;

    let targetUserId = req.user?._id;
    if (!targetUserId) {
      const defaultUser = (await User.findOne({ email: 'user212@gmail.com' })) || (await User.findOne());
      targetUserId = defaultUser?._id;
    }

    const randomUtr = utrNumber || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const providerTransactionId = `SIM_SANDBOX_${randomUtr}`;

    const desc = note || (direction === 'sent'
      ? (paidTo ? `Paid to ${paidTo} via ${upiApp} [UTR: ${randomUtr}]` : `Payment sent via ${upiApp} for ${category} [UTR: ${randomUtr}]`)
      : `Test Customer payment received via ${upiApp} [UTR: ${randomUtr}]`);

    const result = await processVerifiedPayment({
      userId: targetUserId,
      direction,
      category,
      paidTo,
      provider: 'Sandbox',
      providerPaymentId: providerTransactionId,
      providerOrderId: orderId || '',
      amount: Number(amount),
      paymentMethod,
      paymentStatus: 'success',
      upiApp,
      utrNumber: randomUtr,
      description: desc,
      isTest: true,
    });

    res.status(201).json({
      success: true,
      isTest: true,
      message: direction === 'sent'
        ? `[SANDBOX TEST] Outflow recorded: ₹${amount} sent via ${upiApp}. NOT REAL MONEY.`
        : `[SANDBOX TEST] Inflow recorded: ₹${amount} received via ${upiApp}. NOT REAL MONEY.`,
      record: result.record,
      type: result.type,
      order: result.order,
    });
  } catch (error) {
    console.error('Error simulating test payment:', error);
    res.status(500).json({ message: error.message || 'Failed to simulate test payment.' });
  }
};

/**
 * Record UPI Payment: POST /api/payments/record-upi
 */
export const recordUpiPayment = async (req, res) => {
  try {
    const {
      direction = 'received',
      amount,
      upiApp = 'Google Pay',
      utrNumber = '',
      senderReceiver = '',
      senderUpi = '',
      receiverUpi = '',
      paidTo = '',
      category = 'Stock',
      note = '',
      orderId,
      isTest = false,
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Please enter an amount greater than 0.' });
    }

    let targetUserId = req.user?._id;
    if (!targetUserId) {
      const defaultUser = (await User.findOne({ email: 'user212@gmail.com' })) || (await User.findOne());
      targetUserId = defaultUser?._id;
    }

    const cleanUtr = utrNumber ? utrNumber.trim() : `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const txnId = `UPI_${cleanUtr}`;
    const payee = paidTo || receiverUpi || senderReceiver || senderUpi || 'Store Counter';

    const desc = note.trim() || (direction === 'sent'
      ? `Paid ₹${amount} to ${payee} via ${upiApp} [UTR: ${cleanUtr}]`
      : `Received ₹${amount} from ${payee} via ${upiApp} [UTR: ${cleanUtr}]`);

    const result = await processVerifiedPayment({
      userId: targetUserId,
      direction,
      category,
      paidTo: payee,
      provider: upiApp,
      providerPaymentId: txnId,
      providerOrderId: orderId || '',
      amount: Number(amount),
      paymentMethod: 'UPI',
      paymentStatus: 'success',
      upiApp,
      utrNumber: cleanUtr,
      description: desc,
      isTest: Boolean(isTest || process.env.PAYMENT_ENV === 'sandbox'),
    });

    res.status(201).json({
      success: true,
      message: direction === 'sent'
        ? `₹${amount} UPI Outflow logged successfully.`
        : `₹${amount} UPI Inflow logged successfully.`,
      record: result.record,
      type: result.type,
      order: result.order,
      utrNumber: cleanUtr,
      txnId,
      upiApp,
      amount: Number(amount),
      direction,
      payee,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error recording UPI payment:', error);
    res.status(500).json({ message: error.message || 'Failed to record UPI payment.' });
  }
};

/**
 * Get Automatic Payments List: GET /api/payments/automatic
 */
export const getAutomaticPayments = async (req, res) => {
  try {
    let query = { entryMethod: 'automatic' };
    if (req.user?._id) {
      query.userId = req.user._id;
    }

    const [automaticSales, automaticExpenses] = await Promise.all([
      Sale.find(query).sort({ createdAt: -1 }).limit(15),
      Expense.find(query).sort({ createdAt: -1 }).limit(15),
    ]);

    const formattedSales = automaticSales.map(s => ({
      _id: s._id,
      amount: s.amount,
      direction: 'received',
      type: 'Sale',
      paymentMethod: s.paymentMethod,
      provider: s.provider || s.upiApp || 'UPI',
      providerTransactionId: s.providerTransactionId || s.utrNumber,
      paymentStatus: s.paymentStatus || 'success',
      isTest: s.isTest || false,
      createdAt: s.createdAt,
      description: s.description,
    }));

    const formattedExpenses = automaticExpenses.map(e => ({
      _id: e._id,
      amount: e.amount,
      direction: 'sent',
      type: 'Expense',
      paymentMethod: e.paymentMethod,
      provider: e.provider || e.upiApp || 'UPI',
      providerTransactionId: e.providerTransactionId || e.utrNumber,
      paymentStatus: e.paymentStatus || 'success',
      isTest: e.isTest || false,
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

/**
 * Create a live Razorpay Order: POST /api/payments/create-order
 */
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, receipt, notes = {} } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Amount must be greater than 0.' });
    }

    const order = await razorpayService.createOrder({
      amount: Number(amount),
      receipt: receipt || `counter_${Date.now()}`,
      notes: {
        ...notes,
        userId: req.user?._id ? String(req.user._id) : '',
      },
    });

    res.status(201).json({
      success: true,
      order,
    });
  } catch (error) {
    console.error('Error creating Razorpay order:', error.message);
    res.status(500).json({ message: error.message || 'Failed to create Razorpay Order.' });
  }
};

/**
 * Verify Razorpay Checkout Payment: POST /api/payments/verify-order
 */
export const verifyRazorpayOrder = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount, description } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing Razorpay signature or payment details.' });
    }

    const isValid = razorpayService.verifyPaymentSignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid payment signature verification.' });
    }

    // Fetch full payment details from Razorpay to get exact amount & payment method
    let paymentDetails = null;
    try {
      paymentDetails = await razorpayService.fetchPaymentById(razorpay_payment_id);
    } catch (e) {
      // Proceed with provided amount if fetch fails
    }

    const finalAmount = paymentDetails?.amount ? Number(paymentDetails.amount) / 100 : Number(amount) || 0;
    const rawMethod = (paymentDetails?.method || '').toLowerCase();
    const paymentMethod = rawMethod === 'card' ? 'Card' : 'UPI';
    const upiApp = paymentDetails?.vpa ? 'UPI' : 'Razorpay';
    const utr = paymentDetails?.acquirer_data?.rrn || paymentDetails?.acquirer_data?.upi_transaction_id || razorpay_payment_id;

    let targetUserId = req.user?._id;
    if (!targetUserId) {
      const defaultUser = (await User.findOne({ email: 'user212@gmail.com' })) || (await User.findOne());
      targetUserId = defaultUser?._id;
    }

    const result = await processVerifiedPayment({
      userId: targetUserId,
      direction: 'received',
      category: 'Stock',
      provider: 'Razorpay',
      providerPaymentId: razorpay_payment_id,
      providerOrderId: razorpay_order_id,
      amount: finalAmount,
      currency: paymentDetails?.currency || 'INR',
      paymentMethod,
      paymentStatus: 'success',
      upiApp,
      utrNumber: utr,
      description: description || `Razorpay counter payment [${razorpay_payment_id}]`,
      isTest: Boolean(razorpay_payment_id.startsWith('pay_')),
    });

    res.status(200).json({
      success: true,
      message: `Payment of ₹${finalAmount} verified and recorded successfully!`,
      record: result.record,
      type: result.type,
      paymentId: razorpay_payment_id,
      orderId: razorpay_order_id,
      amount: finalAmount,
      method: paymentMethod,
    });
  } catch (error) {
    console.error('Error verifying Razorpay order payment:', error);
    res.status(500).json({ message: error.message || 'Payment verification failed.' });
  }
};

/**
 * Trigger Real-time Gateway Sync: GET /api/payments/sync-gateway
 * Fetches latest captured payments directly from Razorpay API.
 */
export const syncGatewayPayments = async (req, res) => {
  try {
    const targetUserId = req.user?._id || null;
    const syncResult = await razorpayService.syncCapturedPayments(targetUserId);

    res.status(200).json({
      success: true,
      message: syncResult.newlySynced > 0
        ? `Successfully fetched and recorded ${syncResult.newlySynced} new payment(s) from Razorpay!`
        : 'All gateway payments are already up to date.',
      ...syncResult,
    });
  } catch (error) {
    console.error('Error syncing gateway payments:', error.message);
    res.status(500).json({ message: error.message || 'Failed to sync payments from gateway.' });
  }
};

/**
 * Live payment check: GET /api/payments/live-check?amount=...&since=...
 * Used by counter screens to detect newly received payments in real time.
 */
export const checkLivePayment = async (req, res) => {
  try {
    const { amount, since } = req.query;
    const targetAmount = Number(amount);
    const sinceTime = since ? new Date(Number(since)) : new Date(Date.now() - 60000); // default last 60s

    // First try a quick sync from Razorpay in case webhook hasn't hit
    try {
      await razorpayService.syncCapturedPayments(req.user?._id);
    } catch (e) {
      // Non-blocking
    }

    const query = {
      createdAt: { $gte: sinceTime },
      paymentStatus: 'success',
    };

    if (req.user?._id) {
      query.userId = req.user._id;
    }

    if (targetAmount && targetAmount > 0) {
      // Match amount within 0.01 precision
      query.amount = { $gte: targetAmount - 0.01, $lte: targetAmount + 0.01 };
    }

    const matchedSale = await Sale.findOne(query).sort({ createdAt: -1 });

    if (matchedSale) {
      return res.status(200).json({
        found: true,
        payment: {
          id: matchedSale._id,
          amount: matchedSale.amount,
          provider: matchedSale.provider || matchedSale.upiApp || 'UPI',
          paymentMethod: matchedSale.paymentMethod,
          utrNumber: matchedSale.utrNumber,
          description: matchedSale.description,
          createdAt: matchedSale.createdAt,
        },
      });
    }

    res.status(200).json({ found: false });
  } catch (error) {
    console.error('Error checking live payment:', error);
    res.status(500).json({ found: false, message: error.message });
  }
};

