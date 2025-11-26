const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const axios = require('axios');
const mongoose = require('mongoose');
const Job = require('../models/job.model');
const House = require('../models/house.model');
const User = require('../models/user.model');
const { protect } = require('../middleware/auth');

// Helper function to generate next JobID (000001, 000002, etc.)
async function generateNextJobId() {
  try {
    // Find the highest jobId number by converting to number for proper sorting
    const lastJob = await Job.findOne({ 
      jobId: { $exists: true, $ne: null, $regex: /^\d+$/ } 
    })
      .select('jobId')
      .lean();
    
    if (!lastJob || !lastJob.jobId) {
      return '000001';
    }
    
    // Extract number from jobId (e.g., "000001" -> 1)
    const lastNumber = parseInt(lastJob.jobId, 10);
    
    // Check if it's a valid number
    if (isNaN(lastNumber)) {
      return '000001';
    }
    
    const nextNumber = lastNumber + 1;
    
    // Format as 6-digit string with leading zeros
    return nextNumber.toString().padStart(6, '0');
  } catch (error) {
    console.error('Error generating JobID:', error);
    // Fallback: use timestamp-based ID if there's an error
    const timestamp = Date.now().toString().slice(-6);
    return timestamp.padStart(6, '0');
  }
}

// Helper function to generate multiple JobIDs in sequence (for bulk operations)
async function generateJobIds(count) {
  try {
    if (!count || count <= 0) {
      throw new Error('Count must be greater than 0');
    }
    
    // Get the last JobID - find all jobs with numeric jobIds and get the max
    const jobsWithIds = await Job.find({ 
      jobId: { $exists: true, $ne: null, $regex: /^\d+$/ } 
    })
      .select('jobId')
      .lean();
    
    let startNumber = 1;
    if (jobsWithIds && jobsWithIds.length > 0) {
      // Find the maximum numeric jobId
      const numbers = jobsWithIds
        .map(job => parseInt(job.jobId, 10))
        .filter(num => !isNaN(num));
      
      if (numbers.length > 0) {
        startNumber = Math.max(...numbers) + 1;
      }
    }
    
    // Generate sequential JobIDs
    const jobIds = [];
    for (let i = 0; i < count; i++) {
      const jobId = (startNumber + i).toString().padStart(6, '0');
      jobIds.push(jobId);
    }
    
    console.log(`Generated ${count} JobIDs starting from ${jobIds[0]}`);
    return jobIds;
  } catch (error) {
    console.error('Error generating JobIDs:', error);
    // Fallback: generate based on timestamp
    const timestamp = Date.now();
    const jobIds = [];
    for (let i = 0; i < count; i++) {
      const jobId = ((timestamp % 1000000) + i).toString().padStart(6, '0');
      jobIds.push(jobId);
    }
    console.log(`Using fallback JobIDs starting from ${jobIds[0]}`);
    return jobIds;
  }
}

// Helper function to sort jobs by postcode/location proximity
function sortJobsByProximity(jobs) {
  if (jobs.length === 0) return jobs;
  
  // Separate jobs with and without coordinates
  const jobsWithCoords = jobs.filter(job => {
    const lat = job.house?.latitude || job.address?.latitude || job.location?.latitude;
    const lng = job.house?.longitude || job.address?.longitude || job.location?.longitude;
    return lat != null && lng != null;
  });
  
  const jobsWithoutCoords = jobs.filter(job => {
    const lat = job.house?.latitude || job.address?.latitude || job.location?.latitude;
    const lng = job.house?.longitude || job.address?.longitude || job.location?.longitude;
    return lat == null || lng == null;
  });
  
  // If no jobs have coordinates, sort by postcode
  if (jobsWithCoords.length === 0) {
    return jobs.sort((a, b) => {
      const postcodeA = (a.house?.postcode || a.address?.zipCode || '').toString();
      const postcodeB = (b.house?.postcode || b.address?.zipCode || '').toString();
      return postcodeA.localeCompare(postcodeB);
    });
  }
  
  // Use nearest neighbor algorithm for jobs with coordinates
  const ordered = [];
  const remaining = [...jobsWithCoords];
  
  // Start with first job
  let current = remaining.shift();
  ordered.push(current);
  
  while (remaining.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;
    
    const currentLat = current.house?.latitude || current.address?.latitude || current.location?.latitude;
    const currentLng = current.house?.longitude || current.address?.longitude || current.location?.longitude;
    
    for (let i = 0; i < remaining.length; i++) {
      const jobLat = remaining[i].house?.latitude || remaining[i].address?.latitude || remaining[i].location?.latitude;
      const jobLng = remaining[i].house?.longitude || remaining[i].address?.longitude || remaining[i].location?.longitude;
      
      if (jobLat != null && jobLng != null) {
        const distance = calculateDistance(currentLat, currentLng, jobLat, jobLng);
        if (distance < minDistance) {
          minDistance = distance;
          nearestIndex = i;
        }
      }
    }
    
    current = remaining.splice(nearestIndex, 1)[0];
    ordered.push(current);
  }
  
  // Add jobs without coordinates at the end, sorted by postcode
  jobsWithoutCoords.sort((a, b) => {
    const postcodeA = (a.house?.postcode || a.address?.zipCode || '').toString();
    const postcodeB = (b.house?.postcode || b.address?.zipCode || '').toString();
    return postcodeA.localeCompare(postcodeB);
  });
  
  return [...ordered, ...jobsWithoutCoords];
}

