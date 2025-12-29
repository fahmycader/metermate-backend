# Cloudinary Credentials Setup

Your Cloudinary credentials have been configured! 

## Current Configuration

The credentials are currently set as defaults in `utils/cloudinary.js`:
- **Cloud Name**: `dpim3nxi9`
- **API Key**: `843869936169693`
- **API Secret**: `6B4dEsHLSYQ4J77i23bS5ZrJIXk`

## Option 1: Using Environment Variables (Recommended)

Create a `.env` file in the `metermate-backend` directory with:

```env
CLOUDINARY_CLOUD_NAME=dpim3nxi9
CLOUDINARY_API_KEY=843869936169693
CLOUDINARY_API_SECRET=6B4dEsHLSYQ4J77i23bS5ZrJIXk
```

The `.env` file is already in `.gitignore`, so it won't be committed to version control.

## Option 2: Using Default Values (Current Setup)

The credentials are already set as defaults in `utils/cloudinary.js`, so it will work immediately without creating a `.env` file.

## Testing the Configuration

1. Start your backend server:
   ```bash
   cd metermate-backend
   npm start
   ```

2. Check the console output - you should see:
   ```
   Cloudinary configured: { cloud_name: 'dpim3nxi9', api_key: '***3693', configured: true }
   ```

3. Upload a test photo through the mobile app

4. Check your Cloudinary dashboard at https://console.cloudinary.com/ to see the uploaded images in the `meter-photos` folder

## Security Note

For production, always use environment variables (Option 1) instead of hardcoded defaults. The current setup with defaults is fine for development/testing.






