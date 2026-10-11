import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Please enter expense amount'],
      min: [1, 'Amount must be greater than 0'],
    },
    category: {
      type: String,
      required: [true, 'Please select expense category'],
      enum: ['Stock', 'Rent', 'Electricity', 'Salary', 'Transport', 'Other'],
      default: 'Other',
    },
    paymentMethod: {
      type: String,
      enum: ['Cash', 'UPI', 'Card'],
      default: 'Cash',
    },
    paidTo: {
      type: String,
      trim: true,
      default: '',
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
    currency: {
      type: String,
      default: 'INR',
    },
    isTest: {
      type: Boolean,
      default: false,
      index: true,
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

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
