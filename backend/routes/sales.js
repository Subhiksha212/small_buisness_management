import express from 'express';
import { addSale, getSales, deleteSale } from '../controllers/salesController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // Protect all sales endpoints with user auth

router.post('/', addSale);
router.get('/', getSales);
router.delete('/:id', deleteSale);

export default router;
