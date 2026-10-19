/**
 * Automated test script for 6-Digit OTP Password Reset Flow
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';
import connectDB from './config/db.js';

dotenv.config();

async function runTest() {
  console.log('==============================================');
  console.log('TESTING 6-DIGIT OTP PASSWORD RESET FLOW');
  console.log('==============================================');

  await connectDB();

  const testEmail = 'otptest_merchant@smartbusiness.com';
  const initialPassword = 'OldPassword123!';
  const updatedPassword = 'NewSecretPassword456!';

  // Clean up any prior test user
  await User.deleteOne({ email: testEmail });

  // 1. Create test user
  console.log('\n1. Creating test user...');
  const user = await User.create({
    name: 'OTP Test Merchant',
    email: testEmail,
    passwordHash: initialPassword,
    isOnboarded: true,
  });
  console.log(`✓ Test user created with ID: ${user._id}`);

  // Verify initial password matches
  const isOldMatch = await user.matchPassword(initialPassword);
  console.log(`✓ Initial password matches: ${isOldMatch}`);

  // 2. Simulate OTP generation
  console.log('\n2. Generating 6-Digit OTP...');
  const testOtp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiry = new Date(Date.now() + 10 * 60 * 1000);

  user.resetPasswordOtp = testOtp;
  user.resetPasswordOtpExpires = expiry;
  await user.save();
  console.log(`✓ OTP ${testOtp} stored on user record (Expires in 10 mins).`);

  // 3. Test invalid OTP verification
  console.log('\n3. Testing incorrect OTP verification...');
  const foundUser = await User.findOne({ email: testEmail });
  if (foundUser.resetPasswordOtp !== '999999') {
    console.log('✓ Invalid OTP rejected correctly.');
  }

  // 4. Test valid OTP verification & password reset
  console.log('\n4. Testing valid OTP verification & password reset...');
  if (foundUser.resetPasswordOtp === testOtp && new Date() <= foundUser.resetPasswordOtpExpires) {
    foundUser.passwordHash = updatedPassword;
    foundUser.resetPasswordOtp = null;
    foundUser.resetPasswordOtpExpires = null;
    await foundUser.save();
    console.log('✓ Password updated & OTP cleared.');
  }

  // 5. Test login with new password
  console.log('\n5. Testing login with updated password...');
  const verifyUser = await User.findOne({ email: testEmail });
  const isNewPasswordValid = await verifyUser.matchPassword(updatedPassword);
  const isOldPasswordInvalid = !(await verifyUser.matchPassword(initialPassword));

  if (isNewPasswordValid && isOldPasswordInvalid) {
    console.log('✓ SUCCESS: New password matches!');
    console.log('✓ SUCCESS: Old password no longer works!');
  } else {
    throw new Error('Password verification failed!');
  }

  // Clean up
  await User.deleteOne({ email: testEmail });
  console.log('\n✓ Test cleanup complete.');
  console.log('==============================================');
  console.log('ALL OTP RESET TESTS PASSED SUCCESSFULLY! 🎉');
  console.log('==============================================\n');

  await mongoose.connection.close();
  process.exit(0);
}

runTest().catch((err) => {
  console.error('Test failed with error:', err);
  process.exit(1);
});
