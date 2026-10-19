import express from 'express';
import {
  registerUser,
  loginUser,
  updateBusinessProfile,
  getMe,
  sendPasswordResetOtp,
  verifyPasswordResetOtp,
} from '../controllers/authController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/onboarding', protect, updateBusinessProfile);
router.get('/me', protect, getMe);

// OTP-based Forgot Password Routes
router.post('/forgot-password/send-otp', sendPasswordResetOtp);
router.post('/forgot-password/verify-otp', verifyPasswordResetOtp);

export default router;
