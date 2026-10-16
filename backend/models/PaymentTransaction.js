import mongoose from 'mongoose';

const paymentTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    saleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
      index: true,
    },
    expenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
      index: true,
    },
    direction: {
      type: String,
      enum: ['inflow', 'outflow'],
      default: 'inflow',
      required: true,
    },
    provider: {
      type: String,
      required: true,
      trim: true,
    },
    providerPaymentId: {
      type: String,
      required: true,
      trim: true,
    },
    providerOrderId: {
      type: String,
      trim: true,
      default: '',
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be 0 or greater'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Card', 'Cash', 'NetBanking', 'GPay', 'PhonePe', 'Other UPI'],
      default: 'UPI',
    },
    verificationStatus: {
      type: String,
      enum: ['verified', 'pending_verification', 'manual_entry', 'provider_verified', 'sandbox_test'],
      default: 'verified',
    },
    paymentStatus: {
      type: String,
      enum: ['pending', 'success', 'failed', 'refunded'],
      default: 'pending',
      required: true,
      index: true,
    },
    isTest: {
      type: Boolean,
      default: false,
      index: true,
    },
    utrNumber: {
      type: String,
      trim: true,
      default: '',
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Idempotency: Unique compound constraint on provider + providerPaymentId
paymentTransactionSchema.index({ provider: 1, providerPaymentId: 1 }, { unique: true });
paymentTransactionSchema.index({ userId: 1, createdAt: -1 });

const PaymentTransaction = mongoose.model('PaymentTransaction', paymentTransactionSchema);
export default PaymentTransaction;
