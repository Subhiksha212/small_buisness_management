import crypto from 'crypto';

/**
 * Authorized Direct Bank Transaction Feed Adapter
 * Designed for merchants with an authorized corporate bank statement API or e-collection webhook
 * (e.g. HDFC SmartHub / ICICI e-Collections / Axis UPI Merchant Feed).
 * Validates HMAC-SHA256 signature and normalizes direct bank credit notifications.
 */
export const verifyBankFeedWebhook = (rawBody, signature, secret) => {
  if (!rawBody || !signature || !secret) {
    return false;
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const sigBuf = Buffer.from(signature, 'utf8');
    const expBuf = Buffer.from(expectedSignature, 'utf8');

    if (sigBuf.length !== expBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(sigBuf, expBuf);
  } catch (error) {
    console.error('Bank Feed signature verification error:', error.message);
    return false;
  }
};

/**
 * Normalizes direct bank UPI feed statement notification
 */
export const parseBankFeedPayload = (body) => {
  const providerPaymentId = body.bankReferenceNumber || body.utr || body.transactionId || `BANK_${Date.now()}`;
  const amount = Number(body.amount || body.creditAmount || 0);
  const utrNumber = body.utr || body.rrn || providerPaymentId;
  const payerUpi = body.payerVpa || body.remitterVpa || '';

  // Determine whether it arrived via GPay, PhonePe, or General UPI based on VPA handles
  let paymentMethod = 'Other UPI';
  let upiApp = 'UPI';
  const lowerVpa = payerUpi.toLowerCase();
  if (lowerVpa.includes('okhdfcbank') || lowerVpa.includes('okaxis') || lowerVpa.includes('oksbi') || lowerVpa.includes('okicici')) {
    paymentMethod = 'GPay';
    upiApp = 'Google Pay';
  } else if (lowerVpa.includes('ybl') || lowerVpa.includes('ibl') || lowerVpa.includes('axl')) {
    paymentMethod = 'PhonePe';
    upiApp = 'PhonePe';
  }

  const rawStatus = String(body.status || 'success').toLowerCase();
  let status = 'pending';
  if (rawStatus === 'success' || rawStatus === 'credited' || rawStatus === 'completed') {
    status = 'success';
  } else if (rawStatus === 'failed' || rawStatus === 'rejected') {
    status = 'failed';
  }

  return {
    provider: body.bankName || 'Authorized Bank Feed',
    eventType: body.event || 'bank.credit.notification',
    providerPaymentId,
    providerOrderId: body.virtualAccountNumber || body.clientReferenceNo || '',
    amount,
    currency: body.currency || 'INR',
    status,
    paymentMethod,
    upiApp,
    utrNumber,
    isTest: Boolean(body.isTest || process.env.PAYMENT_ENV === 'sandbox'),
  };
};
