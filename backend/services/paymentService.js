import Sale from '../models/Sale.js';

export const processVerifiedPayment = async (paymentData) => {
  const {
    providerTransactionId,
    amount,
    paymentMethod, // 'UPI' | 'Card'
    paymentStatus = 'success',
    provider = 'Payment Gateway',
    description = 'Automatic Provider Payment',
  } = paymentData;

  if (!providerTransactionId) {
    throw new Error('Missing providerTransactionId');
  }

  // 1. Prevent duplicate transaction processing
  const existingSale = await Sale.findOne({ providerTransactionId });
  if (existingSale) {
    console.log(`Duplicate webhook received for transaction ID: ${providerTransactionId}. Skipping.`);
    return { duplicate: true, sale: existingSale };
  }

  // 2. Save automatic verified payment directly to MongoDB
  const sale = await Sale.create({
    amount: Number(amount),
    paymentMethod: ['UPI', 'Card'].includes(paymentMethod) ? paymentMethod : 'UPI',
    description: description,
    entryMethod: 'automatic', // ONLY set by backend server after verification
    paymentStatus: paymentStatus,
    provider: provider,
    providerTransactionId: providerTransactionId,
  });

  console.log(`Automatic Payment Recorded: ${paymentMethod} ₹${amount} [${providerTransactionId}]`);

  return { duplicate: false, sale };
};
