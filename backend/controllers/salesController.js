import mongoose from 'mongoose';
import Sale from '../models/Sale.js';
import Product from '../models/Product.js';
import InventoryMovement from '../models/InventoryMovement.js';
import sseService from '../services/sseService.js';


// Add a new sale for authenticated user (Cash, GPay, PhonePe, Other UPI, Card)
export const addSale = async (req, res) => {
  try {
    const {
      amount,
      paymentMethod = 'Cash',
      description,
      entryMethod = 'manual',
      verificationStatus = 'manual_entry',
      upiApp = '',
      utrNumber = '',
      referenceNumber = '',
      saleDate,
      items,
    } = req.body;

    const validMethods = ['Cash', 'GPay', 'PhonePe', 'Other UPI', 'UPI', 'Card'];
    const chosenMethod = validMethods.includes(paymentMethod) ? paymentMethod : 'Cash';
    const cleanRef = (referenceNumber || utrNumber || '').trim();

    // Duplicate reference check for UPI
    if (cleanRef) {
      const duplicate = await Sale.findOne({
        userId: req.user._id,
        $or: [{ utrNumber: cleanRef }, { referenceNumber: cleanRef }],
      });
      if (duplicate) {
        return res.status(409).json({
          message: `Warning: A transaction with reference #${cleanRef} was already recorded on ${new Date(duplicate.createdAt).toLocaleDateString()}.`,
          duplicateId: duplicate._id,
        });
      }
    }

    // Map verificationStatus & paymentStatus
    const validVerificationStatuses = ['verified', 'pending_verification', 'manual_entry', 'provider_verified', 'sandbox_test'];
    const safeVerificationStatus = validVerificationStatuses.includes(verificationStatus)
      ? verificationStatus
      : 'manual_entry';

    const safePaymentStatus = safeVerificationStatus === 'pending_verification' ? 'pending' : 'success';

    const inferredProvider = chosenMethod === 'GPay'
      ? 'Google Pay'
      : chosenMethod === 'PhonePe'
      ? 'PhonePe'
      : chosenMethod === 'Other UPI'
      ? (upiApp || 'UPI')
      : chosenMethod === 'Card'
      ? 'Card POS'
      : 'Manual';

    // Handle optional itemized products
    let calculatedAmount = Number(amount) || 0;
    let calculatedCogs = 0;
    const saleItems = [];

    if (items && Array.isArray(items) && items.length > 0) {
      let itemsTotal = 0;
      for (const item of items) {
        let product = null;

        // Try lookup by ObjectId if valid
        if (item.productId && mongoose.Types.ObjectId.isValid(String(item.productId))) {
          product = await Product.findOne({ _id: item.productId, userId: req.user._id, isActive: true });
        }

        // Try lookup by SKU
        if (!product && item.productId) {
          product = await Product.findOne({ sku: String(item.productId), userId: req.user._id, isActive: true });
        }

        // Try lookup by name
        if (!product && item.name) {
          product = await Product.findOne({ name: String(item.name), userId: req.user._id, isActive: true });
        }

        const qty = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = product ? product.price : (Number(item.unitPrice) || 0);
        const costPrice = product ? (product.costPrice || 0) : (Number(item.costPrice) || 0);
        const itemTotal = unitPrice * qty;

        itemsTotal += itemTotal;
        calculatedCogs += costPrice * qty;

        saleItems.push({
          productId: product ? product._id : undefined,
          name: product ? product.name : (item.name || 'Scanned Item'),
          quantity: qty,
          unitPrice,
          costPrice,
        });

        // Decrement inventory if product is in DB and payment is finalized
        if (product && safePaymentStatus === 'success') {
          const prevStock = product.stockQuantity;
          product.stockQuantity = Math.max(0, product.stockQuantity - qty);
          await product.save();

          await InventoryMovement.create({
            userId: req.user._id,
            productId: product._id,
            type: 'sale_deduction',
            quantityChanged: -qty,
            previousStock: prevStock,
            newStock: product.stockQuantity,
            reason: `Direct sale deduction (${chosenMethod})`,
          });

          const threshold = product.minStockThreshold !== undefined ? product.minStockThreshold : 5;
          if (product.stockQuantity <= threshold) {
            sseService.emitToUser(req.user._id, 'low.stock.alert', {
              productId: product._id,
              productName: product.name,
              currentStock: product.stockQuantity,
              threshold,
            });
          }
        }
      }
      if (itemsTotal > 0 && (!amount || Number(amount) <= 0)) {
        calculatedAmount = itemsTotal;
      }
    }


    if (calculatedAmount <= 0) {
      return res.status(400).json({ message: 'Please enter a sale amount greater than 0.' });
    }

    const sale = await Sale.create({
      userId: req.user._id,
      amount: calculatedAmount,
      costOfGoodsSold: calculatedCogs,
      items: saleItems,
      paymentMethod: chosenMethod,
      verificationStatus: safeVerificationStatus,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      upiApp: ['GPay', 'PhonePe', 'Other UPI', 'UPI'].includes(chosenMethod) ? (upiApp || inferredProvider) : '',
      utrNumber: cleanRef,
      referenceNumber: cleanRef,
      description: description || (['GPay', 'PhonePe', 'Other UPI'].includes(chosenMethod)
        ? `${inferredProvider} Personal UPI Payment`
        : 'Retail Counter Sale'),
      entryMethod: entryMethod === 'scanned' ? 'scanned' : entryMethod === 'automatic' ? 'automatic' : 'manual',
      paymentStatus: safePaymentStatus,
      provider: inferredProvider,
      providerTransactionId: cleanRef || (['GPay', 'PhonePe', 'Other UPI'].includes(chosenMethod) ? `MANUAL_UPI_${Date.now()}` : undefined),
    });

    sseService.emitToUser(req.user._id, 'sale.created', {
      saleId: sale._id,
      amount: sale.amount,
      paymentMethod: sale.paymentMethod,
    });
    sseService.emitToUser(req.user._id, 'sale.finalized', {
      saleId: sale._id,
      amount: sale.amount,
    });

    res.status(201).json({
      message: `${chosenMethod} sale recorded successfully.`,
      sale,
    });
  } catch (error) {
    console.error('Error adding sale:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// Verify a pending manual sale: PATCH /api/sales/:id/verify
export const verifySale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findOne({ _id: id, userId: req.user._id });

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found.' });
    }

    sale.verificationStatus = 'verified';
    sale.paymentStatus = 'success';
    await sale.save();

    sseService.emitToUser(req.user._id, 'payment.confirmed', {
      saleId: sale._id,
      amount: sale.amount,
    });

    res.status(200).json({
      message: 'Transaction verified successfully. Added to finalized revenue totals.',
      sale,
    });
  } catch (error) {
    console.error('Error verifying sale:', error);
    res.status(500).json({ message: 'Failed to verify transaction.' });
  }
};

