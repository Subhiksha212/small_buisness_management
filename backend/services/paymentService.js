import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';

export const processVerifiedPayment = async (paymentData) => {
  const {
    userId,
    direction = 'received', // 'received' (Sale / Inflow) | 'sent' (Expense / Outflow)
    category = 'Stock',
    providerTransactionId,
    amount,
    paymentMethod = 'UPI', // 'UPI' | 'Card'
    paymentStatus = 'success',
    provider = 'Google Pay',
    upiApp = 'Google Pay',
    utrNumber = '',
    description,
  } = paymentData;

  const txnId = providerTransactionId || utrNumber || `UPI_${Date.now()}`;

  // 1. Resolve userId if not passed explicitly (e.g. from webhooks)
  let targetUserId = userId;
  if (!targetUserId) {
    const defaultUser = await User.findOne();
    if (defaultUser) {
      targetUserId = defaultUser._id;
    } else {
      throw new Error('No user account found to attribute payment to.');
    }
  }

  // 2. Prevent duplicate transaction processing
  if (direction === 'sent') {
    const existingExpense = await Expense.findOne({ providerTransactionId: txnId });
    if (existingExpense) {
      console.log(`Duplicate transaction ID for expense: ${txnId}. Skipping.`);
      return { duplicate: true, record: existingExpense, type: 'Expense' };
    }

    // Validate category against Expense schema enum
    const validCategories = ['Stock', 'Rent', 'Electricity', 'Salary', 'Transport', 'Other'];
    const safeCategory = validCategories.includes(category) ? category : 'Stock';

    // Save outgoing payment as Expense
    const expense = await Expense.create({
      userId: targetUserId,
      amount: Number(amount),
      category: safeCategory,
      paymentMethod: ['UPI', 'Card'].includes(paymentMethod) ? paymentMethod : 'UPI',
      upiApp: paymentMethod === 'UPI' ? upiApp : '',
      utrNumber: utrNumber || txnId,
      description: description || `Payment sent via ${upiApp} for ${safeCategory}`,
      entryMethod: 'automatic',
      paymentStatus: paymentStatus,
      provider: provider || upiApp,
      providerTransactionId: txnId,
    });

    console.log(`Automatic Outflow (Expense) Recorded: ${paymentMethod} ₹${amount} [${txnId}]`);
    return { duplicate: false, record: expense, type: 'Expense' };
  } else {
    // Default is 'received' (Inflow / Sale)
    const existingSale = await Sale.findOne({ providerTransactionId: txnId });
    if (existingSale) {
      console.log(`Duplicate transaction ID for sale: ${txnId}. Skipping.`);
      return { duplicate: true, record: existingSale, type: 'Sale' };
    }

    // Save incoming payment as Sale
    const sale = await Sale.create({
      userId: targetUserId,
      amount: Number(amount),
      paymentMethod: ['UPI', 'Card'].includes(paymentMethod) ? paymentMethod : 'UPI',
      upiApp: paymentMethod === 'UPI' ? upiApp : '',
      utrNumber: utrNumber || txnId,
      description: description || `Payment received via ${upiApp}`,
      entryMethod: 'automatic',
      paymentStatus: paymentStatus,
      provider: provider || upiApp,
      providerTransactionId: txnId,
    });

    console.log(`Automatic Inflow (Sale) Recorded: ${paymentMethod} ₹${amount} [${txnId}]`);
    return { duplicate: false, record: sale, type: 'Sale' };
  }
};
