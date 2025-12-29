# Email Configuration Guide

This application requires email configuration to send verification codes for account registration and password reset.

## Environment Variables

Add the following environment variables to your `.env` file:

### Option 1: Gmail (Recommended for Development)

```env
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM=your-email@gmail.com
```

**Note:** For Gmail, you need to use an [App Password](https://support.google.com/accounts/answer/185833) instead of your regular password.

### Option 2: Custom SMTP Server

```env
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@example.com
SMTP_PASS=your-password
EMAIL_FROM=your-email@example.com
```

### Option 3: Production Email Services

For production, consider using services like:
- **SendGrid**: `SMTP_HOST=smtp.sendgrid.net`, `SMTP_PORT=587`
- **AWS SES**: Configure via AWS console
- **Mailgun**: `SMTP_HOST=smtp.mailgun.org`, `SMTP_PORT=587`
- **Postmark**: `SMTP_HOST=smtp.postmarkapp.com`, `SMTP_PORT=587`

## Setup Instructions

1. **For Gmail:**
   - Go to your Google Account settings
   - Enable 2-Step Verification
   - Generate an App Password
   - Use the App Password in `EMAIL_PASS`

2. **For Custom SMTP:**
   - Contact your email provider for SMTP settings
   - Use the provided host, port, and credentials

3. **Test the Configuration:**
   - Try creating a new account
   - Check if verification email is received
   - Verify the code works correctly

## Features

- **Email Verification**: Required for new account registration
- **Password Reset**: Users can reset passwords via email verification code
- **Code Expiration**: Verification codes expire after 10 minutes
- **Security**: Codes are automatically deleted after expiration or successful verification

## Troubleshooting

### Email not sending
- Check your SMTP credentials
- Verify firewall/network settings
- Check spam folder
- Review server logs for error messages

### Codes not working
- Ensure codes are entered within 10 minutes
- Check for typos in email address
- Verify email is not already associated with another account

