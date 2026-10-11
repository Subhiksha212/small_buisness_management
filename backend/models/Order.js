import mongoose from 'mongoose';

const orderItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [0, 'Unit price cannot be negative'],
    },
    totalPrice: {
      type: Number,
      required: true,
      min: [0, 'Total price cannot be negative'],
    },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    orderNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
      min: [0, 'Total amount cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'paid', 'failed', 'refunded', 'cancelled'],
      default: 'pending',
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ['UPI', 'Card', 'Cash'],
      default: 'UPI',
    },
    provider: {
      type: String,
      default: 'Razorpay',
    },
    providerOrderId: {
      type: String,
      sparse: true,
      index: true,
    },
    providerPaymentId: {
      type: String,
      sparse: true,
    },
    isTest: {
      type: Boolean,
      default: false,
    },
    paidAt: {
      type: Date,
    },
    inventoryDeducted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
