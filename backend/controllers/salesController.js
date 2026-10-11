import Sale from '../models/Sale.js';

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
    } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Please enter an amount greater than 0.' });
    }

    const validMethods = ['Cash', 'GPay', 'PhonePe', 'Other UPI', 'UPI', 'Card'];
    const chosenMethod = validMethods.includes(paymentMethod) ? paymentMethod : 'Cash';
    const cleanRef = (referenceNumber || utrNumber || '').trim();

    // Map verificationStatus & paymentStatus
    const validVerificationStatuses = ['verified', 'pending_verification', 'manual_entry'];
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

    const sale = await Sale.create({
      userId: req.user._id,
      amount: Number(amount),
      paymentMethod: chosenMethod,
      verificationStatus: safeVerificationStatus,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      upiApp: ['GPay', 'PhonePe', 'Other UPI', 'UPI'].includes(chosenMethod) ? (upiApp || inferredProvider) : '',
      utrNumber: cleanRef,
      referenceNumber: cleanRef,
      description: description || (['GPay', 'PhonePe', 'Other UPI'].includes(chosenMethod)
        ? `${inferredProvider} Personal UPI Payment`
        : 'Retail Sale'),
      entryMethod: entryMethod === 'scanned' ? 'scanned' : entryMethod === 'automatic' ? 'automatic' : 'manual',
      paymentStatus: safePaymentStatus,
      provider: inferredProvider,
      providerTransactionId: cleanRef || (['GPay', 'PhonePe', 'Other UPI'].includes(chosenMethod) ? `MANUAL_UPI_${Date.now()}` : undefined),
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

    res.status(200).json({
      message: 'Transaction verified successfully. Added to finalized revenue totals.',
      sale,
    });
  } catch (error) {
    console.error('Error verifying sale:', error);
    res.status(500).json({ message: 'Failed to verify transaction.' });
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
