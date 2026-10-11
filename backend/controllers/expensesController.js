import Expense from '../models/Expense.js';

// Add a new expense for authenticated user
export const addExpense = async (req, res) => {
  try {
    const { amount, category, paymentMethod = 'Cash', paidTo = '', description, entryMethod = 'manual', upiApp = 'UPI', utrNumber = '' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Please enter an amount greater than 0.' });
    }

    const validCategories = ['Stock', 'Rent', 'Electricity', 'Salary', 'Transport', 'Other'];
    const chosenCategory = validCategories.includes(category) ? category : 'Other';

    const validMethods = ['Cash', 'UPI', 'Card'];
    const chosenMethod = validMethods.includes(paymentMethod) ? paymentMethod : 'Cash';

    const recipient = paidTo ? paidTo.trim() : '';
    const defaultDesc = recipient
      ? `Paid to ${recipient} (${chosenCategory})`
      : chosenMethod === 'UPI'
      ? `${chosenCategory} paid via ${upiApp || 'UPI'}`
      : `${chosenCategory} Expense`;

    const expense = await Expense.create({
      userId: req.user._id,
      amount: Number(amount),
      category: chosenCategory,
      paymentMethod: chosenMethod,
      paidTo: recipient,
      upiApp: chosenMethod === 'UPI' ? (upiApp || 'UPI') : '',
      utrNumber: utrNumber ? utrNumber.trim() : '',
      description: description ? description.trim() : defaultDesc,
      entryMethod: entryMethod === 'scanned' ? 'scanned' : entryMethod === 'automatic' ? 'automatic' : 'manual',
      paymentStatus: 'success',
      provider: chosenMethod === 'UPI' ? (upiApp || 'UPI') : chosenMethod === 'Card' ? 'Card POS' : 'Manual',
      providerTransactionId: utrNumber ? utrNumber.trim() : (chosenMethod === 'UPI' ? `UPI_OUT_${Date.now()}` : undefined),
    });

    res.status(201).json({
      message: `${chosenMethod} expense recorded successfully.`,
      expense,
    });
  } catch (error) {
    console.error('Error adding expense:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// Get expenses for authenticated user ONLY
export const getExpenses = async (req, res) => {
  try {
    const expenses = await Expense.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(expenses);
  } catch (error) {
    console.error('Error fetching expenses:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};

// Delete an expense for authenticated user ONLY
export const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;
    await Expense.findOneAndDelete({ _id: id, userId: req.user._id });
    res.status(200).json({ message: 'Expense deleted successfully.' });
  } catch (error) {
    console.error('Error deleting expense:', error);
    res.status(500).json({ message: 'Something went wrong. Please try again.' });
  }
};
