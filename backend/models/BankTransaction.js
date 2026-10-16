import mongoose from 'mongoose';

const bankTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    consentId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      index: true,
    },
    accountMasked: {
      type: String,
      trim: true,
      default: '',
    },
    fipId: {
      type: String,
      trim: true,
      default: 'SETU-FIP',
    },
    txnId: {
      type: String,
      required: true,
      trim: true,
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ['CREDIT', 'DEBIT'],
      required: true,
    },
    direction: {
      type: String,
      enum: ['inflow', 'outflow'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, 'Amount must be non-negative'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    mode: {
      type: String,
      default: 'UPI',
    },
    narration: {
      type: String,
      trim: true,
      default: '',
    },
    reference: {
      type: String,
      trim: true,
      default: '',
    },
    currentBalance: {
      type: Number,
      default: null,
    },
    transactionTimestamp: {
      type: Date,
      default: Date.now,
    },
    valueDate: {
      type: Date,
      default: null,
    },
    isTest: {
      type: Boolean,
      default: true,
      index: true,
    },
    source: {
      type: String,
      default: 'setu_aa_sandbox',
    },
    classification: {
      type: String,
      enum: ['unclassified', 'business_sale', 'business_expense', 'personal_transfer'],
      default: 'unclassified',
      index: true,
    },
    isReconciled: {
      type: Boolean,
      default: false,
    },
    alreadyExistsInApp: {
      type: Boolean,
      default: false,
    },
    linkedSaleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Sale',
    },
    linkedExpenseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Expense',
    },
  },
  {
    timestamps: true,
  }
);

bankTransactionSchema.index({ userId: 1, createdAt: -1 });
bankTransactionSchema.index({ userId: 1, reference: 1 });
bankTransactionSchema.index({ userId: 1, consentId: 1 });

const BankTransaction = mongoose.model('BankTransaction', bankTransactionSchema);
export default BankTransaction;
