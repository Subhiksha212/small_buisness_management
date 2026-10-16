import crypto from 'crypto';
import PaymentTransaction from '../models/PaymentTransaction.js';
import User from '../models/User.js';
import { processVerifiedPayment } from './paymentService.js';
import sseService from './sseService.js';

/**
 * Service to interface directly with Razorpay REST APIs for real-time payment fetching,
 * order creation, signature verification, and automated background synchronization.
 */
class RazorpayService {
  constructor() {
    this.baseUrl = 'https://api.razorpay.com/v1';
    this.syncInterval = null;
    this.isSyncing = false;
    this.lastSuccessfulSyncTime = null;
    this.lastSyncError = null;
  }

  /**
   * Returns current synchronization and credential health status
   */
  getSyncStatus() {
    const creds = this.getCredentials();
    return {
      isConfigured: creds.isConfigured,
      isSyncing: this.isSyncing,
      lastSuccessfulSyncTime: this.lastSuccessfulSyncTime,
      lastSyncError: this.lastSyncError,
      environment: process.env.PAYMENT_ENV || 'sandbox',
    };
  }

  /**
   * Retrieves active credentials from environment
   */
  getCredentials() {
    const key = process.env.PAYMENT_PROVIDER_KEY || '';
    const secret = process.env.PAYMENT_PROVIDER_SECRET || '';
    const isConfigured = Boolean(key && secret);
    return { key, secret, isConfigured };
  }

  /**
   * Generates Basic Auth header for Razorpay API calls
   */
  getAuthHeader() {
    const { key, secret, isConfigured } = this.getCredentials();
    if (!isConfigured) {
      throw new Error('Razorpay API credentials (PAYMENT_PROVIDER_KEY / PAYMENT_PROVIDER_SECRET) are not configured.');
    }
    const token = Buffer.from(`${key}:${secret}`).toString('base64');
    return `Basic ${token}`;
  }

  /**
   * Create an official Razorpay Order for live customer checkout
   * @param {Object} params - { amount, currency, receipt, notes }
   */
  async createOrder({ amount, currency = 'INR', receipt, notes = {} }) {
    const authHeader = this.getAuthHeader();
    const amountInPaise = Math.round(Number(amount) * 100);

    const payload = {
      amount: amountInPaise,
      currency,
      receipt: receipt || `rcpt_${Date.now()}`,
      notes: {
        ...notes,
        app: 'Smart Business Shop Management',
      },
    };

    const response = await fetch(`${this.baseUrl}/orders`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || 'Failed to create Razorpay Order.');
    }

