import nodemailer from 'nodemailer';
import logger from '../config/logger.config.js';
import configEnv from '../config/env.config.js';

class EmailService {
  constructor() {
    // Create Gmail SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: configEnv.EMAIL.HOST,
      port: configEnv.EMAIL.PORT,
      secure: configEnv.EMAIL.PORT === 465, // true for 465, false for 587
      auth: {
        user: configEnv.EMAIL.USER,
        pass: configEnv.EMAIL.PASS,
      },
    });
  }

  async sendMail({ to, subject, text, html }) {
    try {
      const info = await this.transporter.sendMail({
        from: configEnv.EMAIL.FROM || configEnv.EMAIL.USER,
        to,
        subject,
        text,
        html,
      });

      logger.info(`📧 Email sent successfully → ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('❌ Email sending failed:', error);
      throw new Error('Email sending failed');
    }
  }

  // ✅ OTP verification email
  async sendVerificationEmail(email, otp, displayName) {
    const subject = 'Verify Your Email';

    const text = `
Hi ${displayName},

Your email verification code is: ${otp}

This code is valid for 10 minutes.

If you did not create this account, ignore this email.
    `;

    const html = `
      <p>Hi <strong>${displayName}</strong>,</p>
      <p>Your email verification code is:</p>
      <h2>${otp}</h2>
      <p>This code is valid for <strong>10 minutes</strong>.</p>
      <p>If you did not create this account, ignore this email.</p>
    `;

    return this.sendMail({ to: email, subject, text, html });
  }

  // ✅ Password reset email
  async sendPasswordResetEmail(email, resetToken, displayName) {
    const resetLink = `${configEnv.SECURITY.FRONTEND_URL}/reset-password?token=${resetToken}`;

    const subject = 'Reset Your Password';

    const text = `
Hi ${displayName},

Click the link below to reset your password:
${resetLink}

This link expires in 10 minutes.
    `;

    const html = `
      <p>Hi <strong>${displayName}</strong>,</p>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}" target="_blank">${resetLink}</a>
      <p>This link expires in 10 minutes.</p>
    `;

    return this.sendMail({ to: email, subject, text, html });
  }
}

export const emailService = new EmailService();
