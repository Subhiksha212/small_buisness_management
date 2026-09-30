import express from 'express';
import { addExpense, getExpenses, deleteExpense } from '../controllers/expensesController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // Protect all expenses endpoints with user auth

router.post('/', addExpense);
router.get('/', getExpenses);
router.delete('/:id', deleteExpense);

export default router;
