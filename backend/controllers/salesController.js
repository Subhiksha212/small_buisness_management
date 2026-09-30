import Sale from '../models/Sale.js';

// Add a new sale for authenticated user (Cash, UPI / Google Pay, or Card)
export const addSale = async (req, res) => {
  try {
    const { amount, paymentMethod = 'Cash', description, entryMethod = 'manual', upiApp = 'Google Pay', utrNumber = '' } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Please enter an amount greater than 0.' });
    }

    const validMethods = ['Cash', 'UPI', 'Card'];
    const chosenMethod = validMethods.includes(paymentMethod) ? paymentMethod : 'Cash';

    const sale = await Sale.create({
      userId: req.user._id,
      amount: Number(amount),
      paymentMethod: chosenMethod,
      upiApp: chosenMethod === 'UPI' ? upiApp : '',
      utrNumber: utrNumber ? utrNumber.trim() : '',
      description: description || (chosenMethod === 'UPI' ? `${upiApp} Customer Payment` : 'Retail Sale'),
      entryMethod: entryMethod === 'scanned' ? 'scanned' : entryMethod === 'automatic' ? 'automatic' : 'manual',
      paymentStatus: 'success',
      provider: chosenMethod === 'UPI' ? upiApp : chosenMethod === 'Card' ? 'Card POS' : 'Manual',
      providerTransactionId: utrNumber ? utrNumber.trim() : (chosenMethod === 'UPI' ? `UPI_${Date.now()}` : undefined),
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
