import mongoose from 'mongoose';

const inventoryMovementSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Order',
      index: true,
    },
    type: {
      type: String,
      enum: ['sale_deduction', 'restock', 'adjustment', 'return_restock'],
      required: true,
    },
    quantityChanged: {
      type: Number,
      required: true,
    },
    previousStock: {
      type: Number,
      required: true,
    },
    newStock: {
      type: Number,
      required: true,
    },
    reason: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

inventoryMovementSchema.index({ userId: 1, productId: 1, createdAt: -1 });

const InventoryMovement = mongoose.model('InventoryMovement', inventoryMovementSchema);
export default InventoryMovement;
