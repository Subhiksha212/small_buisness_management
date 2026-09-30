import Sale from '../models/Sale.js';

// Add a new manual Cash sale for authenticated user
export const addSale = async (req, res) => {
  try {
    const { amount, paymentMethod, description, entryMethod } = req.body;

    if (entryMethod === 'automatic') {
      return res.status(403).json({
        message: 'Untrusted action: Only authorized payment gateway webhooks can create automatic transactions.',
      });
    }

    if (paymentMethod && paymentMethod !== 'Cash') {
      return res.status(400).json({
        message: 'UPI and Card payments cannot be entered manually. They are automatically recorded upon provider verification.',
      });
    }

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ message: 'Please enter an amount greater than 0.' });
    }

    const sale = await Sale.create({
      userId: req.user._id,
      amount: Number(amount),
      paymentMethod: 'Cash',
      description: description || '',
      entryMethod: 'manual',
      paymentStatus: 'recorded',
      provider: 'Manual',
    });

    res.status(201).json({
      message: 'Cash sale added successfully.',
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
