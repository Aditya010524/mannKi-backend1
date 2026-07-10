/**
 * Email Service - Brevo Integration
 * Uses native fetch API to send emails via Brevo's v3 Transactional SMTP endpoint
 * No external packages required
 */

import logger from '../config/logger.config.js';
import configEnv from '../config/env.config.js';

class EmailService {
  constructor() {
    console.log('📧 [EMAIL SERVICE] Initializing Email Service (Brevo)...');
    console.log('📧 [EMAIL SERVICE] Configuration:');
    console.log(`   API Key: ${configEnv.EMAIL.API_KEY ? '✅ Set (' + configEnv.EMAIL.API_KEY.length + ' chars)' : '❌ Not set'}`);
    console.log(`   From: ${configEnv.EMAIL.FROM}`);
    console.log('📧 [EMAIL SERVICE] Brevo integration ready');
  }

  async sendMail({ to, subject, text, html }) {
    const startTime = Date.now();
    console.log('\n========================================');
    console.log('📧 [EMAIL SERVICE] Starting email send operation');
    console.log('========================================');
    console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
    console.log(`📬 Recipient: ${to}`);
    console.log(`📋 Subject: ${subject}`);
    console.log(`📝 Text length: ${text ? text.length : 0} characters`);
    console.log(`🎨 HTML length: ${html ? html.length : 0} characters`);

    try {
      // Validate configuration
      console.log('\n🔐 [VALIDATION] Checking Brevo configuration...');
      
      if (!configEnv.EMAIL.API_KEY) {
        throw new Error('BREVO_API_KEY is not configured in environment');
      }
      console.log(`   ✅ API Key present (${configEnv.EMAIL.API_KEY.length} characters)`);

      if (!configEnv.EMAIL.FROM) {
        throw new Error('FROM_EMAIL is not configured in environment');
      }
      console.log(`   ✅ From email: ${configEnv.EMAIL.FROM}`);

      // Build payload
      console.log('\n📦 [PAYLOAD] Building email payload...');
      const payload = {
        sender: {
          name: 'socialNova',
          email: configEnv.EMAIL.FROM,
        },
        to: [{ email: to }],
        subject: subject,
        textContent: text,
        htmlContent: html,
      };
      console.log(`   ✅ Payload built successfully`);
      console.log(`   Payload structure:`, JSON.stringify(payload, null, 2));

      // Make API request
      console.log('\n🌐 [HTTP REQUEST] Sending request to Brevo API...');
      console.log(`   URL: https://api.brevo.com/v3/smtp/email`);
      console.log(`   Method: POST`);
      console.log(`   Headers:`, {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': `${configEnv.EMAIL.API_KEY.substring(0, 10)}...${configEnv.EMAIL.API_KEY.substring(configEnv.EMAIL.API_KEY.length - 5)}`,
      });

      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'content-type': 'application/json',
          'api-key': configEnv.EMAIL.API_KEY,
        },
        body: JSON.stringify(payload),
      });

      const duration = Date.now() - startTime;
      console.log(`\n⏱️  [RESPONSE] Request completed in ${duration}ms`);
      console.log(`   Status Code: ${response.status}`);
      console.log(`   Status Text: ${response.statusText}`);

      if (!response.ok) {
        console.log('\n❌ [ERROR] HTTP Response not OK');
        let errorData = {};
        let errorText = '';
        
        try {
          errorText = await response.text();
          console.log(`   Response Text: ${errorText}`);
          errorData = JSON.parse(errorText);
          console.log(`   Response JSON:`, errorData);
        } catch (parseError) {
          console.log(`   Could not parse response body: ${parseError.message}`);
        }

        const errorMessage = `Brevo API error: ${response.status} ${response.statusText} - ${errorText || JSON.stringify(errorData)}`;
        console.error(`   Detailed Error: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      // Parse success response
      console.log('\n✅ [SUCCESS] Processing successful response...');
      let result;
      try {
        result = await response.json();
        console.log(`   Response JSON:`, result);
      } catch (parseError) {
        console.error(`   ⚠️  Could not parse response JSON: ${parseError.message}`);
        result = {};
      }

      const messageId = result.messageId || 'unknown';
      console.log(`\n🎉 [COMPLETION] Email sent successfully!`);
      console.log(`   Message ID: ${messageId}`);
      console.log(`   Total Duration: ${duration}ms`);
      console.log('========================================\n');

      logger.info(`📧 Email sent successfully via Brevo → Message ID: ${messageId}, Duration: ${duration}ms, To: ${to}`);
      return true;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error('\n========================================');
      console.error('❌ [FAILURE] Email sending operation failed');
      console.error('========================================');
      console.error(`⏰ Duration: ${duration}ms`);
      console.error(`📬 Recipient: ${to}`);
      console.error(`📋 Subject: ${subject}`);
      console.error(`\n🔴 [ERROR DETAILS]`);
      console.error(`   Error Type: ${error.constructor.name}`);
      console.error(`   Error Message: ${error.message}`);
      console.error(`   Error Stack:`, error.stack);
      console.error(`\n🔧 [DEBUGGING INFO]`);
      console.error(`   API Key Set: ${!!configEnv.EMAIL.API_KEY}`);
      console.error(`   From Email Set: ${!!configEnv.EMAIL.FROM}`);
      console.error(`   From Email Value: ${configEnv.EMAIL.FROM || 'NOT SET'}`);
      console.error('========================================\n');

      logger.error(`❌ Email sending failed after ${duration}ms`, {
        error: error.message,
        stack: error.stack,
        recipient: to,
        subject: subject,
        apiKeyConfigured: !!configEnv.EMAIL.API_KEY,
        fromEmailConfigured: !!configEnv.EMAIL.FROM,
      });

      throw new Error(`Email sending failed: ${error.message}`);
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
