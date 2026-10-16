import express from 'express';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  adjustStock,
  getInventoryMovements,
  getLowStockProducts,
  getInventoryReports,
  lookupProductByCode,
  seedSampleProducts,
} from '../controllers/productController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(protect); // All product routes are protected

router.get('/', getProducts);
router.post('/', createProduct);
router.get('/lookup', lookupProductByCode);
router.post('/seed', seedSampleProducts);
router.get('/reports', getInventoryReports);
router.get('/low-stock', getLowStockProducts);
router.get('/movements', getInventoryMovements);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/:id/adjust-stock', adjustStock);

export default router;

