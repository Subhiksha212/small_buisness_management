import Product from '../models/Product.js';
import InventoryMovement from '../models/InventoryMovement.js';
import Sale from '../models/Sale.js';
import sseService from '../services/sseService.js';

// Get all products for authenticated user
export const getProducts = async (req, res) => {
  try {
    const { category, search, lowStock } = req.query;
    const query = { userId: req.user._id, isActive: true };

    if (category && category !== 'All') {
      query.category = category;
    }

    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: 'i' };
    }

    const products = await Product.find(query).sort({ name: 1 });

    if (lowStock === 'true') {
      const filtered = products.filter((p) => p.stockQuantity <= (p.minStockThreshold !== undefined ? p.minStockThreshold : 5));
      return res.status(200).json(filtered);
    }

    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Failed to fetch products' });
  }
};

// Create a new product
export const createProduct = async (req, res) => {
  try {
    const { name, sku, price, costPrice, stockQuantity, minStockThreshold, category, expiryDate } = req.body;

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
      minStockThreshold: minStockThreshold !== undefined ? Number(minStockThreshold) : 5,
      category: category ? category.trim() : 'General',
      expiryDate: expiryDate ? new Date(expiryDate) : null,
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

    sseService.emitToUser(req.user._id, 'inventory.changed', {
      productId: product._id,
      name: product.name,
      stock: product.stockQuantity,
    });

    res.status(201).json(product);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Failed to create product' });
  }
};

// Update an existing product
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, sku, price, costPrice, minStockThreshold, category, expiryDate } = req.body;

    const product = await Product.findOne({ _id: id, userId: req.user._id, isActive: true });
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    if (name) product.name = name.trim();
    if (sku !== undefined) product.sku = sku.trim();
    if (price !== undefined) product.price = Number(price);
    if (costPrice !== undefined) product.costPrice = Number(costPrice);
    if (minStockThreshold !== undefined) product.minStockThreshold = Number(minStockThreshold);
    if (category) product.category = category.trim();
    if (expiryDate !== undefined) product.expiryDate = expiryDate ? new Date(expiryDate) : null;

    await product.save();

    res.status(200).json({ message: 'Product updated successfully.', product });
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Failed to update product' });
  }
};

// Delete (archive) a product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await Product.findOne({ _id: id, userId: req.user._id });
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' });
    }

    product.isActive = false;
    await product.save();

    res.status(200).json({ message: 'Product removed successfully.' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Failed to remove product' });
  }
};

// Adjust stock / Restock / Return Restock product manually
export const adjustStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, type = 'restock', reason = 'Manual adjustment' } = req.body;

    const qty = Number(quantity);
    if (!qty || isNaN(qty)) {
      return res.status(400).json({ message: 'Valid adjustment quantity is required.' });
    }

    const product = await Product.findOne({ _id: id, userId: req.user._id, isActive: true });
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

    const movementType = ['restock', 'adjustment', 'return_restock', 'sale_deduction'].includes(type)
      ? type
      : qty > 0 ? 'restock' : 'adjustment';

    await InventoryMovement.create({
      userId: req.user._id,
      productId: product._id,
      type: movementType,
      quantityChanged: qty,
      previousStock,
      newStock,
      reason,
    });

    // Check low stock
    const threshold = product.minStockThreshold !== undefined ? product.minStockThreshold : 5;
    if (newStock <= threshold) {
      sseService.emitToUser(req.user._id, 'low.stock.alert', {
        productId: product._id,
        productName: product.name,
        currentStock: newStock,
        threshold,
      });
    }

    sseService.emitToUser(req.user._id, 'inventory.changed', {
      productId: product._id,
      name: product.name,
      stock: newStock,
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

// Get inventory movements audit history
export const getInventoryMovements = async (req, res) => {
  try {
    const { productId, limit = 50 } = req.query;
    const query = { userId: req.user._id };
    if (productId) {
      query.productId = productId;
    }

    const movements = await InventoryMovement.find(query)
      .populate('productId', 'name sku price category')
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.status(200).json(movements);
  } catch (error) {
    console.error('Error fetching inventory movements:', error);
    res.status(500).json({ message: 'Failed to fetch inventory movements.' });
  }
};

// Get products below low stock threshold
export const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({ userId: req.user._id, isActive: true });
    const lowStockItems = products.filter(
      (p) => p.stockQuantity <= (p.minStockThreshold !== undefined ? p.minStockThreshold : 5)
    );
    res.status(200).json(lowStockItems);
  } catch (error) {
    console.error('Error fetching low stock products:', error);
    res.status(500).json({ message: 'Failed to fetch low stock products.' });
  }
};

