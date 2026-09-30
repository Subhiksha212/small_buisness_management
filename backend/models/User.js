import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Please add a password'],
    },
    accountType: {
      type: String,
      enum: ['retail', 'restaurant', 'personal'],
      default: 'retail',
    },
    businessName: {
      type: String,
      default: '',
    },
    businessCategory: {
      type: String,
      default: '',
    },
    currency: {
      type: String,
      default: '₹',
    },
    preferredLanguage: {
      type: String,
      enum: ['en', 'ta'],
      default: 'en',
    },
    isOnboarded: {
      type: Boolean,
      default: false,
    },
    merchantVpa: {
      type: String,
      default: '',
    },
    upiProvider: {
      type: String,
      default: 'Google Pay',
    },
    cardProvider: {
      type: String,
      default: 'Razorpay',
    },
  },
  {
    timestamps: true,
  }
);

// Password matching helper
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

// Password hashing pre-save hook
userSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

const User = mongoose.model('User', userSchema);
export default User;
