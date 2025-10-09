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
    
    // Emit WebSocket event for job creation
    if (global.io) {
      global.io.to('admin_room').emit('jobUpdate', {
        type: 'jobCreated',
        job: populatedJob,
        timestamp: new Date()
      });
    }
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
      .populate('house', 'address postcode city county latitude longitude meterType')
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
      .populate('house', 'address postcode city county latitude longitude meterType')
      .populate('assignedTo', 'firstName lastName username employeeId department')
      .sort({ scheduledDate: 1 });

    // If user location is provided, sort by geographical distance
    if (userLatitude && userLongitude) {
      const userLat = parseFloat(userLatitude);
      const userLng = parseFloat(userLongitude);

      jobs.forEach(job => {
        if (job.house && job.house.latitude && job.house.longitude) {
          const distance = calculateDistance(
            userLat, userLng,
            job.house.latitude, job.house.longitude
          );
          job.distanceFromUser = distance;
        } else {
          job.distanceFromUser = Infinity; // Put jobs without location at the end
        }
      });

      // Sort by distance (nearest first)
      jobs.sort((a, b) => a.distanceFromUser - b.distanceFromUser);
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
      notes 
    } = req.body;

    const job = await Job.findById(req.params.id);
    
    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    // Check if user is assigned to this job or is admin
    if (job.assignedTo.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Not authorized to complete this job' });
    }

    // Calculate distance if start and end locations are provided
    let calculatedDistance = distanceTraveled || 0;
    if (startLocation && endLocation && !distanceTraveled) {
      calculatedDistance = calculateDistance(
        startLocation.latitude, startLocation.longitude,
        endLocation.latitude, endLocation.longitude
      );
    }

    const updateData = {
      status,
      completedDate: new Date(),
      ...(meterReadings && { meterReadings }),
      ...(photos && { photos }),
      ...(location && { location }),
      ...(distanceTraveled && { distanceTraveled: calculatedDistance }),
      ...(startLocation && { startLocation }),
      ...(endLocation && { endLocation }),
      ...(locationHistory && { locationHistory }),
      ...(notes && { notes })
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
