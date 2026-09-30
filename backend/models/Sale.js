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
      enum: ['Cash', 'UPI', 'Card'],
      default: 'Cash',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
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
    providerTransactionId: {
      type: String,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

const Sale = mongoose.model('Sale', saleSchema);
export default Sale;
