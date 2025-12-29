# Cloudinary Setup Instructions

## Quick Setup

Add this to your `.env` file in `metermate-backend/` directory:

```env
CLOUDINARY_URL=cloudinary://843869936169693:6B4dEsHLSYQ4J77i23bS5ZrJIXk@dpim3nxi9
```

Or use individual variables:

```env
CLOUDINARY_CLOUD_NAME=dpim3nxi9
CLOUDINARY_API_KEY=843869936169693
CLOUDINARY_API_SECRET=6B4dEsHLSYQ4J77i23bS5ZrJIXk
```

## How to Create .env File

1. Navigate to backend directory:
   ```bash
   cd metermate-backend
   ```

2. Create `.env` file:
   ```bash
   touch .env
   ```

3. Add the Cloudinary URL:
   ```bash
   echo "CLOUDINARY_URL=cloudinary://843869936169693:6B4dEsHLSYQ4J77i23bS5ZrJIXk@dpim3nxi9" >> .env
   ```

4. Restart your server

## Verify Configuration

When you start the server, you should see:
```
☁️ Cloudinary configured: {
  cloud_name: 'dpim3nxi9',
  api_key: '***3693',
  configured: true,
  source: 'CLOUDINARY_URL'
}
```

## Testing Upload

1. Upload a photo from mobile app
2. Check backend logs for:
   - `📸 Starting Cloudinary upload`
   - `✅ Cloudinary upload successful`
   - `✅ Photo uploaded to Cloudinary successfully`

3. Check Cloudinary dashboard:
   - Go to https://console.cloudinary.com/
   - Check `meter-photos` folder
   - You should see uploaded images






