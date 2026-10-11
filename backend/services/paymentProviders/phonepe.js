import crypto from 'crypto';

/**
 * PhonePe Merchant Payment Gateway Webhook Verification Adapter
 * PhonePe computes X-VERIFY header:
 * X-VERIFY = SHA256(base64Payload + saltKey) + "###" + saltIndex
 */
export const verifyPhonePeWebhook = (rawBody, body, xVerifyHeader, saltKey, expectedSaltIndex = '1') => {
  if (!xVerifyHeader || !saltKey) {
    return false;
  }

  try {
    const parts = xVerifyHeader.split('###');
    if (parts.length !== 2) {
      return false;
    }
    const [receivedChecksum, receivedIndex] = parts;

    // PhonePe passes base64 string in body.response or rawBody
    const base64Payload = body?.response || (typeof body === 'string' ? body : rawBody);
    if (!base64Payload) {
      return false;
    }

    const expectedChecksum = crypto
      .createHash('sha256')
      .update(base64Payload + saltKey)
      .digest('hex');

    const receivedBuf = Buffer.from(receivedChecksum, 'utf8');
    const expectedBuf = Buffer.from(expectedChecksum, 'utf8');

    if (receivedBuf.length !== expectedBuf.length) {
      return false;
    }

    const isValidSignature = crypto.timingSafeEqual(receivedBuf, expectedBuf);
    if (!isValidSignature) {
      return false;
    }

    if (expectedSaltIndex && receivedIndex !== String(expectedSaltIndex)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('PhonePe signature verification error:', error.message);
    return false;
  }
};

/**
 * Normalizes PhonePe webhook payload into standard application transaction schema
 */
export const parsePhonePePayload = (body) => {
  let payload = body;

  // Decode base64 payload if present
  if (body?.response && typeof body.response === 'string') {
    try {
      const decoded = Buffer.from(body.response, 'base64').toString('utf8');
      payload = JSON.parse(decoded);
    } catch (e) {
      console.warn('Could not base64-decode PhonePe response string:', e.message);
    }
  }

  const dataBlock = payload?.data || payload;
  const providerPaymentId = dataBlock?.transactionId || payload?.transactionId || `PHONEPE_${Date.now()}`;
  const providerOrderId = dataBlock?.merchantTransactionId || payload?.merchantTransactionId || '';

  // PhonePe amounts are in paise (e.g. 50000 = ₹500.00) unless already in INR
  const rawAmount = dataBlock?.amount !== undefined ? dataBlock.amount : payload?.amount || 0;
  const amount = Number(rawAmount) >= 100 ? Number(rawAmount) / 100 : Number(rawAmount);

  const state = String(dataBlock?.state || dataBlock?.responseCode || payload?.code || '').toUpperCase();
  let status = 'pending';
  if (state === 'COMPLETED' || state === 'SUCCESS' || state === 'PAYMENT_SUCCESS') {
    status = 'success';
  } else if (state === 'FAILED' || state === 'PAYMENT_ERROR') {
    status = 'failed';
  } else if (state === 'REFUNDED') {
    status = 'refunded';
  }

  const utrNumber = dataBlock?.paymentInstrument?.utr || dataBlock?.utrNumber || providerPaymentId;

  return {
    provider: 'PhonePe',
    eventType: payload?.code || 'PAYMENT_SUCCESS',
    providerPaymentId,
    providerOrderId,
    amount,
    currency: 'INR',
    status,
    paymentMethod: 'PhonePe',
    upiApp: 'PhonePe',
    utrNumber,
    isTest: Boolean(payload?.isTest || process.env.PAYMENT_ENV === 'sandbox'),
  };
};