    return {
      orderId: data.id,
      amount: data.amount / 100,
      currency: data.currency,
      receipt: data.receipt,
      status: data.status,
      key: this.getCredentials().key,
    };
  }

  /**
   * Cryptographically verifies payment signature from client Checkout modal
   * HMAC-SHA256(order_id + '|' + payment_id, secret) === signature
   */
  verifyPaymentSignature({ orderId, paymentId, signature }) {
    const { secret, isConfigured } = this.getCredentials();
    if (!isConfigured) return false;
    if (!orderId || !paymentId || !signature) return false;

    try {
      const generated = crypto
        .createHmac('sha256', secret)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      const sigBuf = Buffer.from(signature, 'utf8');
      const genBuf = Buffer.from(generated, 'utf8');

      if (sigBuf.length !== genBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, genBuf);
    } catch (e) {
      console.error('[RAZORPAY] Signature verification failed:', e.message);
      return false;
    }
  }

  /**
   * Fetches latest payments directly from Razorpay's API
   */
  async fetchLatestPayments({ count = 20, from, to } = {}) {
    const authHeader = this.getAuthHeader();
    let url = `${this.baseUrl}/payments?count=${count}`;
    if (from) url += `&from=${from}`;
    if (to) url += `&to=${to}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || 'Failed to fetch payments from Razorpay API.');
    }

    return data.items || [];
  }

  /**
   * Fetches a single payment by its ID from Razorpay
   */
  async fetchPaymentById(paymentId) {
    if (!paymentId) throw new Error('Payment ID is required.');
    const authHeader = this.getAuthHeader();

    const response = await fetch(`${this.baseUrl}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.description || `Failed to fetch Razorpay payment ${paymentId}.`);
    }

    return data;
  }

  /**
   * Synchronizes captured payments from Razorpay into MongoDB ledger.
   * Dispatches real-time SSE notifications for each newly discovered payment.
   */
  async syncCapturedPayments(userId = null) {
    const { isConfigured } = this.getCredentials();
    if (!isConfigured) {
      return { success: false, reason: 'Credentials not configured', newlySynced: 0, totalFetched: 0 };
    }

    if (this.isSyncing) {
      return { success: false, reason: 'Synchronization already in progress', newlySynced: 0, totalFetched: 0 };
    }

    this.isSyncing = true;

    try {
      let targetUserId = userId;
      if (!targetUserId) {
        const defaultUser = (await User.findOne({ email: 'user212@gmail.com' })) || (await User.findOne());
        targetUserId = defaultUser?._id;
      }

      const payments = await this.fetchLatestPayments({ count: 25 });
      const newlySynced = [];

      for (const p of payments) {
        // Only process captured / successful payments
        if (p.status !== 'captured') continue;

        const existing = await PaymentTransaction.findOne({
          provider: 'Razorpay',
          providerPaymentId: p.id,
        });

        if (!existing) {
          const method = (p.method || '').toLowerCase() === 'card' ? 'Card' : 'UPI';
          const upiApp = p.vpa ? 'UPI' : 'Razorpay';
          const utrNumber = p.acquirer_data?.rrn || p.acquirer_data?.upi_transaction_id || p.id;
          const cleanAmount = Number(p.amount) / 100;

          const result = await processVerifiedPayment({
            userId: targetUserId,
            direction: 'received',
            category: 'Stock',
            provider: 'Razorpay',
            providerPaymentId: p.id,
            providerOrderId: p.order_id || '',
            amount: cleanAmount,
            currency: p.currency || 'INR',
            paymentMethod: method,
            paymentStatus: 'success',
            upiApp,
            utrNumber,
            description: p.description || `Razorpay ${method} Payment [${p.id}]`,
            isTest: Boolean(p.id.startsWith('pay_')),
          });

          if (result && !result.duplicate) {
            newlySynced.push({
              id: p.id,
              amount: cleanAmount,
              method,
              utrNumber,
              orderId: p.order_id,
              saleId: result.record?._id,
            });
          }
        }
      }

      this.lastSuccessfulSyncTime = new Date().toISOString();
      this.lastSyncError = null;

      return {
        success: true,
        totalFetched: payments.length,
        newlySynced: newlySynced.length,
        syncedPayments: newlySynced,
        lastSuccessfulSyncTime: this.lastSuccessfulSyncTime,
      };
    } catch (error) {
      this.lastSyncError = error.message;
      console.error('[RAZORPAY SYNC ERROR]', error.message);
      return {
        success: false,
        error: error.message,
        newlySynced: 0,
        totalFetched: 0,
        lastSyncError: this.lastSyncError,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Starts a background polling synchronization interval (every 20 seconds)
   * Ensures real-time ingestion even when webhooks are blocked by local firewalls / no public URL.
   */
  startBackgroundSync(intervalMs = 20000) {
    if (this.syncInterval) return;

    console.log(`[RAZORPAY] Initializing background real-time payment sync (every ${intervalMs / 1000}s)...`);
    this.syncInterval = setInterval(async () => {
      try {
        const res = await this.syncCapturedPayments();
        if (res.newlySynced > 0) {
          console.log(`[RAZORPAY SYNC] Successfully synced ${res.newlySynced} new payment(s) into database!`);
        }
      } catch (e) {
        // Suppress repeated background network warnings
      }
    }, intervalMs);
  }

  /**
   * Stop background polling
   */
  stopBackgroundSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }
}

export const razorpayService = new RazorpayService();
export default razorpayService;
