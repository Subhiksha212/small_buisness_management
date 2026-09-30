import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Sale from '../models/Sale.js';
import Expense from '../models/Expense.js';

// Generate JWT token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'smart_business_secret_key_123', {
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
