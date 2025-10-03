const express = require('express');
const router = express.Router();
const Job = require('../models/job.model');
const House = require('../models/house.model');
const User = require('../models/user.model');
const { protect } = require('../middleware/auth');

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
      query.assignedTo = req.user.id;
    }

    const jobs = await Job.find(query)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ scheduledDate: 1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

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
    if (jobData.assignedTo) {
      const assignedUser = await User.findById(jobData.assignedTo);
      if (!assignedUser || assignedUser.department !== 'meter') {
        return res.status(400).json({ 
          message: 'Assigned user must be from meter department' 
        });
      }
    }
    
    const job = await Job.create(jobData);

    // Populate the job with house and user data
    const populatedJob = await Job.findById(job._id)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department');

    res.status(201).json(populatedJob);
  } catch (error) {
    console.error('Create job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
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
    
    let query = { assignedTo: req.user.id };
    
    if (status) {
      query.status = status;
    }
    
    if (jobType) {
      query.jobType = jobType;
    }

    if (priority) {
      query.priority = priority;
    }

    const jobs = await Job.find(query)
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ scheduledDate: 1 });

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
      assignedTo: req.user.id,
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

    const jobs = await Job.find(query)
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ scheduledDate: 1 });

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

    let query = { assignedTo: req.user.id };

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

    // Get all completed jobs with location data
    const jobs = await Job.find({
      ...dateFilter,
      status: 'completed',
      distanceTraveled: { $exists: true, $gt: 0 }
    })
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ completedDate: -1 });

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
      userData.totalDistance += job.distanceTraveled || 0;
      userData.totalJobs += 1;
      userData.completedJobs += 1;
      userData.jobs.push(job);
    });

    // Convert to array and calculate averages
    const mileageData = Array.from(userMileageMap.values()).map(data => ({
      ...data,
      averageDistancePerJob: data.completedJobs > 0 ? data.totalDistance / data.completedJobs : 0
    }));

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
  } catch (error) {
    console.error('Update job error:', error);
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

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('Delete job error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
