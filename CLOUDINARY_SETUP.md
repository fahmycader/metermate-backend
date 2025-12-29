# Cloudinary Setup Guide

This guide will help you set up Cloudinary for cloud-based image storage in the MeterMate application.

## Why Cloudinary?

Cloudinary provides:
- **Cloud Storage**: Images are stored in the cloud, not on your local server
- **CDN Delivery**: Fast image delivery worldwide
- **Automatic Optimization**: Images are automatically optimized for web
- **Scalability**: No storage limits on your server
- **Reliability**: 99.9% uptime SLA

## Step 1: Create a Cloudinary Account

1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up for a free account (includes 25GB storage and 25GB bandwidth per month)
3. Verify your email address

## Step 2: Get Your Cloudinary Credentials

1. After logging in, go to your [Dashboard](https://console.cloudinary.com/console)
2. You'll see your account details including:
   - **Cloud Name** (e.g., `dxyz123abc`)
   - **API Key** (e.g., `123456789012345`)
   - **API Secret** (e.g., `abcdefghijklmnopqrstuvwxyz123456`)

## Step 3: Configure Environment Variables

Add the following environment variables to your backend:

### Option A: Using .env file (Recommended)

Create a `.env` file in the `metermate-backend` directory:

```env
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

### Option B: Using System Environment Variables

```bash
export CLOUDINARY_CLOUD_NAME=your-cloud-name
export CLOUDINARY_API_KEY=your-api-key
export CLOUDINARY_API_SECRET=your-api-secret
```

### Option C: Update config.js

You can also add Cloudinary configuration to `metermate-backend/config.js`:

```javascript
cloudinary: {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'your-cloud-name',
  api_key: process.env.CLOUDINARY_API_KEY || 'your-api-key',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'your-api-secret',
}
```

## Step 4: Install Dependencies

The required packages are already added to `package.json`. Run:

```bash
cd metermate-backend
npm install
```

This will install:
- `cloudinary` - Cloudinary SDK
- `streamifier` - For streaming file buffers to Cloudinary

## Step 5: Test the Setup

1. Start your backend server:
   ```bash
   npm start
   ```

2. Upload a test image through the mobile app or API

3. Check your Cloudinary dashboard to see if the image appears in the `meter-photos` folder

## How It Works

1. **Image Upload**: When a meter reader takes a photo, it's uploaded to Cloudinary via `/api/upload/meter-photo`
2. **Cloud Storage**: The image is stored in Cloudinary's cloud storage
3. **URL Return**: Cloudinary returns a secure URL (e.g., `https://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/meter-photos/meter-...`)
4. **Database Storage**: The Cloudinary URL is saved in the job's `photos` and `meterPhotos` arrays
5. **Display**: The admin panel fetches and displays images directly from Cloudinary

## Troubleshooting

### Images not uploading

1. Check that your Cloudinary credentials are correct
2. Verify environment variables are loaded: `console.log(process.env.CLOUDINARY_CLOUD_NAME)`
3. Check backend logs for Cloudinary errors
4. Ensure your Cloudinary account is active

### Images not displaying

1. Verify the URLs in the database start with `https://res.cloudinary.com/`
2. Check browser console for CORS or loading errors
3. Ensure Cloudinary URLs are accessible (not private)

### Migration from Local Storage

If you have existing images in local storage (`uploads/meter-photos/`), you can migrate them:

1. Use the `uploadFileToCloudinary` function in `utils/cloudinary.js`
2. Update existing job records with Cloudinary URLs
3. Optionally, keep local files as backup or delete them

## Security Notes

- **Never commit** your API Secret to version control
- Use environment variables for all sensitive credentials
- Consider using Cloudinary's signed URLs for additional security
- Set up upload presets in Cloudinary dashboard for better control

## Support

- Cloudinary Documentation: [https://cloudinary.com/documentation](https://cloudinary.com/documentation)
- Cloudinary Support: [https://support.cloudinary.com](https://support.cloudinary.com)