// @route   GET /api/jobs
// @desc    Get all jobs
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { status, assignedTo, jobType, priority, page = 1, limit = 10 } = req.query;
    
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (assignedTo) {
      query.assignedTo = assignedTo;
    }

    if (jobType) {
      query.jobType = jobType;
    }

    if (priority) {
      query.priority = priority;
    }

    // If user is meter_reader, only show their jobs
    if (req.user.role === 'meter_reader') {
      query.assignedTo = req.user._id;
    }

    let jobs = await Job.find(query)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ sequenceNumber: 1, scheduledDate: 1 }) // Sort by sequence number first, then scheduled date
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Sort by postcode/location proximity for better route planning
    jobs = sortJobsByProximity(jobs);

    const total = await Job.countDocuments(query);

    res.json({
      jobs,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error('Get jobs error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST /api/jobs
// @desc    Create a new job
// @access  Private (Admin only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const jobData = req.body;
    
    // Validate that assigned user is from meter department
    if (!jobData.assignedTo) {
      return res.status(400).json({ 
        message: 'Assigned user is required' 
      });
    }
    
      const assignedUser = await User.findById(jobData.assignedTo);
      if (!assignedUser || assignedUser.department !== 'meter') {
        return res.status(400).json({ 
          message: 'Assigned user must be from meter department' 
        });
      }
    
    // Ensure assignedTo is converted to ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(jobData.assignedTo)) {
      return res.status(400).json({ 
        message: 'Invalid assigned user ID' 
      });
    }
    jobData.assignedTo = new mongoose.Types.ObjectId(jobData.assignedTo);
    
    // Add employeeId from assigned user
    if (assignedUser && assignedUser.employeeId) {
      jobData.employeeId = assignedUser.employeeId;
    }
    
    // Generate meaningful JobID
    if (!jobData.jobId) {
      jobData.jobId = await generateNextJobId();
    }
    
    // Assign sequence number if not provided
    // Sequence number should be the next number for this user on the scheduled date
    if (jobData.sequenceNumber === undefined || jobData.sequenceNumber === null) {
      const scheduledDate = jobData.scheduledDate ? new Date(jobData.scheduledDate) : new Date();
      const startOfDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());
      const endOfDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate() + 1);
      
      // Find the highest sequence number for this user on this date
      const lastJob = await Job.findOne({
        assignedTo: jobData.assignedTo,
        scheduledDate: {
          $gte: startOfDay,
          $lt: endOfDay
        },
        sequenceNumber: { $ne: null }
      })
      .sort({ sequenceNumber: -1 })
      .select('sequenceNumber');
      
      jobData.sequenceNumber = lastJob && lastJob.sequenceNumber !== null ? lastJob.sequenceNumber + 1 : 1;
    }
    
    const job = await Job.create(jobData);

    // Populate the job with house and user data
    const populatedJob = await Job.findById(job._id)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department');

    res.status(201).json(populatedJob);
    
    // Emit WebSocket event for job creation
    if (global.io) {
      // Notify admin room
      global.io.to('admin_room').emit('jobUpdate', {
        type: 'jobCreated',
        job: populatedJob,
        timestamp: new Date()
      });

      // Also notify the assigned user about new job
      if (populatedJob.assignedTo && populatedJob.assignedTo._id) {
        global.io.to(`user_${populatedJob.assignedTo._id}`).emit('jobUpdate', {
          type: 'newJobAssigned',
          job: populatedJob,
          timestamp: new Date(),
          message: 'You have been assigned a new job'
        });
      }
    }
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Configure multer for Excel file uploads
const excelStorage = multer.memoryStorage();
const excelUpload = multer({
  storage: excelStorage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedMimes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
      'text/csv' // .csv
    ];
    if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files (.xlsx, .xls, .csv) are allowed'), false);
    }
  }
});

