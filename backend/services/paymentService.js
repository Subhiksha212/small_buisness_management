import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import User from '../models/User.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import InventoryMovement from '../models/InventoryMovement.js';
import PaymentTransaction from '../models/PaymentTransaction.js';
import sseService from './sseService.js';

/**
 * Process a verified payment from any supported payment provider.
 * Follows strict financial workflow:
 * 1. Idempotency Check: (provider + providerPaymentId)
 * 2. Validate Payment Status (pending, success, failed, refunded)
 * 3. Match Order & Verify Server-Side Expected Amount
 * 4. Deduct Inventory Once (Order -> Payment -> Inventory)
 * 5. Create Sale / Expense Record in MongoDB
 * 6. Record PaymentTransaction for auditability & idempotency
 * 7. Dispatch targeted Real-Time SSE Notification to the specific business owner
 */
export const processVerifiedPayment = async (paymentData) => {
  const {
    userId,
    direction = 'received', // 'received' (inflow/Sale) | 'sent' (outflow/Expense)
    category = 'Stock',
    provider = 'Sandbox',
    providerPaymentId,
    providerOrderId = '',
    amount,
    currency = 'INR',
    paymentMethod = 'UPI',
    paymentStatus = 'success',
    upiApp = '',
    utrNumber = '',
    paidTo = '',
    description = '',
    isTest = false,
  } = paymentData;

  const txnId = providerPaymentId || utrNumber || `TXN_${Date.now()}`;
  const normalizedAmount = Number(amount) || 0;

  // 1. Idempotency check: Reject duplicate webhooks
  const existingTxn = await PaymentTransaction.findOne({
    provider,
    providerPaymentId: txnId,
  });

  if (existingTxn) {
    console.log(`[PAYMENT] Duplicate webhook detected: ${provider} [${txnId}]. Acknowledged without re-processing.`);
    return {
      duplicate: true,
      record: existingTxn,
      type: existingTxn.direction === 'outflow' ? 'Expense' : 'Sale',
      message: 'Duplicate payment webhook acknowledged.',
    };
  }

  // 2. Validate Payment Status
  // If payment status is not 'success', record transaction as non-success and DO NOT finalize revenue or inventory
  if (paymentStatus !== 'success') {
    console.warn(`[PAYMENT] Non-success payment received (${paymentStatus}) for ${provider} [${txnId}]`);

    let targetUserId = userId;
    let order = null;
    if (providerOrderId) {
      order = await Order.findOne({
        $or: [
          { providerOrderId },
          { orderNumber: providerOrderId },
          ...(mongoose.isValidObjectId(providerOrderId) ? [{ _id: providerOrderId }] : []),
        ],
      });
      if (order) {
        targetUserId = order.userId;
        order.status = paymentStatus === 'refunded' ? 'refunded' : 'failed';
        await order.save();
      }
    }

    if (!targetUserId) {
      const defaultUser = (await User.findOne({ email: 'user212@gmail.com' })) || (await User.findOne());
      targetUserId = defaultUser?._id;
    }

    const nonSuccessTxn = await PaymentTransaction.create({
      userId: targetUserId,
      orderId: order?._id,
      direction: direction === 'sent' ? 'outflow' : 'inflow',
      provider,
      providerPaymentId: txnId,
      providerOrderId,
      amount: normalizedAmount,
      currency,
      paymentMethod: ['UPI', 'Card', 'Cash', 'NetBanking'].includes(paymentMethod) ? paymentMethod : 'UPI',
      paymentStatus,
      isTest,
      utrNumber,
      processedAt: new Date(),
    });

    if (targetUserId) {
      sseService.emitToUser(targetUserId, 'payment.failed', {
        provider,
        providerPaymentId: txnId,
        paymentStatus,
        amount: normalizedAmount,
        orderId: order?._id,
      });
    }

    return {
      duplicate: false,
      success: false,
      status: paymentStatus,
      record: nonSuccessTxn,
      message: `Payment status ${paymentStatus} recorded. No revenue or inventory modified.`,
    };
  }

  // 3. For Outgoing Payments (Expense / Outflow)
  if (direction === 'sent') {
    let targetUserId = userId;
    if (!targetUserId) {
      const defaultUser = (await User.findOne({ email: 'user212@gmail.com' })) || (await User.findOne());
      targetUserId = defaultUser?._id;
    }

    const validCategories = ['Stock', 'Rent', 'Electricity', 'Salary', 'Transport', 'Other'];
    const safeCategory = validCategories.includes(category) ? category : 'Stock';

    const expense = await Expense.create({
      userId: targetUserId,
      amount: normalizedAmount,
      category: safeCategory,
      paidTo: paidTo ? paidTo.trim() : '',
      paymentMethod: ['UPI', 'Card'].includes(paymentMethod) ? paymentMethod : 'UPI',
      upiApp: paymentMethod === 'UPI' ? (upiApp || provider) : '',
      utrNumber: utrNumber || txnId,
      description: description || (paidTo ? `Paid to ${paidTo} via ${provider}` : `Payment sent via ${provider} for ${safeCategory}`),
      entryMethod: 'automatic',
      paymentStatus: 'success',
      provider,
      providerTransactionId: txnId,
      isTest,
      currency,
    });

    await PaymentTransaction.create({
      userId: targetUserId,
      expenseId: expense._id,
      direction: 'outflow',
      provider,
      providerPaymentId: txnId,
      providerOrderId,
      amount: normalizedAmount,
      currency,
      paymentMethod: ['UPI', 'Card'].includes(paymentMethod) ? paymentMethod : 'UPI',
      paymentStatus: 'success',
      isTest,
      utrNumber,
      processedAt: new Date(),
    });

    // Real-Time SSE
    sseService.emitToUser(targetUserId, 'expense.created', {
      expenseId: expense._id,
      amount: normalizedAmount,
      category: safeCategory,
      paymentMethod,
      provider,
      isTest,
    });
    sseService.emitToUser(targetUserId, 'transaction.created', {
      transactionId: txnId,
      amount: normalizedAmount,
      type: 'Expense',
      isTest,
    });

    console.log(`[PAYMENT] Automatic Outflow (Expense) Recorded: ${paymentMethod} ₹${normalizedAmount} [${txnId}]`);
    return { duplicate: false, success: true, record: expense, type: 'Expense' };
  }

  // 4. For Incoming Payments (Sale / Inflow):
  let associatedOrder = null;
  if (providerOrderId) {
    associatedOrder = await Order.findOne({
      $or: [
        { providerOrderId },
        { orderNumber: providerOrderId },
        ...(mongoose.isValidObjectId(providerOrderId) ? [{ _id: providerOrderId }] : []),
      ],
    });
  }

  // CASE A: Payment is linked to an ORDER -> Validate amount & deduct inventory safely
  if (associatedOrder) {
    const targetUserId = associatedOrder.userId;

    // Validate expected amount against backend authoritative total
    const expectedAmount = Number(associatedOrder.totalAmount);
    if (Math.abs(expectedAmount - normalizedAmount) > 0.01) {
      console.error(`[PAYMENT] Security Alert: Amount mismatch for order ${associatedOrder.orderNumber}! Expected: ₹${expectedAmount}, Received: ₹${normalizedAmount}`);

      await PaymentTransaction.create({
        userId: targetUserId,
        orderId: associatedOrder._id,
        direction: 'inflow',
        provider,
        providerPaymentId: txnId,
        providerOrderId: associatedOrder.providerOrderId,
        amount: normalizedAmount,
        currency,
        paymentMethod: ['UPI', 'Card'].includes(paymentMethod) ? paymentMethod : 'UPI',
        paymentStatus: 'failed',
        isTest,
        utrNumber,
        processedAt: new Date(),
      });

      return {
        duplicate: false,
        success: false,
        error: 'AmountMismatch',
        message: `Amount mismatch. Order requires ₹${expectedAmount}, but received ₹${normalizedAmount}.`,
      };
    }

    // Mark Order as Paid
    associatedOrder.status = 'paid';
    associatedOrder.paidAt = new Date();
    associatedOrder.providerPaymentId = txnId;

    // Deduct stock for products EXACTLY ONCE
    if (!associatedOrder.inventoryDeducted) {
      for (const item of associatedOrder.items) {
        const product = await Product.findOne({ _id: item.productId, userId: targetUserId });
        if (product) {
          const previousStock = product.stockQuantity;
          product.stockQuantity = Math.max(0, product.stockQuantity - item.quantity);
          await product.save();

          await InventoryMovement.create({
            userId: targetUserId,
            productId: product._id,
            orderId: associatedOrder._id,
            type: 'sale_deduction',
            quantityChanged: -item.quantity,
            previousStock,
            newStock: product.stockQuantity,
            reason: `Order ${associatedOrder.orderNumber} paid via ${provider}`,
          });
        }
      }
      associatedOrder.inventoryDeducted = true;
    }
    await associatedOrder.save();

    const safeMethod = ['GPay', 'PhonePe', 'Other UPI', 'Card', 'Cash', 'UPI'].includes(paymentMethod)
      ? paymentMethod
      : (provider?.toLowerCase().includes('phonepe') || upiApp?.toLowerCase().includes('phonepe'))
      ? 'PhonePe'
      : (provider?.toLowerCase().includes('google') || provider?.toLowerCase().includes('gpay') || upiApp?.toLowerCase().includes('google'))
      ? 'GPay'
      : paymentMethod === 'Card' ? 'Card' : 'Other UPI';

    // Create Sale record
    const sale = await Sale.create({
      userId: targetUserId,
      orderId: associatedOrder._id,
      amount: normalizedAmount,
      paymentMethod: safeMethod,
      verificationStatus: 'verified',
      upiApp: ['GPay', 'PhonePe', 'Other UPI', 'UPI'].includes(safeMethod) ? (upiApp || provider) : '',
      utrNumber: utrNumber || txnId,
      referenceNumber: utrNumber || txnId,
      description: description || `Order #${associatedOrder.orderNumber} paid via ${provider}`,
      entryMethod: 'automatic',
      paymentStatus: 'success',
      provider,
      providerTransactionId: txnId,
      isTest: isTest || associatedOrder.isTest,
      currency,
    });

    // Record PaymentTransaction
    await PaymentTransaction.create({
      userId: targetUserId,
      orderId: associatedOrder._id,
      saleId: sale._id,
      direction: 'inflow',
      provider,
      providerPaymentId: txnId,
      providerOrderId: associatedOrder.providerOrderId,
      amount: normalizedAmount,
      currency,
      paymentMethod: ['UPI', 'Card'].includes(paymentMethod) ? paymentMethod : 'UPI',
      paymentStatus: 'success',
      isTest: isTest || associatedOrder.isTest,
      utrNumber,
      processedAt: new Date(),
    });

    // Dispatch real-time SSE notifications
    sseService.emitToUser(targetUserId, 'payment.success', {
      provider,
      providerPaymentId: txnId,
      orderId: associatedOrder._id,
      orderNumber: associatedOrder.orderNumber,
      amount: normalizedAmount,
      paymentMethod,
      isTest: sale.isTest,
    });
    sseService.emitToUser(targetUserId, 'sale.created', {
      saleId: sale._id,
      amount: normalizedAmount,
      isTest: sale.isTest,
    });
    sseService.emitToUser(targetUserId, 'inventory.updated', {
      orderId: associatedOrder._id,
      orderNumber: associatedOrder.orderNumber,
    });
    sseService.emitToUser(targetUserId, 'transaction.created', {
      transactionId: txnId,
      amount: normalizedAmount,
      type: 'Sale',
      isTest: sale.isTest,
    });

    console.log(`[PAYMENT] Order ${associatedOrder.orderNumber} finalized: ₹${normalizedAmount} [${txnId}]. Stock deducted.`);
    return { duplicate: false, success: true, record: sale, type: 'Sale', order: associatedOrder };
  }

  // CASE B: Payment does NOT have an associated product order (e.g. direct UPI QR scan / Direct link)
  // Per requirement #9: "If a payment cannot be associated with a known product order:
  // record/flag it appropriately if necessary, BUT DO NOT automatically deduct product inventory."
  let targetUserId = userId;
  if (!targetUserId) {
    const defaultUser = (await User.findOne({ email: 'user212@gmail.com' })) || (await User.findOne());
    targetUserId = defaultUser?._id;
  }

  const safeMethod = ['GPay', 'PhonePe', 'Other UPI', 'Card', 'Cash', 'UPI'].includes(paymentMethod)
    ? paymentMethod
    : (provider?.toLowerCase().includes('phonepe') || upiApp?.toLowerCase().includes('phonepe'))
    ? 'PhonePe'
    : (provider?.toLowerCase().includes('google') || provider?.toLowerCase().includes('gpay') || upiApp?.toLowerCase().includes('google'))
    ? 'GPay'
    : paymentMethod === 'Card' ? 'Card' : 'Other UPI';

  const sale = await Sale.create({
    userId: targetUserId,
    amount: normalizedAmount,
    paymentMethod: safeMethod,
    verificationStatus: 'verified',
    upiApp: ['GPay', 'PhonePe', 'Other UPI', 'UPI'].includes(safeMethod) ? (upiApp || provider) : '',
    utrNumber: utrNumber || txnId,
    referenceNumber: utrNumber || txnId,
    description: description || `Direct payment received via ${provider}`,
    entryMethod: 'automatic',
    paymentStatus: 'success',
    provider,
    providerTransactionId: txnId,
    isTest,
    currency,
  });

  await PaymentTransaction.create({
    userId: targetUserId,
    saleId: sale._id,
    direction: 'inflow',
    provider,
    providerPaymentId: txnId,
    providerOrderId: '',
    amount: normalizedAmount,
    currency,
    paymentMethod: safeMethod,
    verificationStatus: 'verified',
    paymentStatus: 'success',
    isTest,
    utrNumber,
    processedAt: new Date(),
  });

  // Real-time SSE
  const paymentPayload = {
    provider,
    providerPaymentId: txnId,
    amount: normalizedAmount,
    paymentMethod,
    utrNumber: utrNumber || txnId,
    description: sale.description,
    isTest,
  };
  sseService.emitToUser(targetUserId, 'payment.success', paymentPayload);
  sseService.broadcast('payment.success', paymentPayload);

  sseService.emitToUser(targetUserId, 'sale.created', {
    saleId: sale._id,
    amount: normalizedAmount,
    isTest,
  });
  sseService.broadcast('sale.created', {
    saleId: sale._id,
    amount: normalizedAmount,
    isTest,
  });

  sseService.emitToUser(targetUserId, 'transaction.created', {
    transactionId: txnId,
    amount: normalizedAmount,
    type: 'Sale',
    isTest,
  });
  sseService.broadcast('transaction.created', {
    transactionId: txnId,
    amount: normalizedAmount,
    type: 'Sale',
    isTest,
  });

  console.log(`[PAYMENT] Direct Sale Recorded (no inventory deduction): ${paymentMethod} ₹${normalizedAmount} [${txnId}]`);
  return { duplicate: false, success: true, record: sale, type: 'Sale' };
};
