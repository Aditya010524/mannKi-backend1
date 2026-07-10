import express from 'express';
import { validate } from '../middleware/validation.middleware.js';
import { authController } from '../controllers/auth.controller.js';
import authValidation from '../validations/auth.validation.js';

const router = express.Router();

// ================= AUTH ROUTES (Public) =================

// Register new user
router.post('/register', validate(authValidation.register), authController.register);

// Login
router.post('/login', validate(authValidation.login), authController.login);

// Refresh tokens
router.post('/refresh', validate(authValidation.refresh), authController.refresh);

// Verify email
router.post('/verify-email', validate(authValidation.verifyEmail), authController.verifyEmail);

// Request password reset (OTP)
router.post(
  '/forgot-password',
  validate(authValidation.forgotPassword),
  authController.forgotPassword
);

// Verify forgot password OTP
router.post(
  '/verify-forgot-password-otp',
  validate(authValidation.verifyForgotPasswordOtp),
  authController.verifyForgotPasswordOtp
);

// Reset password
router.post(
  '/reset-password',
  validate(authValidation.resetPassword),
  authController.resetPassword
);

// Resend verification email
router.post(
  '/resend-verification',
  validate(authValidation.resendVerification),
  authController.resendEmailVerification
);

// Utility: check if email exists
// router.get('/check-email', validate(authValidation.checkEmail, 'query'), authController.checkEmail);

export default router;