// Helper function to geocode address
async function geocodeAddress(addressString) {
  try {
    // Using Nominatim (OpenStreetMap) geocoding API - free, no API key required
    const encodedAddress = encodeURIComponent(addressString);
    const response = await axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${encodedAddress}&limit=1`, {
      headers: {
        'User-Agent': 'MeterMate-App/1.0'
      },
      timeout: 5000
    });

    if (response.data && response.data.length > 0) {
      return {
        latitude: parseFloat(response.data[0].lat),
        longitude: parseFloat(response.data[0].lon)
      };
    }
    return null;
  } catch (error) {
    console.error('Geocoding error:', error.message);
    return null;
  }
}

// Helper function to order jobs by nearest neighbor (location-based ordering)
function orderJobsByLocation(jobsWithCoords) {
  if (jobsWithCoords.length === 0) return [];

  // Use nearest neighbor algorithm
  const ordered = [];
  const remaining = [...jobsWithCoords];
  
  // Start with first job
  let current = remaining.shift();
  ordered.push(current);

  while (remaining.length > 0) {
    // Find nearest job to current
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const distance = calculateDistance(
        current.latitude, current.longitude,
        remaining[i].latitude, remaining[i].longitude
      );
      if (distance < minDistance) {
        minDistance = distance;
        nearestIndex = i;
      }
    }

    current = remaining.splice(nearestIndex, 1)[0];
    ordered.push(current);
  }

  return ordered;
}

// @route   POST /api/jobs/upload-excel
// @desc    Upload Excel file with job details and create jobs ordered by location
// @access  Private (Admin only)
router.post('/upload-excel', protect, excelUpload.single('excelFile'), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No Excel file uploaded' });
    }

    const { assignedTo, scheduledDate, priority = 'medium' } = req.body;

    if (!assignedTo) {
      return res.status(400).json({ message: 'Assigned user is required' });
    }

    // Validate assigned user
    const assignedUser = await User.findById(assignedTo);
    if (!assignedUser || assignedUser.department !== 'meter') {
      return res.status(400).json({ message: 'Assigned user must be from meter department' });
    }
    
    // Get employeeId from assigned user
    const employeeId = assignedUser.employeeId || '';

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log(`Excel file parsed: ${jsonData.length} rows found`);

    if (jsonData.length === 0) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    // Log first row to help debug column mapping
    if (jsonData.length > 0) {
      console.log('Sample row data:', JSON.stringify(jsonData[0], null, 2));
    }

    // Expected columns: street, city, state, zipCode, jobType, sup, jt, cust, meterMake, meterModel, meterSerialNumber, notes
    const jobsData = [];
    const jobsWithCoords = [];

    // Process each row and geocode addresses
    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      
      // Build address string
      const street = (row.street || row.Street || row.address || row.Address || '').toString().trim();
      const city = (row.city || row.City || '').toString().trim();
      const state = (row.state || row.State || '').toString().trim();
      const zipCode = (row.zipCode || row['zipCode'] || row['Zip Code'] || row.postcode || row.Postcode || '').toString().trim();
      
      if (!street || !city || !state) {
        console.warn(`Skipping row ${i + 1}: Missing required address fields (street: "${street}", city: "${city}", state: "${state}")`);
        console.warn(`Row ${i + 1} data:`, JSON.stringify(row, null, 2));
        continue;
      }

      const addressString = `${street}, ${city}, ${state} ${zipCode}`;

      // Geocode address
      const coords = await geocodeAddress(addressString);
      
      const jobData = {
        jobType: (row.jobType || row['Job Type'] || row.type || 'electricity').toString().toLowerCase(),
        address: {
          street,
          city,
          state,
          zipCode,
          country: 'USA'
        },
        assignedTo: new mongoose.Types.ObjectId(assignedTo),
        employeeId: employeeId, // Add employeeId from assigned user
        priority: (row.priority || priority).toString().toLowerCase(),
        status: 'pending',
        scheduledDate: scheduledDate ? (scheduledDate.includes('T') ? new Date(scheduledDate) : new Date(scheduledDate + 'T00:00:00')) : new Date(),
        sup: (row.sup || row.Sup || row.supplier || '').toString().trim(),
        jt: (row.jt || row.JT || row['Job Title'] || '').toString().trim(),
        cust: (row.cust || row.Cust || row.customer || '').toString().trim(),
        meterMake: (row.meterMake || row['Meter Make'] || row.make || '').toString().trim(),
        meterModel: (row.meterModel || row['Meter Model'] || row.model || '').toString().trim(),
        meterSerialNumber: (row.meterSerialNumber || row['Meter Serial Number'] || row.serialNumber || '').toString().trim(),
        notes: (row.notes || row.Notes || '').toString().trim(),
      };

      // Add location if geocoded
      if (coords) {
        jobData.address.latitude = coords.latitude;
        jobData.address.longitude = coords.longitude;
        jobData.location = { latitude: coords.latitude, longitude: coords.longitude };
        jobsWithCoords.push({ ...jobData, latitude: coords.latitude, longitude: coords.longitude });
      } else {
        jobsWithCoords.push({ ...jobData, latitude: null, longitude: null });
      }

      jobsData.push(jobData);

      // Rate limiting for geocoding (avoid too many requests)
      if (i < jsonData.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
      }
    }

    // Order jobs by nearest neighbor algorithm
    const orderedJobs = orderJobsByLocation(jobsWithCoords.filter(j => j.latitude !== null));
    const jobsWithoutCoords = jobsWithCoords.filter(j => j.latitude === null);

    console.log(`Total jobs to create: ${orderedJobs.length + jobsWithoutCoords.length}`);
    console.log(`Jobs with coordinates: ${orderedJobs.length}, Jobs without coordinates: ${jobsWithoutCoords.length}`);

    // Assign sequence numbers and generate JobIDs
    let sequenceNumber = 1;
    const jobsToCreate = [];
    const totalJobsToCreate = orderedJobs.length + jobsWithoutCoords.length;
    
    // Generate all JobIDs at once to avoid race conditions
    const jobIds = await generateJobIds(totalJobsToCreate);
    let jobIdIndex = 0;

    // Add ordered jobs first
    for (const job of orderedJobs) {
      const { latitude, longitude, ...jobData } = job;
      jobData.sequenceNumber = sequenceNumber++;
      // Assign JobID from pre-generated list
      jobData.jobId = jobIds[jobIdIndex++];
      jobsToCreate.push(jobData);
    }

    // Add jobs without coordinates at the end
    for (const job of jobsWithoutCoords) {
      const { latitude, longitude, ...jobData } = job;
      jobData.sequenceNumber = sequenceNumber++;
      // Assign JobID from pre-generated list
      jobData.jobId = jobIds[jobIdIndex++];
      jobsToCreate.push(jobData);
    }

    if (jobsToCreate.length === 0) {
      console.error('No jobs to create after processing Excel file');
      return res.status(400).json({ 
        message: 'No valid jobs found in Excel file. Please check the file format and required columns (street, city, state).' 
      });
    }

    console.log(`Creating ${jobsToCreate.length} jobs...`);

    // Create jobs in bulk
    let createdJobs;
    try {
      createdJobs = await Job.insertMany(jobsToCreate);
      console.log(`Successfully created ${createdJobs.length} jobs in database`);
    } catch (insertError) {
      console.error('Error inserting jobs:', insertError);
      
      // Check if it's a duplicate key error (jobId conflict)
      if (insertError.code === 11000) {
        // Try to find which jobId caused the conflict
        const duplicateKey = insertError.keyPattern || insertError.keyValue;
        return res.status(400).json({ 
          message: `Duplicate JobID detected. Please try uploading again. Error: ${insertError.message}`,
          error: 'DUPLICATE_JOBID'
        });
      }
      
      // Check for validation errors
      if (insertError.name === 'ValidationError') {
        const validationErrors = Object.values(insertError.errors || {}).map(err => err.message);
        return res.status(400).json({ 
          message: `Validation error: ${validationErrors.join(', ')}`,
          errors: validationErrors
        });
      }
      
      throw insertError; // Re-throw if it's not a handled error
    }

    // Populate created jobs
    const populatedJobs = await Job.find({ _id: { $in: createdJobs.map(j => j._id) } })
      .populate('assignedTo', 'firstName lastName username employeeId department');

    // Emit WebSocket event to admin room
    if (global.io) {
      global.io.to('admin_room').emit('jobUpdate', {
        type: 'jobsBulkCreated',
        count: createdJobs.length,
        jobs: populatedJobs,
        timestamp: new Date()
      });

      // Also notify the assigned user about new jobs
      global.io.to(`user_${assignedTo}`).emit('jobUpdate', {
        type: 'newJobsAssigned',
        count: createdJobs.length,
        jobs: populatedJobs,
        timestamp: new Date(),
        message: `You have been assigned ${createdJobs.length} new job(s)`
      });

      console.log(`WebSocket notifications sent to admin_room and user_${assignedTo}`);
    }

    res.status(201).json({
      success: true,
      message: `Successfully created ${createdJobs.length} jobs ordered by location`,
      count: createdJobs.length,
      jobs: populatedJobs
    });
  } catch (error) {
    console.error('Excel upload error:', error);
    console.error('Error stack:', error.stack);
    
    // Provide more detailed error messages
    let errorMessage = 'Server Error';
    let statusCode = 500;
    
    if (error.message) {
      errorMessage = error.message;
    }
    
    // Handle specific error types
    if (error.code === 11000) {
      statusCode = 400;
      errorMessage = `Duplicate entry detected: ${error.message}`;
    } else if (error.name === 'ValidationError') {
      statusCode = 400;
      const validationErrors = Object.values(error.errors || {}).map(err => err.message);
      errorMessage = `Validation error: ${validationErrors.join(', ')}`;
    } else if (error.response) {
      // Axios error
      statusCode = error.response.status || 500;
      errorMessage = error.response.data?.message || error.message;
    }
    
    res.status(statusCode).json({ 
      message: errorMessage, 
      error: error.message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// @route   GET /api/jobs/assigned
// @desc    Get jobs assigned to current user (for mobile app)
// @access  Private (Meter readers only)
router.get('/assigned', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const { status, jobType, priority } = req.query;
    
    let query = { assignedTo: req.user._id };
    
    if (status) {
      query.status = status;
    }
    
    if (jobType) {
      query.jobType = jobType;
    }

    if (priority) {
      query.priority = priority;
    }

    let jobs = await Job.find(query)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ sequenceNumber: 1, scheduledDate: 1 }); // Sort by sequence number first, then scheduled date

    // Sort by postcode/location proximity for better route planning
    jobs = sortJobsByProximity(jobs);

    res.json({
      jobs,
      count: jobs.length,
      user: {
        _id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
      }
    });
  } catch (error) {
    console.error('Get assigned jobs error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/jobs/today
// @desc    Get today's jobs assigned to current user (for mobile app)
// @access  Private (Meter readers only)
router.get('/today', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const { status, jobType, priority } = req.query;
    
    let query = { 
      assignedTo: req.user._id,
      scheduledDate: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    };
    
    if (status) {
      query.status = status;
    }
    
    if (jobType) {
      query.jobType = jobType;
    }

    if (priority) {
      query.priority = priority;
    }

    let jobs = await Job.find(query)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ sequenceNumber: 1, scheduledDate: 1 }); // Sort by sequence number first, then scheduled date

    // Sort by postcode/location proximity for better route planning
    jobs = sortJobsByProximity(jobs);

    // Get job counts by status
    const pendingCount = await Job.countDocuments({
      ...query,
      status: 'pending'
    });
    
    const inProgressCount = await Job.countDocuments({
      ...query,
      status: 'in_progress'
    });
    
    const completedCount = await Job.countDocuments({
      ...query,
      status: 'completed'
    });

    res.json({
      jobs,
      count: jobs.length,
      counts: {
        pending: pendingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        total: jobs.length
      },
      date: today.toISOString().split('T')[0],
      user: {
        _id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
      }
    });
  } catch (error) {
    console.error('Get today\'s jobs error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/jobs/today-geo
// @desc    Get today's jobs assigned to current user sorted by geographical distance
// @access  Private (Meter readers only)
router.get('/today-geo', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const { status, jobType, priority, userLatitude, userLongitude } = req.query;
    
    let query = { 
      assignedTo: req.user._id,
      scheduledDate: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    };
    
    if (status) {
      query.status = status;
    }
    
    if (jobType) {
      query.jobType = jobType;
    }

    if (priority) {
      query.priority = priority;
    }

    let jobs = await Job.find(query)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ sequenceNumber: 1, scheduledDate: 1 }); // Sort by sequence number first, then scheduled date

    // Sort by postcode/location proximity for better route planning
    jobs = sortJobsByProximity(jobs);

    // If user location is provided, add distance from user for display
    if (userLatitude && userLongitude) {
      const userLat = parseFloat(userLatitude);
      const userLng = parseFloat(userLongitude);

      jobs.forEach(job => {
        const lat = job.house?.latitude || job.address?.latitude || job.location?.latitude;
        const lng = job.house?.longitude || job.address?.longitude || job.location?.longitude;
        
        if (lat != null && lng != null) {
          const distance = calculateDistance(userLat, userLng, lat, lng);
          job.distanceFromUser = distance;
        } else {
          job.distanceFromUser = Infinity; // Put jobs without location at the end
        }
      });
    }

    // Get job counts by status
    const pendingCount = await Job.countDocuments({
      ...query,
      status: 'pending'
    });
    
    const inProgressCount = await Job.countDocuments({
      ...query,
      status: 'in_progress'
    });
    
    const completedCount = await Job.countDocuments({
      ...query,
      status: 'completed'
    });

    res.json({
      jobs,
      count: jobs.length,
      counts: {
        pending: pendingCount,
        inProgress: inProgressCount,
        completed: completedCount,
        total: jobs.length
      },
      date: today.toISOString().split('T')[0],
      user: {
        _id: req.user.id,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        username: req.user.username,
      }
    });
  } catch (error) {
    console.error('Get today\'s jobs geo error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// Helper function to calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in kilometers
  return distance;
}

// @route   GET /api/jobs/my-count
// @desc    Get job counts for current user (meter readers only)
// @access  Private (Meter readers only)
router.get('/my-count', protect, async (req, res) => {
  try {
    // Only meter readers can access this endpoint
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const { status, jobType, priority, dateRange } = req.query;

    let query = { assignedTo: req.user._id };

    // Add filters
    if (status) {
      query.status = status;
    }
    
    if (jobType) {
      query.jobType = jobType;
    }

    if (priority) {
      query.priority = priority;
    }

    // Add date range filter if provided
    if (dateRange === 'today') {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      query.scheduledDate = {
        $gte: startOfDay,
        $lt: endOfDay
      };
    }

    // Get total count
    const totalCount = await Job.countDocuments(query);

    // Get counts by status
    const pendingCount = await Job.countDocuments({ ...query, status: 'pending' });
    const inProgressCount = await Job.countDocuments({ ...query, status: 'in_progress' });
    const completedCount = await Job.countDocuments({ ...query, status: 'completed' });
    const cancelledCount = await Job.countDocuments({ ...query, status: 'cancelled' });

    // Get counts by job type
    const electricityCount = await Job.countDocuments({ ...query, jobType: 'electricity' });
    const gasCount = await Job.countDocuments({ ...query, jobType: 'gas' });
    const waterCount = await Job.countDocuments({ ...query, jobType: 'water' });

    // Get counts by priority
    const highPriorityCount = await Job.countDocuments({ ...query, priority: 'high' });
    const mediumPriorityCount = await Job.countDocuments({ ...query, priority: 'medium' });
    const lowPriorityCount = await Job.countDocuments({ ...query, priority: 'low' });

    res.json({
      success: true,
      data: {
        user: {
          _id: req.user.id,
          firstName: req.user.firstName,
          lastName: req.user.lastName,
          username: req.user.username,
          employeeId: req.user.employeeId,
          department: req.user.department
        },
        counts: {
          total: totalCount,
          byStatus: {
            pending: pendingCount,
            inProgress: inProgressCount,
            completed: completedCount,
            cancelled: cancelledCount
          },
          byJobType: {
            electricity: electricityCount,
            gas: gasCount,
            water: waterCount
          },
          byPriority: {
            high: highPriorityCount,
            medium: mediumPriorityCount,
            low: lowPriorityCount
          }
        },
        filters: {
          status,
          jobType,
          priority,
          dateRange
        }
      }
    });
  } catch (error) {
    console.error('Get my job count error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/jobs/user/:userId/count
// @desc    Get job counts for a specific user (where department === 'meter')
// @access  Private (Admin only)
router.get('/user/:userId/count', protect, async (req, res) => {
  try {
    // Only admin can access this endpoint
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { userId } = req.params;
    const { status, jobType, priority, dateRange } = req.query;

    // Verify the user exists and has department === 'meter'
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.department !== 'meter') {
      return res.status(400).json({ message: 'User is not a meter reader' });
    }

    let query = { assignedTo: userId };

    // Add filters
    if (status) {
      query.status = status;
    }
    
    if (jobType) {
      query.jobType = jobType;
    }

    if (priority) {
      query.priority = priority;
    }

    // Add date range filter if provided
    if (dateRange === 'today') {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
      query.scheduledDate = {
        $gte: startOfDay,
        $lt: endOfDay
      };
    }

    // Get total count
    const totalCount = await Job.countDocuments(query);

    // Get counts by status
    const pendingCount = await Job.countDocuments({ ...query, status: 'pending' });
    const inProgressCount = await Job.countDocuments({ ...query, status: 'in_progress' });
    const completedCount = await Job.countDocuments({ ...query, status: 'completed' });
    const cancelledCount = await Job.countDocuments({ ...query, status: 'cancelled' });

    // Get counts by job type
    const electricityCount = await Job.countDocuments({ ...query, jobType: 'electricity' });
    const gasCount = await Job.countDocuments({ ...query, jobType: 'gas' });
    const waterCount = await Job.countDocuments({ ...query, jobType: 'water' });

    // Get counts by priority
    const highPriorityCount = await Job.countDocuments({ ...query, priority: 'high' });
    const mediumPriorityCount = await Job.countDocuments({ ...query, priority: 'medium' });
    const lowPriorityCount = await Job.countDocuments({ ...query, priority: 'low' });

    res.json({
      success: true,
      data: {
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          username: user.username,
          employeeId: user.employeeId,
          department: user.department
        },
        counts: {
          total: totalCount,
          byStatus: {
            pending: pendingCount,
            inProgress: inProgressCount,
            completed: completedCount,
            cancelled: cancelledCount
          },
          byJobType: {
            electricity: electricityCount,
            gas: gasCount,
            water: waterCount
          },
          byPriority: {
            high: highPriorityCount,
            medium: mediumPriorityCount,
            low: lowPriorityCount
          }
        },
        filters: {
          status,
          jobType,
          priority,
          dateRange
        }
      }
    });
  } catch (error) {
    console.error('Get user job count error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/jobs/debug-data
// @desc    Debug endpoint to check job data (Admin only)
// @access  Private (Admin only)
router.get('/debug-data', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    // Get all jobs with basic info
    const allJobs = await Job.find({})
      .populate('assignedTo', 'firstName lastName username employeeId')
      .select('status distanceTraveled completedDate scheduledDate jobType')
      .sort({ createdAt: -1 })
      .limit(10);

    // Get job counts by status
    const statusCounts = await Job.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get jobs with distance data
    const jobsWithDistance = await Job.find({
      distanceTraveled: { $exists: true, $gt: 0 }
    }).countDocuments();

    // Get completed jobs count
    const completedJobsCount = await Job.find({
      status: 'completed'
    }).countDocuments();

    // Get jobs by status for each user
    const jobsByUserAndStatus = await Job.aggregate([
      {
        $group: {
          _id: {
            userId: '$assignedTo',
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id.userId',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: '$user'
      },
      {
        $project: {
          userName: { $concat: ['$user.firstName', ' ', '$user.lastName'] },
          status: '$_id.status',
          count: 1
        }
      }
    ]);

    res.json({
      success: true,
      debug: {
        totalJobs: allJobs.length,
        recentJobs: allJobs,
        statusCounts,
        jobsWithDistance,
        completedJobsCount,
        jobsByUserAndStatus,
        sampleJobs: allJobs.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('Debug data error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT /api/jobs/:id/test-complete
// @desc    Test endpoint to mark a job as completed (for debugging)
// @access  Private (Admin only)
router.put('/:id/test-complete', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Mark job as completed with some test data
    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      {
        status: 'completed',
        completedDate: new Date(),
        distanceTraveled: 5.2, // Test distance in km
        endLocation: {
          latitude: 51.5074,
          longitude: -0.1278,
          timestamp: new Date()
        }
      },
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .populate('house', 'address postcode city county latitude longitude meterType');

    res.json({
      success: true,
      job: updatedJob,
      message: 'Job marked as completed for testing'
    });
  } catch (error) {
    console.error('Test complete job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/jobs/wage-report
// @desc    Get wage calculation report for all users (Admin only)
// @access  Private (Admin only)
router.get('/wage-report', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { userId, startDate, endDate, ratePerKm = 0.50, fuelAllowancePerJob = 1.00 } = req.query;

    // Build date filter
    let dateFilter = {};
    if (startDate && endDate) {
      dateFilter = {
        scheduledDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        }
      };
    } else if (startDate) {
      dateFilter = {
        scheduledDate: {
          $gte: new Date(startDate)
        }
      };
    } else if (endDate) {
      dateFilter = {
        scheduledDate: {
          $lte: new Date(endDate)
        }
      };
    }

    // Build user filter
    let userFilter = {};
    if (userId) {
      userFilter = { assignedTo: userId };
    }

    // Get all jobs with filters
    const jobs = await Job.find({
      ...dateFilter,
      ...userFilter
    })
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .populate('house', 'address postcode city county latitude longitude meterType')
      .sort({ scheduledDate: -1 });

    // Group jobs by user and calculate wages
    const userWageMap = new Map();

    jobs.forEach(job => {
      const userId = job.assignedTo._id.toString();
      
      if (!userWageMap.has(userId)) {
        userWageMap.set(userId, {
          user: job.assignedTo,
          totalDistance: 0,
          totalJobs: 0,
          completedJobs: 0,
          baseWage: 0,
          fuelAllowance: 0,
          totalWage: 0,
          jobs: []
        });
      }

      const userData = userWageMap.get(userId);
      
      // Count all jobs
      userData.totalJobs += 1;
      
      // Count completed jobs and add distance
      if (job.status === 'completed') {
        userData.completedJobs += 1;
        
        if (job.distanceTraveled && job.distanceTraveled > 0) {
          userData.totalDistance += job.distanceTraveled;
        }
      }
      
      // Add job to list
      userData.jobs.push({
        _id: job._id,
        jobType: job.jobType,
        status: job.status,
        scheduledDate: job.scheduledDate,
        completedDate: job.completedDate,
        distanceTraveled: job.distanceTraveled || 0,
        address: job.house ? {
          street: job.house.address,
          city: job.house.city,
          county: job.house.county,
          postcode: job.house.postcode
        } : null
      });
    });

    // Calculate wages for each user
    const wageData = Array.from(userWageMap.values()).map(data => {
      const baseWage = data.totalDistance * parseFloat(ratePerKm);
      const fuelAllowance = data.completedJobs * parseFloat(fuelAllowancePerJob);
      const totalWage = baseWage + fuelAllowance;

      return {
        ...data,
        baseWage,
        fuelAllowance,
        totalWage,
        averageDistancePerJob: data.completedJobs > 0 ? data.totalDistance / data.completedJobs : 0
      };
    });

    // Calculate summary
    const summary = {
      totalUsers: wageData.length,
      totalDistance: wageData.reduce((sum, data) => sum + data.totalDistance, 0),
      totalJobs: wageData.reduce((sum, data) => sum + data.totalJobs, 0),
      totalCompletedJobs: wageData.reduce((sum, data) => sum + data.completedJobs, 0),
      totalBaseWage: wageData.reduce((sum, data) => sum + data.baseWage, 0),
      totalFuelAllowance: wageData.reduce((sum, data) => sum + data.fuelAllowance, 0),
      totalWage: wageData.reduce((sum, data) => sum + data.totalWage, 0),
      ratePerKm: parseFloat(ratePerKm),
      fuelAllowancePerJob: parseFloat(fuelAllowancePerJob)
    };

    res.json({
      success: true,
      data: wageData,
      summary,
      filters: {
        userId,
        startDate,
        endDate,
        ratePerKm: parseFloat(ratePerKm),
        fuelAllowancePerJob: parseFloat(fuelAllowancePerJob)
      }
    });
  } catch (error) {
    console.error('Get wage report error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/jobs/mileage-report
// @desc    Get mileage report for all users (Admin only)
// @access  Private (Admin only)
router.get('/mileage-report', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { dateRange = 'week' } = req.query;
    
    // Build date filter
    let dateFilter = {};
    const now = new Date();
    
    switch (dateRange) {
      case 'today':
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        dateFilter = {
          scheduledDate: { $gte: startOfToday, $lt: endOfToday }
        };
        break;
      case 'week':
        const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        dateFilter = {
          scheduledDate: { $gte: startOfWeek }
        };
        break;
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        dateFilter = {
          scheduledDate: { $gte: startOfMonth }
        };
        break;
      // 'all' case - no date filter
    }

    // Get all jobs (not just completed ones) to show comprehensive data
    const jobs = await Job.find({
      ...dateFilter
    })
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ scheduledDate: -1 });

    // Group by user
    const userMileageMap = new Map();
    
    jobs.forEach(job => {
      const userId = job.assignedTo._id.toString();
      
      if (!userMileageMap.has(userId)) {
        userMileageMap.set(userId, {
          user: job.assignedTo,
          totalDistance: 0,
          totalJobs: 0,
          completedJobs: 0,
          jobs: []
        });
      }
      
      const userData = userMileageMap.get(userId);
      
      // Count completed jobs regardless of distance data
      if (job.status === 'completed') {
        userData.completedJobs += 1;
        
        // Add distance if job has distance data
        if (job.distanceTraveled && job.distanceTraveled > 0) {
          userData.totalDistance += job.distanceTraveled;
        }
      }
      
      userData.totalJobs += 1;
      userData.jobs.push(job);
    });

    // Convert to array and calculate averages
    const mileageData = Array.from(userMileageMap.values()).map(data => ({
      ...data,
      averageDistancePerJob: data.completedJobs > 0 && data.totalDistance > 0 ? data.totalDistance / data.completedJobs : 0
    }));

    // Debug logging
    console.log('Mileage Report Debug:');
    console.log('- Total jobs found:', jobs.length);
    console.log('- Jobs by status:', jobs.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {}));
    console.log('- Users with data:', mileageData.length);
    console.log('- Sample user data:', mileageData.slice(0, 2));

    res.json({
      success: true,
      data: mileageData,
      summary: {
        totalUsers: mileageData.length,
        totalDistance: mileageData.reduce((sum, data) => sum + data.totalDistance, 0),
        totalJobs: mileageData.reduce((sum, data) => sum + data.totalJobs, 0),
        totalCompletedJobs: mileageData.reduce((sum, data) => sum + data.completedJobs, 0)
      }
    });
  } catch (error) {
    console.error('Get mileage report error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/jobs/:id
// @desc    Get a single job
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    // Check if the id is a valid ObjectId format (24 hex characters)
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) {
      return res.status(400).json({ message: 'Invalid job ID format' });
    }

    const job = await Job.findById(req.params.id)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department');

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // If user is meter_reader, only show their jobs
    if (req.user.role === 'meter_reader' && job.assignedTo._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json(job);
  } catch (error) {
    console.error('Get job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT /api/jobs/:id
// @desc    Update a job
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // If user is meter_reader, only allow updating their own jobs
    if (req.user.role === 'meter_reader' && job.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department');

    res.json(updatedJob);
    
    // Emit WebSocket event for job update
    if (global.io) {
      global.io.to('admin_room').emit('jobUpdate', {
        type: 'jobUpdated',
        job: updatedJob,
        timestamp: new Date()
      });
      
      // Also emit to the specific user's room
      global.io.to(`user_${updatedJob.assignedTo._id}`).emit('jobUpdate', {
        type: 'jobUpdated',
        job: updatedJob,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('Update job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT /api/jobs/:id/complete
// @desc    Complete a job with location and distance data
// @access  Private
router.put('/:id/complete', protect, async (req, res) => {
  try {
    const { 
      status = 'completed', 
      meterReadings, 
      photos, 
      location, 
      distanceTraveled,
      startLocation,
      endLocation,
      locationHistory,
      notes,
      risk,
      mInspec,
      numRegisters,
      registerIds,
      registerValues,
      validNoAccess,
      noAccessReason
    } = req.body;

    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if user is assigned to this job or is admin
    if (job.assignedTo.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to complete this job' });
    }

    // Enforce sequential job completion - can only complete jobs in order
    // This applies to all meter readers
    if (req.user.role === 'meter_reader' && job.sequenceNumber !== null) {
      const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : new Date();
      const startOfDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());
      const endOfDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate() + 1);
      
      // Find any pending or in_progress job with a lower sequence number for the same scheduled date
      const earlierPendingJob = await Job.findOne({
        assignedTo: req.user._id,
        status: { $in: ['pending', 'in_progress'] },
        scheduledDate: {
          $gte: startOfDay,
          $lt: endOfDay
        },
        sequenceNumber: { $lt: job.sequenceNumber, $ne: null }
      }).sort({ sequenceNumber: 1 });

      if (earlierPendingJob) {
        return res.status(400).json({ 
          message: `You cannot skip jobs in the sequence. Please complete job ${earlierPendingJob.jobId || `#${earlierPendingJob.sequenceNumber}`} first before completing job ${job.jobId || `#${job.sequenceNumber}`}.`,
          nextJobId: earlierPendingJob._id,
          nextJobDisplayId: earlierPendingJob.jobId || `#${earlierPendingJob.sequenceNumber}`,
          nextSequenceNumber: earlierPendingJob.sequenceNumber,
          currentJobDisplayId: job.jobId || `#${job.sequenceNumber}`
        });
      }
    }

    // Get user's employeeId
    const user = await require('../models/user.model').findById(req.user.id);
    const employeeId = user?.employeeId || '';

    // Calculate distance if start and end locations are provided
    let calculatedDistance = distanceTraveled || 0;
    if (startLocation && endLocation && !distanceTraveled) {
      calculatedDistance = calculateDistance(
        startLocation.latitude, startLocation.longitude,
        endLocation.latitude, endLocation.longitude
      );
    }

    // Calculate points based on completion type
    let points = 0;
    let isValidNoAccess = false;
    
    // Valid no access reasons list
    const validNoAccessReasons = [
      'Property locked - no key access',
      'Dog on property - safety concern',
      'Occupant not home - appointment required',
      'Meter location inaccessible',
      'Property under construction',
      'Hazardous conditions present',
      'Permission denied by occupant',
      'Meter damaged - requires repair first',
    ];

    if (validNoAccess === true && noAccessReason && validNoAccessReasons.includes(noAccessReason)) {
      // Valid no access = 0.5 points
      points = 0.5;
      isValidNoAccess = true;
    } else if (meterReadings && (meterReadings.electric || meterReadings.gas || meterReadings.water)) {
      // Valid job completion with meter reading = 1 point
      points = 1;
    }

    const updateData = {
      status,
      completedDate: new Date(),
      employeeId,
      points,
      validNoAccess: isValidNoAccess,
      ...(noAccessReason && { noAccessReason }),
      ...(meterReadings && { meterReadings }),
      ...(photos && { photos }),
      ...(location && { location }),
      ...(distanceTraveled && { distanceTraveled: calculatedDistance }),
      ...(startLocation && { startLocation }),
      ...(endLocation && { endLocation }),
      ...(locationHistory && { locationHistory }),
      ...(notes && { notes }),
      ...(typeof risk === 'boolean' && { risk }),
      ...(typeof mInspec === 'boolean' && { mInspec }),
      ...(typeof numRegisters === 'number' && { numRegisters }),
      ...(Array.isArray(registerIds) && registerIds.length > 0 && { registerIds }),
      ...(Array.isArray(registerValues) && registerValues.length > 0 && { registerValues })
    };

    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    )
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .populate('house', 'address postcode city county latitude longitude meterType');

    // Emit WebSocket events for real-time updates
    if (global.io) {
      global.io.to('admin_room').emit('jobUpdate', {
        type: 'job_completed',
        job: updatedJob,
        userId: req.user.id
      });
      
      global.io.to('admin_room').emit('mileageUpdate', {
        type: 'mileage_updated',
        job: updatedJob,
        userId: req.user.id
      });
      
      // If this was the user's last job for today, send an automatic mileage message
      try {
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        const remaining = await Job.countDocuments({
          assignedTo: req.user._id,
          scheduledDate: { $gte: startOfDay, $lt: endOfDay },
          status: { $ne: 'completed' }
        });
        if (remaining === 0) {
          const completedToday = await Job.find({
            assignedTo: req.user._id,
            scheduledDate: { $gte: startOfDay, $lt: endOfDay },
            status: 'completed'
          });
          
          // Calculate statistics
          const totalKm = completedToday.reduce((sum, j) => sum + (j.distanceTraveled || 0), 0);
          // Convert kilometers to miles (1 km = 0.621371 miles)
          const totalMiles = totalKm * 0.621371;
          
          // Jobs completed successfully (with meter reading)
          const jobsWithReading = completedToday.filter(j => 
            j.meterReadings && (j.meterReadings.electric || j.meterReadings.gas || j.meterReadings.water)
          ).length;
          
          // Valid No Access jobs completed
          const validNoAccessJobs = completedToday.filter(j => j.validNoAccess === true).length;
          
          // Calculate points
          const pointsFromJobs = completedToday.filter(j => 
            j.meterReadings && (j.meterReadings.electric || j.meterReadings.gas || j.meterReadings.water)
          ).reduce((sum, j) => sum + (j.points || 1), 0);
          
          const pointsFromNoAccess = completedToday.filter(j => j.validNoAccess === true)
            .reduce((sum, j) => sum + (j.points || 0.5), 0);
          
          const totalPoints = pointsFromJobs + pointsFromNoAccess;
          
          // Calculate mileage payment (assuming £0.45 per mile - adjust as needed)
          const mileageRate = 0.45; // £0.45 per mile
          const mileagePayment = totalMiles * mileageRate;
          
          const dateStr = `${today.getDate().toString().padStart(2, '0')}/${(today.getMonth()+1).toString().padStart(2, '0')}/${today.getFullYear()}`;
          const title = 'Daily Mileage & Performance Report';
          const body = `Daily Report for ${dateStr}:\n\n` +
            `📊 Mileage: ${totalMiles.toFixed(2)} miles\n` +
            `✅ Jobs Completed: ${jobsWithReading} (with meter reading)\n` +
            `🚫 Valid No Access: ${validNoAccessJobs}\n` +
            `⭐ Points from Jobs: ${pointsFromJobs}\n` +
            `⭐ Points from No Access: ${pointsFromNoAccess}\n` +
            `🎯 Total Points: ${totalPoints}\n` +
            `💰 Mileage Payment: £${mileagePayment.toFixed(2)}`;
          
          const Message = require('../models/message.model');
          const msg = await Message.create({ 
            recipient: req.user.id, 
            title, 
            body, 
            meta: { 
              date: dateStr, 
              totalKm, 
              totalMiles, 
              jobCount: completedToday.length,
              jobsWithReading,
              validNoAccessJobs,
              pointsFromJobs,
              pointsFromNoAccess,
              totalPoints,
              mileagePayment
            } 
          });
          global.io.to(`user_${req.user.id}`).emit('message', { type: 'new_message', message: msg });
        }
      } catch (e) {
        console.error('Auto mileage message error:', e.message);
      }
    }

    res.json({
      success: true,
      job: updatedJob,
      message: 'Job completed successfully'
    });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST /api/jobs/:id/start
