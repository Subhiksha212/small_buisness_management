import crypto from 'crypto';

export const verifyWebhookSignature = (req, res, next) => {
  try {
    const webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET;

    // Check for developer/sandbox test header override
    const sandboxSecret = req.headers['x-sandbox-secret'];

    if (!webhookSecret && !sandboxSecret) {
      console.warn('Payment Webhook Warning: PAYMENT_WEBHOOK_SECRET is not configured in .env');
      return res.status(401).json({ message: 'Payment gateway webhook secret is not configured.' });
    }

    const signature = req.headers['x-webhook-signature'] || req.headers['x-razorpay-signature'];

    if (!signature && !sandboxSecret) {
      return res.status(401).json({ message: 'Missing payment webhook signature header.' });
    }

    // Standard HMAC SHA256 signature verification
    if (webhookSecret && signature) {
      const hmac = crypto.createHmac('sha256', webhookSecret);
      const expectedSignature = hmac.update(JSON.stringify(req.body)).digest('hex');

      if (signature !== expectedSignature && sandboxSecret !== webhookSecret) {
        return res.status(401).json({ message: 'Invalid payment webhook signature verification.' });
      }
    }

    next();
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    res.status(500).json({ message: 'Webhook verification error.' });
  }
};