// Refund a sale & restore inventory: PATCH /api/sales/:id/refund
export const refundSale = async (req, res) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findOne({ _id: id, userId: req.user._id });

    if (!sale) {
      return res.status(404).json({ message: 'Sale not found.' });
    }

    if (sale.paymentStatus === 'refunded') {
      return res.status(400).json({ message: 'Sale has already been refunded.' });
    }

    sale.paymentStatus = 'refunded';
    sale.description = `${sale.description} [REFUNDED]`;
    await sale.save();

    // Restore stock for eligible product items
    if (sale.items && sale.items.length > 0) {
      for (const item of sale.items) {
        if (item.productId) {
          const product = await Product.findOne({ _id: item.productId, userId: req.user._id });
          if (product) {
            const prevStock = product.stockQuantity;
            product.stockQuantity += item.quantity || 1;
            await product.save();

            await InventoryMovement.create({
              userId: req.user._id,
              productId: product._id,
              type: 'return_restock',
              quantityChanged: item.quantity || 1,
              previousStock: prevStock,
              newStock: product.stockQuantity,
              reason: `Returned & refunded sale #${sale._id}`,
            });
          }
        }
      }
    }

    sseService.emitToUser(req.user._id, 'refund.processed', {
      saleId: sale._id,
      amount: sale.amount,
    });

    res.status(200).json({
      message: 'Sale refunded successfully and eligible stock restored to inventory.',
      sale,
    });
  } catch (error) {
    console.error('Error refunding sale:', error);
    res.status(500).json({ message: 'Failed to refund sale.' });
  }
};

// Get all sales for authenticated user ONLY
export const getSales = async (req, res) => {
  try {
    const sales = await Sale.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(sales);
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// Delete a sale for authenticated user ONLY
export const deleteSale = async (req, res) => {
  try {
    const { id } = req.params;
    await Sale.findOneAndDelete({ _id: id, userId: req.user._id });
    res.status(200).json({ message: 'Sale deleted successfully.' });
  } catch (error) {
    console.error('Error deleting sale:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};