// @desc    Start a job with location tracking
// @access  Private (Meter readers only)
router.post('/:id/start', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if job is assigned to current user
    if (job.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Job not assigned to you.' });
    }

    // Check if job is in pending status
    if (job.status !== 'pending') {
      return res.status(400).json({ message: 'Job is not in pending status' });
    }

    // Enforce sequential job starting - can only start jobs in order
    if (job.sequenceNumber !== null) {
      const scheduledDate = job.scheduledDate ? new Date(job.scheduledDate) : new Date();
      const startOfDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate());
      const endOfDay = new Date(scheduledDate.getFullYear(), scheduledDate.getMonth(), scheduledDate.getDate() + 1);
      
      // Find any pending job with a lower sequence number for the same scheduled date
      const earlierPendingJob = await Job.findOne({
        assignedTo: req.user._id,
        status: 'pending',
        scheduledDate: {
          $gte: startOfDay,
          $lt: endOfDay
        },
        sequenceNumber: { $lt: job.sequenceNumber, $ne: null }
      }).sort({ sequenceNumber: 1 });

      if (earlierPendingJob) {
        return res.status(400).json({ 
          message: `You cannot skip jobs in the sequence. Please start job ${earlierPendingJob.jobId || `#${earlierPendingJob.sequenceNumber}`} first before starting job ${job.jobId || `#${job.sequenceNumber}`}.`,
          nextJobId: earlierPendingJob._id,
          nextJobDisplayId: earlierPendingJob.jobId || `#${earlierPendingJob.sequenceNumber}`,
          nextSequenceNumber: earlierPendingJob.sequenceNumber,
          currentJobDisplayId: job.jobId || `#${job.sequenceNumber}`
        });
      }
    }

    const { startLocation } = req.body;

    // Update job with start location and status
    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      {
        status: 'in_progress',
        startLocation: {
          latitude: startLocation.latitude,
          longitude: startLocation.longitude,
          timestamp: new Date(startLocation.timestamp)
        }
      },
      { new: true }
    ).populate('assignedTo', 'firstName lastName username employeeId department');

    res.json({
      success: true,
      message: 'Job started successfully',
      job: updatedJob
    });
  } catch (error) {
    console.error('Start job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST /api/jobs/:id/complete
// @desc    Complete a job with location tracking and meter readings
// @access  Private (Meter readers only)
router.post('/:id/complete', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if job is assigned to current user
    if (job.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Job not assigned to you.' });
    }

    // Check if job is in progress
    if (job.status !== 'in_progress') {
      return res.status(400).json({ message: 'Job is not in progress' });
    }

    const { endLocation, distanceTraveled, locationHistory, meterReadings, photoUrls } = req.body;

    // Update job with completion data
    const updatedJob = await Job.findByIdAndUpdate(
      req.params.id,
      {
        status: 'completed',
        completedDate: new Date(),
        endLocation: {
          latitude: endLocation.latitude,
          longitude: endLocation.longitude,
          timestamp: new Date(endLocation.timestamp)
        },
        distanceTraveled: distanceTraveled || 0,
        locationHistory: locationHistory || [],
        meterReadings: meterReadings || {},
        photos: photoUrls || []
      },
      { new: true }
    ).populate('assignedTo', 'firstName lastName username employeeId department');

    res.json({
      success: true,
      message: 'Job completed successfully',
      job: updatedJob
    });
  } catch (error) {
    console.error('Complete job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST /api/jobs/:id/location
// @desc    Update job location during tracking
// @access  Private (Meter readers only)
router.post('/:id/location', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if job is assigned to current user
    if (job.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied. Job not assigned to you.' });
    }

    const { latitude, longitude, timestamp } = req.body;

    // Add location to history
    const locationUpdate = {
      latitude,
      longitude,
      timestamp: new Date(timestamp)
    };

    await Job.findByIdAndUpdate(
      req.params.id,
      {
        $push: { locationHistory: locationUpdate }
      }
    );

    res.json({
      success: true,
      message: 'Location updated successfully'
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/jobs/:id/location
// @desc    Get job location data
// @access  Private
router.get('/:id/location', protect, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // If user is meter_reader, only show their jobs
    if (req.user.role === 'meter_reader' && job.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      success: true,
      data: {
        jobId: job._id,
        startLocation: job.startLocation,
        endLocation: job.endLocation,
        distanceTraveled: job.distanceTraveled,
        locationHistory: job.locationHistory,
        status: job.status
      }
    });
  } catch (error) {
    console.error('Get job location error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   DELETE /api/jobs/:id
// @desc    Delete a job
// @access  Private (Admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const job = await Job.findByIdAndDelete(req.params.id);

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Emit WebSocket event for job deletion
    if (global.io) {
      global.io.to('admin_room').emit('jobUpdate', {
        type: 'jobDeleted',
        jobId: req.params.id,
        timestamp: new Date()
      });
    }

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   DELETE /api/jobs/bulk
// @desc    Delete multiple jobs by IDs
// @access  Private (Admin only)
router.delete('/bulk', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { jobIds } = req.body;

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      return res.status(400).json({ message: 'Job IDs array is required' });
    }

    // Validate all IDs are valid ObjectIds
    const validIds = jobIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    
    if (validIds.length === 0) {
      return res.status(400).json({ message: 'No valid job IDs provided' });
    }

    // Delete jobs
    const result = await Job.deleteMany({ _id: { $in: validIds } });

    // Emit WebSocket event for bulk job deletion
    if (global.io) {
      global.io.to('admin_room').emit('jobUpdate', {
        type: 'jobsBulkDeleted',
        count: result.deletedCount,
        jobIds: validIds,
        timestamp: new Date()
      });
    }

    res.json({ 
      success: true,
      message: `Successfully deleted ${result.deletedCount} job(s)`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Bulk delete jobs error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   DELETE /api/jobs/user/:userId
// @desc    Delete all jobs assigned to a specific user
// @access  Private (Admin only)
router.delete('/user/:userId', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Delete all jobs assigned to this user
    const result = await Job.deleteMany({ assignedTo: userId });

    // Emit WebSocket event for bulk job deletion
    if (global.io) {
      global.io.to('admin_room').emit('jobUpdate', {
        type: 'userJobsDeleted',
        userId: userId,
        count: result.deletedCount,
        timestamp: new Date()
      });

      // Also notify the user
      global.io.to(`user_${userId}`).emit('jobUpdate', {
        type: 'allJobsDeleted',
        message: 'All your jobs have been deleted by admin',
        timestamp: new Date()
      });
    }

    res.json({ 
      success: true,
      message: `Successfully deleted ${result.deletedCount} job(s) for user ${user.firstName} ${user.lastName}`,
      deletedCount: result.deletedCount,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username
      }
    });
  } catch (error) {
    console.error('Delete user jobs error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