// Get Inventory Reports (total stock value, reorder suggestions, best sellers)
export const getInventoryReports = async (req, res) => {
  try {
    const userId = req.user._id;
    const products = await Product.find({ userId, isActive: true });

    let totalStockValueAtCost = 0;
    let totalStockValueAtRetail = 0;
    let outOfStockCount = 0;
    const lowStockItems = [];
    const reorderSuggestions = [];

    products.forEach((p) => {
      const threshold = p.minStockThreshold !== undefined ? p.minStockThreshold : 5;
      const stock = p.stockQuantity || 0;
      const cost = p.costPrice || 0;
      const price = p.price || 0;

      totalStockValueAtCost += stock * cost;
      totalStockValueAtRetail += stock * price;

      if (stock === 0) {
        outOfStockCount++;
      }

      if (stock <= threshold) {
        lowStockItems.push(p);
        reorderSuggestions.push({
          productId: p._id,
          name: p.name,
          currentStock: stock,
          minStockThreshold: threshold,
          recommendedReorderQty: Math.max(10, threshold * 2 - stock),
          unitCost: cost,
          estimatedReorderCost: Math.max(10, threshold * 2 - stock) * cost,
        });
      }
    });

    // Best-selling products from sales in last 60 days
    const recentSales = await Sale.find({
      userId,
      paymentStatus: 'success',
      isTest: { $ne: true },
      createdAt: { $gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
    }).lean();

    const productSalesCount = {};
    recentSales.forEach((sale) => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item) => {
          const key = String(item.productId || item.name);
          if (!productSalesCount[key]) {
            productSalesCount[key] = {
              name: item.name,
              quantitySold: 0,
              revenue: 0,
            };
          }
          productSalesCount[key].quantitySold += item.quantity || 1;
          productSalesCount[key].revenue += (item.unitPrice || 0) * (item.quantity || 1);
        });
      }
    });

    const bestSellers = Object.values(productSalesCount)
      .sort((a, b) => b.quantitySold - a.quantitySold)
      .slice(0, 5);

    res.status(200).json({
      totalProducts: products.length,
      outOfStockCount,
      lowStockCount: lowStockItems.length,
      totalStockValueAtCost: Math.round(totalStockValueAtCost * 100) / 100,
      totalStockValueAtRetail: Math.round(totalStockValueAtRetail * 100) / 100,
      lowStockItems,
      reorderSuggestions,
      bestSellers,
    });
  } catch (error) {
    console.error('Error calculating inventory reports:', error);
    res.status(500).json({ message: 'Failed to calculate inventory reports.' });
  }
};

// Lookup product by QR code, SKU, or MongoDB ObjectId
export const lookupProductByCode = async (req, res) => {
  try {
    const { code } = req.query;
    if (!code || !code.trim()) {
      return res.status(400).json({ message: 'Product code or identifier is required' });
    }

    const cleanCode = code.trim();
    const userId = req.user._id;

    let product = null;

    // 1. Try matching by ObjectId if it matches 24 hex chars
    if (cleanCode.match(/^[0-9a-fA-F]{24}$/)) {
      product = await Product.findOne({ _id: cleanCode, userId, isActive: true });
    }

    // 2. Try exact SKU match (case-insensitive)
    if (!product) {
      product = await Product.findOne({
        userId,
        isActive: true,
        sku: { $regex: `^${cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      });
    }

    // 3. Try exact Name match (case-insensitive)
    if (!product) {
      product = await Product.findOne({
        userId,
        isActive: true,
        name: { $regex: `^${cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      });
    }

    // 4. Try partial match on SKU or Name
    if (!product) {
      product = await Product.findOne({
        userId,
        isActive: true,
        $or: [
          { sku: { $regex: cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
          { name: { $regex: cleanCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } },
        ],
      });
    }

    if (!product) {
      return res.status(404).json({ message: 'No product found matching this code.' });
    }

    res.status(200).json(product);
  } catch (error) {
    console.error('Error looking up product by code:', error);
    res.status(500).json({ message: 'Failed to look up product' });
  }
};

// Seed sample products with realistic QR code data for instant testing
export const seedSampleProducts = async (req, res) => {
  try {
    const userId = req.user._id;
    const existingCount = await Product.countDocuments({ userId, isActive: true });

    const sampleProducts = [
      {
        name: 'India Gate Basmati Rice 1kg',
        sku: 'RICE-BAS-1KG',
        price: 135,
        costPrice: 105,
        stockQuantity: 45,
        minStockThreshold: 10,
        category: 'Grocery',
      },
      {
        name: 'Amul Butter 500g',
        sku: 'AMUL-BTR-500G',
        price: 275,
        costPrice: 240,
        stockQuantity: 28,
        minStockThreshold: 5,
        category: 'Dairy',
      },
      {
        name: 'Fortune Sunlite Sunflower Oil 1L',
        sku: 'OIL-SUN-1L',
        price: 160,
        costPrice: 130,
        stockQuantity: 32,
        minStockThreshold: 8,
        category: 'Grocery',
      },
      {
        name: 'Tata Tea Gold 250g',
        sku: 'TEA-GOLD-250G',
        price: 150,
        costPrice: 120,
        stockQuantity: 20,
        minStockThreshold: 6,
        category: 'Beverages',
      },
      {
        name: 'Dettol Original Soap 125g (Pack of 3)',
        sku: 'DETTOL-SOAP-3P',
        price: 180,
        costPrice: 145,
        stockQuantity: 15,
        minStockThreshold: 5,
        category: 'Personal Care',
      },
    ];

    const created = [];
    for (const item of sampleProducts) {
      const exists = await Product.findOne({ userId, sku: item.sku, isActive: true });
      if (!exists) {
        const prod = await Product.create({ ...item, userId });
        await InventoryMovement.create({
          userId,
          productId: prod._id,
          type: 'restock',
          quantityChanged: prod.stockQuantity,
          previousStock: 0,
          newStock: prod.stockQuantity,
          reason: 'Initial demo catalog intake',
        });
        created.push(prod);
      }
    }

    res.status(200).json({
      message: `Populated ${created.length} sample products with barcodes/SKUs.`,
      created,
      totalCount: existingCount + created.length,
    });
  } catch (error) {
    console.error('Error seeding sample products:', error);
    res.status(500).json({ message: 'Failed to seed sample products.' });
  }
};

