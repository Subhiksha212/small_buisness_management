import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';
import { sendPasswordResetOtpEmail } from '../services/emailService.js';

// Generate JWT token
const generateToken = (id) => {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production environment.');
  }
  return jwt.sign({ id }, jwtSecret || 'smart_business_secret_key_123', {
    expiresIn: '30d',
  });
};

// Register User: POST /api/auth/register
export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, email, and password.' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists with this email.' });
    }

    const user = await User.create({
      name,
      email,
      passwordHash: password,
      accountType: 'retail',
      isOnboarded: false,
    });

    // Backward Compatibility Data Migration:
    // If existing unassigned sales/expenses exist, attach them to the first registered user
    await Sale.updateMany({ userId: { $exists: false } }, { $set: { userId: user._id } });
    await Expense.updateMany({ userId: { $exists: false } }, { $set: { userId: user._id } });

    res.status(201).json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        businessName: user.businessName,
        currency: user.currency,
        preferredLanguage: user.preferredLanguage,
        isOnboarded: user.isOnboarded,
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
};

// Login User: POST /api/auth/login
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    if (user && (await user.matchPassword(password))) {
      res.status(200).json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          accountType: user.accountType,
          businessName: user.businessName,
          businessCategory: user.businessCategory,
          currency: user.currency,
          preferredLanguage: user.preferredLanguage,
          isOnboarded: user.isOnboarded,
        }
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login.' });
  }
};

// Complete Business Setup / Onboarding: POST /api/auth/onboarding
export const updateBusinessProfile = async (req, res) => {
  try {
    const { accountType, businessName, businessCategory, currency, preferredLanguage } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (accountType) user.accountType = accountType;
    if (businessName !== undefined) user.businessName = businessName;
    if (businessCategory !== undefined) user.businessCategory = businessCategory;
    if (currency) user.currency = currency;
    if (preferredLanguage) user.preferredLanguage = preferredLanguage;
    user.isOnboarded = true;

    await user.save();

    res.status(200).json({
      success: true,
      token: generateToken(user._id),
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        accountType: user.accountType,
        businessName: user.businessName,
        businessCategory: user.businessCategory,
        currency: user.currency,
        preferredLanguage: user.preferredLanguage,
        isOnboarded: user.isOnboarded,
      }
    });
  } catch (error) {
    console.error('Onboarding update error:', error);
    res.status(500).json({ message: 'Failed to update business profile.' });
  }
};

// Get Current User Info: GET /api/auth/me
export const getMe = async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
};

// Send OTP: POST /api/auth/forgot-password/send-otp
export const sendPasswordResetOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide your registered email address.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No registered account found with this email.' });
    }

    // Generate secure 6-digit numeric OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.resetPasswordOtp = otp;
    user.resetPasswordOtpExpires = expiry;
    await user.save();

    // Send email via emailService
    const emailResult = await sendPasswordResetOtpEmail(user.email, otp, user.name);

    if (!emailResult.sent) {
      if (emailResult.reason === 'SMTP not configured in .env') {
        return res.status(503).json({
          success: false,
          message: 'Email service is not configured in backend/.env yet. Please add EMAIL_USER and EMAIL_PASS to send real emails to your inbox.',
        });
      } else {
        return res.status(500).json({
          success: false,
          message: `Email delivery failed: ${emailResult.error || 'SMTP Error'}. Please check your email credentials in backend/.env.`,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'A 6-digit verification code has been sent to your email.',
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ success: false, message: 'Failed to send verification code. Please try again.' });
  }
};

// Verify OTP & Reset Password: POST /api/auth/forgot-password/verify-otp
export const verifyPasswordResetOtp = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, verification code, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Account not found.' });
    }

    if (!user.resetPasswordOtp || !user.resetPasswordOtpExpires) {
      return res.status(400).json({ success: false, message: 'No reset request found. Please request a new code.' });
    }

    // Check expiration
    if (new Date() > new Date(user.resetPasswordOtpExpires)) {
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new one.' });
    }

    // Check OTP match
    if (user.resetPasswordOtp !== otp.toString().trim()) {
      return res.status(400).json({ success: false, message: 'Incorrect verification code. Please check and try again.' });
    }

    // Reset password & clear OTP fields
    user.passwordHash = newPassword;
    user.resetPasswordOtp = null;
    user.resetPasswordOtpExpires = null;
    await user.save();

    console.log(`[AUTH] ✅ Password successfully reset for user: ${user.email}`);

    res.status(200).json({
      success: true,
      message: 'Password reset successful! You can now log in with your new password.',
    });
  } catch (error) {
    console.error('Verify OTP reset error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password. Please try again.' });
  }
};

