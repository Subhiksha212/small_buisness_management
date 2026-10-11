import Order from '../models/Order.js';
import Product from '../models/Product.js';

/**
 * Create Order: POST /api/orders
 * Strictly calculates totals on BACKEND. Frontend quantities and product IDs are validated
 * against server prices. Frontend cannot manipulate prices or final amounts.
 */
export const createOrder = async (req, res) => {
  try {
    const { items, paymentMethod = 'UPI', provider = 'Razorpay' } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item.' });
    }

    let calculatedTotal = 0;
    const orderItems = [];

    // Validate each item and calculate price strictly on server
    for (const item of items) {
      if (!item.productId || !item.quantity || Number(item.quantity) <= 0) {
        return res.status(400).json({ message: 'Invalid product or quantity specified.' });
      }

      const product = await Product.findOne({ _id: item.productId, userId: req.user._id, isActive: true });
      if (!product) {
        return res.status(404).json({ message: `Product not found or inactive: ${item.productId}` });
      }

      const qty = Math.floor(Number(item.quantity));
      if (product.stockQuantity < qty) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${qty}.`,
        });
      }

      const unitPrice = product.price; // AUTHORITATIVE SERVER PRICE
      const itemTotal = unitPrice * qty;
      calculatedTotal += itemTotal;

      orderItems.push({
        productId: product._id,
        name: product.name,
        quantity: qty,
        unitPrice,
        totalPrice: itemTotal,
      });
    }

    const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const isTest = process.env.PAYMENT_ENV === 'sandbox' || process.env.NODE_ENV !== 'production';

    const order = await Order.create({
      userId: req.user._id,
      orderNumber,
      items: orderItems,
      totalAmount: calculatedTotal,
      currency: 'INR',
      status: 'pending',
      paymentMethod,
      provider,
      providerOrderId: `ORDER_${orderNumber}`,
      isTest,
      inventoryDeducted: false,
    });

    res.status(201).json({
      message: 'Order created with server-calculated amount.',
      order: {
        _id: order._id,
        orderNumber: order.orderNumber,
        items: order.items,
        totalAmount: order.totalAmount,
        currency: order.currency,
        status: order.status,
        provider: order.provider,
        providerOrderId: order.providerOrderId,
        isTest: order.isTest,
      },
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Failed to create order.' });
  }
};

/**
 * Get Orders: GET /api/orders
 */
export const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.status(200).json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders.' });
  }
};

/**
 * Get Order by ID: GET /api/orders/:id
 */
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ message: 'Order not found.' });
    }
    res.status(200).json(order);
  } catch (error) {
    console.error('Error fetching order by ID:', error);
    res.status(500).json({ message: 'Failed to fetch order.' });
  }
};
