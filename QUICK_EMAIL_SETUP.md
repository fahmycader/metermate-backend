# Quick Email Setup Guide

## Step 1: Create .env file

Copy the example file:
```bash
cd metermate-backend
cp .env.example .env
```

## Step 2: Configure Gmail (Easiest Option)

1. **Enable 2-Step Verification on your Google Account:**
   - Go to: https://myaccount.google.com/security
   - Click "2-Step Verification" and follow the setup

2. **Generate App Password:**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Other (Custom name)"
   - Enter "MeterMate" as the name
   - Click "Generate"
   - Copy the 16-character password (no spaces)

3. **Add to .env file:**
   ```env
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=xxxx xxxx xxxx xxxx
   EMAIL_FROM=your-email@gmail.com
   ```
   **Important:** Remove spaces from the app password when adding to .env

## Step 3: Restart Backend Server

After saving the .env file, restart your backend server:
```bash
npm start
# or
npm run dev
```

## Step 4: Test

Try creating a new account - you should receive a verification code email!

## Troubleshooting

### "Invalid login" error
- Make sure you're using an App Password, not your regular Gmail password
- Verify 2-Step Verification is enabled
- Check that there are no spaces in the password in .env

### "Connection refused" error
- Check your internet connection
- Verify firewall isn't blocking port 587
- Try using a different email service (see EMAIL_SETUP.md)

### Email not received
- Check spam folder
- Verify email address is correct
- Check server logs for error messages

## Alternative: Use Different Email Service

If Gmail doesn't work, see `EMAIL_SETUP.md` for other options like:
- SendGrid
- Mailgun
- AWS SES
- Custom SMTP

