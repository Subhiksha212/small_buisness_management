import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Please enter product name'],
      trim: true,
    },
    sku: {
      type: String,
      trim: true,
      default: '',
    },
    price: {
      type: Number,
      required: [true, 'Please enter product selling price'],
      min: [0, 'Price must be 0 or greater'],
    },
    costPrice: {
      type: Number,
      default: 0,
      min: [0, 'Cost price must be 0 or greater'],
    },
    stockQuantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Stock quantity cannot be negative'],
    },
    category: {
      type: String,
      default: 'General',
      trim: true,
    },
    minStockThreshold: {
      type: Number,
      default: 5,
      min: [0, 'Threshold cannot be negative'],
    },
    expiryDate: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ userId: 1, name: 1 });

const Product = mongoose.model('Product', productSchema);
export default Product;
