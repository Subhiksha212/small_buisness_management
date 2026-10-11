import Product from '../models/Product.js';
import InventoryMovement from '../models/InventoryMovement.js';

// Get all products for authenticated user
export const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ userId: req.user._id, isActive: true }).sort({ name: 1 });
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Create a new product
export const createProduct = async (req, res) => {
  try {
    const { name, sku, price, costPrice, stockQuantity, category } = req.body;

    if (!name || price === undefined) {
      return res.status(400).json({ message: 'Product name and selling price are required.' });
    }

    const product = await Product.create({
      userId: req.user._id,
      name: name.trim(),
      sku: sku ? sku.trim() : '',
      price: Number(price),
      costPrice: costPrice !== undefined ? Number(costPrice) : 0,
      stockQuantity: stockQuantity !== undefined ? Number(stockQuantity) : 0,
      category: category ? category.trim() : 'General',
    });

    if (product.stockQuantity > 0) {
      await InventoryMovement.create({
        userId: req.user._id,
        productId: product._id,
        type: 'restock',
        quantityChanged: product.stockQuantity,
        previousStock: 0,
        newStock: product.stockQuantity,
        reason: 'Initial stock intake',
      });
    }

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product' });
  }
};

// Adjust stock / Restock product manually
export const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, reason = 'Manual adjustment' } = req.body;

    const qty = Number(quantity);
    if (!qty || isNaN(qty)) {
      return res.status(400).json({ message: 'Valid adjustment quantity is required.' });
    }

    const product = await Product.findOne({ _id: id, userId: req.user._id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    const previousStock = product.stockQuantity;
    const newStock = previousStock + qty;

    if (newStock < 0) {
      return res.status(400).json({ message: `Insufficient stock. Current stock is ${previousStock}.` });
    }

    product.stockQuantity = newStock;
    await product.save();

    await InventoryMovement.create({
      userId: req.user._id,
      productId: product._id,
      type: qty > 0 ? 'restock' : 'adjustment',
      quantityChanged: qty,
      previousStock,
      newStock,
      reason,
    });

    res.status(200).json({
      message: 'Stock updated successfully.',
      product,
    });
  } catch (error) {
    console.error('Error adjusting stock:', error);
    res.status(500).json({ message: 'Failed to adjust stock' });
  }
};
