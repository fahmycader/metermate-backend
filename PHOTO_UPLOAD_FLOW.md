# Photo Upload Flow - Complete Guide

## Overview
This document explains how photos are uploaded from the mobile app, stored in Cloudinary, and displayed in the admin panel.

## Flow Diagram

```
Mobile App (Flutter)
    ↓
1. User takes photo
    ↓
2. CameraService.uploadPhoto()
    ↓
3. POST /api/upload/meter-photo
    ↓
4. Backend uploads to Cloudinary
    ↓
5. Returns Cloudinary URL (https://res.cloudinary.com/...)
    ↓
6. Mobile app receives URL
    ↓
7. Mobile app sends URL in job completion
    ↓
8. PUT /api/jobs/:id/complete
    ↓
9. Backend saves URL to photos[] and meterPhotos[]
    ↓
10. Admin panel fetches jobs
    ↓
11. Displays images from Cloudinary URLs
```

## Step-by-Step Details

### 1. Mobile App - Photo Upload

**File**: `metermate-frontend/lib/services/camera_service.dart`

```dart
Future<String?> uploadPhoto(File imageFile, String jobId, String meterType) async {
  // Uploads to: POST /api/upload/meter-photo
  // Returns: Cloudinary URL (https://res.cloudinary.com/...)
}
```

### 2. Backend - Upload to Cloudinary

**File**: `metermate-backend/routes/upload.routes.js`

- Receives multipart file upload
- Uploads to Cloudinary using `uploadToCloudinary()`
- Returns Cloudinary secure URL

**Response**:
```json
{
  "success": true,
  "photoUrl": "https://res.cloudinary.com/dpim3nxi9/image/upload/v1234567890/meter-photos/meter-...",
  "publicId": "meter-photos/meter-...",
  "size": 123456,
  "width": 1920,
  "height": 1080
}
```

### 3. Mobile App - Job Completion

**File**: `metermate-frontend/lib/screens/meter_reading_screen.dart`

```dart
Map<String, dynamic> jobCompletionData = {
  'status': 'completed',
  'photos': photoUrls,  // Array of Cloudinary URLs
  'registerIds': regIds,
  'registerValues': regVals,
  // ... other fields
};

await jobService.completeJob(jobId, jobCompletionData);
```

### 4. Backend - Save Photos to Database

**File**: `metermate-backend/routes/job.routes.js`

**Endpoint**: `PUT /api/jobs/:id/complete`

- Receives `photos` array (Cloudinary URLs)
- Validates URLs (must start with `https://`, `http://`, or `/uploads/`)
- Creates `meterPhotos` entries with metadata:
  - `meterType`: Job type (electricity, gas, water)
  - `photoUrl`: Cloudinary URL
  - `serialNumber`: From registerIds or meterSerialNumber
  - `reading`: From registerValues
  - `timestamp`: Current date

- Saves to both:
  - `job.photos[]`: Array of URL strings
  - `job.meterPhotos[]`: Array of objects with metadata

### 5. Admin Panel - Fetch and Display

**File**: `metermate-admin/src/app/completed-jobs/page.tsx`

- Fetches jobs via: `GET /api/jobs?status=completed&assignedTo=operatorId`
- Backend returns jobs with `photos` and `meterPhotos` arrays
- `getAllPhotos()` function:
  - Combines photos from both arrays
  - Handles Cloudinary URLs (starts with `https://`)
  - Handles local URLs (starts with `/uploads/`)
- Displays in modal with image gallery

## Data Structures

### Job Model (MongoDB)

```javascript
{
  photos: [
    "https://res.cloudinary.com/dpim3nxi9/image/upload/v1234567890/meter-photos/meter-...",
    "https://res.cloudinary.com/dpim3nxi9/image/upload/v1234567891/meter-photos/meter-..."
  ],
  meterPhotos: [
    {
      meterType: "electricity",
      photoUrl: "https://res.cloudinary.com/dpim3nxi9/image/upload/v1234567890/meter-photos/meter-...",
      serialNumber: "SN-957222",
      reading: 14744,
      timestamp: "2025-12-14T16:26:08.236Z"
    }
  ]
}
```

## Cloudinary Configuration

**File**: `metermate-backend/utils/cloudinary.js`

- Cloud Name: `dpim3nxi9`
- API Key: `843869936169693`
- API Secret: `6B4dEsHLSYQ4J77i23bS5ZrJIXk`
- Folder: `meter-photos`

## Troubleshooting

### Photos not uploading
1. Check Cloudinary credentials in `.env` or `utils/cloudinary.js`
2. Check backend logs for Cloudinary errors
3. Verify network connectivity from mobile app

### Photos not saving to database
1. Check backend logs: "Job completion - Photo data"
2. Verify `photos` array is sent in job completion request
3. Check that URLs are valid (start with `https://`)

### Photos not displaying in admin panel
1. Check browser console for image loading errors
2. Verify `getAllPhotos()` is finding photos
3. Check that Cloudinary URLs are accessible (not private)
4. Check CORS settings if images fail to load

## Testing

1. **Upload Test**:
   ```bash
   # Check backend logs for:
   "Photo uploaded to Cloudinary: { url: '...', publicId: '...' }"
   ```

2. **Save Test**:
   ```bash
   # Check backend logs for:
   "Job completion - Photo data: { processedPhotos: [...], processedMeterPhotos: [...] }"
   ```

3. **Display Test**:
   - Open admin panel
   - Select operator
   - Click "View Details" on completed job
   - Check browser console for: "Getting photos for job: ..."
   - Verify images load in modal

## Environment Variables

Create `.env` file in `metermate-backend/`:

```env
CLOUDINARY_CLOUD_NAME=dpim3nxi9
CLOUDINARY_API_KEY=843869936169693
CLOUDINARY_API_SECRET=6B4dEsHLSYQ4J77i23bS5ZrJIXk
```





