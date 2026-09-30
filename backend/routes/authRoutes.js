import express from 'express';
import { registerUser, loginUser, updateBusinessProfile, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/onboarding', protect, updateBusinessProfile);
router.get('/me', protect, getMe);

export default router;
