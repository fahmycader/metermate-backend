/**
 * Unit tests for emailService utility
 */

// Mock nodemailer BEFORE requiring emailService
const mockSendMail = jest.fn();
const mockTransporter = {
  sendMail: mockSendMail,
};

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => mockTransporter),
}));

const emailService = require('../../../utils/emailService');
const nodemailer = require('nodemailer');

describe('emailService', () => {
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset mockSendMail to return success
    mockSendMail.mockResolvedValue({
      messageId: 'test-message-id',
    });
    
    // Reset createTransport to return our mock transporter
    nodemailer.createTransport.mockReturnValue(mockTransporter);
  });

  afterEach(() => {
    // Reset environment variables
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_PORT;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;
    delete process.env.EMAIL_USER;
    delete process.env.EMAIL_PASS;
  });

  describe('sendVerificationCode', () => {
    it('should send verification code email successfully for registration', async () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'test-password';

      const email = 'user@example.com';
      const code = '123456';
      const type = 'registration';

      const result = await emailService.sendVerificationCode(email, code, type);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(nodemailer.createTransport).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: 'MeterMate - Email Verification Code',
        })
      );
    });

    it('should send verification code email successfully for password reset', async () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'test-password';

      const email = 'user@example.com';
      const code = '123456';
      const type = 'password_reset';

      const result = await emailService.sendVerificationCode(email, code, type);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(nodemailer.createTransport).toHaveBeenCalled();
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: 'MeterMate - Password Reset Code',
        })
      );
    });

    it('should throw error when email configuration is missing', async () => {
      delete process.env.EMAIL_USER;
      delete process.env.EMAIL_PASS;
      delete process.env.SMTP_USER;
      delete process.env.SMTP_PASS;

      const email = 'user@example.com';
      const code = '123456';

      await expect(
        emailService.sendVerificationCode(email, code)
      ).rejects.toThrow('Email configuration is missing');
    });

    it('should handle SMTP configuration correctly', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      process.env.SMTP_USER = 'smtp@example.com';
      process.env.SMTP_PASS = 'smtp-password';
      process.env.SMTP_SECURE = 'false';

      const email = 'user@example.com';
      const code = '123456';

      const result = await emailService.sendVerificationCode(email, code);

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
        })
      );
      expect(result.success).toBe(true);
    });

    it('should throw error when SMTP_HOST is set but credentials are missing', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_PORT = '587';
      // Missing SMTP_USER and SMTP_PASS

      const email = 'user@example.com';
      const code = '123456';

      await expect(
        emailService.sendVerificationCode(email, code)
      ).rejects.toThrow('SMTP_USER and SMTP_PASS are required');
    });

    it('should handle email sending errors gracefully', async () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'test-password';

      const email = 'user@example.com';
      const code = '123456';

      mockSendMail.mockRejectedValueOnce(new Error('Email sending failed'));

      await expect(
        emailService.sendVerificationCode(email, code)
      ).rejects.toThrow('Failed to send verification email');
    });

    it('should handle authentication errors with helpful message', async () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'wrong-password';

      const email = 'user@example.com';
      const code = '123456';

      mockSendMail.mockRejectedValueOnce(new Error('Invalid login'));

      await expect(
        emailService.sendVerificationCode(email, code)
      ).rejects.toThrow('Email authentication failed');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email successfully', async () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'test-password';
      process.env.FRONTEND_URL = 'http://localhost:3000';

      const email = 'user@example.com';
      const resetToken = 'reset-token-123';

      const result = await emailService.sendPasswordResetEmail(email, resetToken);

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('test-message-id');
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: email,
          subject: 'MeterMate - Password Reset',
        })
      );
      
      // Check that reset URL is included in the email
      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('reset-token-123');
      expect(mailOptions.html).toContain('http://localhost:3000');
    });

    it('should use default FRONTEND_URL if not set', async () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'test-password';
      delete process.env.FRONTEND_URL;

      const email = 'user@example.com';
      const resetToken = 'reset-token-123';

      await emailService.sendPasswordResetEmail(email, resetToken);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.html).toContain('http://localhost:3000');
    });

    it('should handle email sending errors', async () => {
      process.env.EMAIL_USER = 'test@example.com';
      process.env.EMAIL_PASS = 'test-password';

      const email = 'user@example.com';
      const resetToken = 'reset-token-123';

      mockSendMail.mockRejectedValueOnce(new Error('Email sending failed'));

      await expect(
        emailService.sendPasswordResetEmail(email, resetToken)
      ).rejects.toThrow('Failed to send password reset email');
    });
  });
});

