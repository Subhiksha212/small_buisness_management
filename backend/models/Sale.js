import mongoose from 'mongoose';

const saleSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please enter sale amount'],
      min: [1, 'Amount must be greater than 0'],
    },
    paymentMethod: {
      type: String,
      required: [true, 'Please select payment method'],
      enum: ['Cash', 'GPay', 'PhonePe', 'Other UPI', 'UPI', 'Card'],
      default: 'Cash',
    },
    verificationStatus: {
      type: String,
      enum: ['verified', 'pending_verification', 'manual_entry', 'provider_verified', 'sandbox_test'],
      default: 'manual_entry',
      index: true,
    },
    saleDate: {
      type: Date,
      default: Date.now,
    },
    referenceNumber: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    costOfGoodsSold: {
      type: Number,
      default: 0,
      min: [0, 'Cost of goods sold cannot be negative'],
    },
    items: [
      {
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String, default: '' },
        quantity: { type: Number, default: 1 },
        unitPrice: { type: Number, default: 0 },
        costPrice: { type: Number, default: 0 },
      },
    ],
    entryMethod: {
      type: String,
      enum: ['manual', 'automatic', 'scanned'],
      default: 'manual',
    },
    paymentStatus: {
      type: String,
      enum: ['recorded', 'pending', 'success', 'failed', 'refunded'],
      default: 'recorded',
    },
    provider: {
      type: String,
      default: 'Manual',
    },
    upiApp: {
      type: String,
      default: 'Google Pay',
    },
    utrNumber: {
      type: String,
      trim: true,
      default: '',
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    currency: {
      type: String,
      default: 'INR',
    },
    isTest: {
      type: Boolean,
      default: false,
      index: true,
    },
    providerOrderId: {
      type: String,
      trim: true,
      default: '',
    },
    providerTransactionId: {
      type: String,
      sparse: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

saleSchema.index({ userId: 1, createdAt: -1 });
saleSchema.index({ userId: 1, isTest: 1, paymentStatus: 1 });
saleSchema.index({ userId: 1, utrNumber: 1 });

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
