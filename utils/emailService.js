const nodemailer = require('nodemailer');

// Email configuration - can be set via environment variables
const createTransporter = () => {
  // For development, you can use Gmail or other SMTP services
  // For production, use a proper email service like SendGrid, AWS SES, etc.
  
  // Check for custom SMTP configuration
  if (process.env.SMTP_HOST && process.env.SMTP_PORT) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      throw new Error('SMTP_USER and SMTP_PASS are required when using SMTP_HOST');
    }
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }
  
  // Default: Gmail configuration (for development)
  // You'll need to set up an App Password in Gmail settings
  const emailUser = process.env.EMAIL_USER || process.env.SMTP_USER;
  const emailPass = process.env.EMAIL_PASS || process.env.SMTP_PASS;
  
  if (!emailUser || !emailPass) {
    throw new Error('Email configuration is missing. Please set EMAIL_USER and EMAIL_PASS (or SMTP_USER and SMTP_PASS) in your .env file. See EMAIL_SETUP.md for instructions.');
  }
  
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass, // Use App Password, not regular password
    },
  });
};

/**
 * Send verification code email
 * @param {string} email - Recipient email
 * @param {string} code - Verification code
 * @param {string} type - Type of verification ('registration' or 'password_reset')
 * @returns {Promise<Object>}
 */
const sendVerificationCode = async (email, code, type = 'registration') => {
  try {
    let transporter;
    try {
      transporter = createTransporter();
    } catch (configError) {
      console.error('❌ Email configuration error:', configError.message);
      throw new Error(`Email service not configured: ${configError.message}`);
    }
    
    const subject = type === 'password_reset' 
      ? 'MeterMate - Password Reset Code'
      : 'MeterMate - Email Verification Code';
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .code-box { background: white; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
            .code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>MeterMate</h1>
            </div>
            <div class="content">
              <h2>${type === 'password_reset' ? 'Password Reset' : 'Email Verification'}</h2>
              <p>Hello,</p>
              <p>${type === 'password_reset' 
                ? 'You have requested to reset your password. Use the code below to verify your email address:'
                : 'Thank you for registering with MeterMate. Please use the verification code below to complete your registration:'}</p>
              
              <div class="code-box">
                <div class="code">${code}</div>
              </div>
              
              <p><strong>This code will expire in 10 minutes.</strong></p>
              <p>If you didn't request this code, please ignore this email.</p>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} MeterMate. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@metermate.com',
      to: email,
      subject: subject,
      html: htmlContent,
      text: `${type === 'password_reset' ? 'Password Reset' : 'Email Verification'} Code: ${code}\n\nThis code will expire in 10 minutes.`,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Verification email sent:', {
      to: email,
      messageId: info.messageId,
      type: type
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    
    // Provide more helpful error messages
    let errorMessage = 'Failed to send verification email.';
    
    if (error.message.includes('Email service not configured')) {
      errorMessage = error.message;
    } else if (error.message.includes('Invalid login') || error.message.includes('authentication failed')) {
      errorMessage = 'Email authentication failed. Please check your email credentials in the .env file.';
    } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
      errorMessage = 'Cannot connect to email server. Please check your SMTP settings.';
    } else {
      errorMessage = `Failed to send verification email: ${error.message}`;
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Send password reset email with reset link
 * @param {string} email - Recipient email
 * @param {string} resetToken - Password reset token
 * @returns {Promise<Object>}
 */
const sendPasswordResetEmail = async (email, resetToken) => {
  try {
    const transporter = createTransporter();
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>MeterMate</h1>
            </div>
            <div class="content">
              <h2>Password Reset Request</h2>
              <p>Hello,</p>
              <p>You have requested to reset your password. Click the button below to reset it:</p>
              
              <div style="text-align: center;">
                <a href="${resetUrl}" class="button">Reset Password</a>
              </div>
              
              <p>Or copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
              
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request a password reset, please ignore this email.</p>
              
              <div class="footer">
                <p>© ${new Date().getFullYear()} MeterMate. All rights reserved.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
    
    const mailOptions = {
      from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@metermate.com',
      to: email,
      subject: 'MeterMate - Password Reset',
      html: htmlContent,
      text: `Password Reset: ${resetUrl}\n\nThis link will expire in 1 hour.`,
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', {
      to: email,
      messageId: info.messageId
    });
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw new Error(`Failed to send password reset email: ${error.message}`);
  }
};

module.exports = {
  sendVerificationCode,
  sendPasswordResetEmail,
};

