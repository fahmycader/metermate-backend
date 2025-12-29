const express = require('express');
const router = express.Router();
const User = require('../models/user.model');
const { protect } = require('../middleware/auth');

// @route   GET /api/users
// @desc    Get all users
// @access  Private (All authenticated users)
router.get('/', protect, async (req, res) => {
  try {
    const { role, department } = req.query;
    
    let query = {};
    if (role) {
      query.role = role;
    }
    if (department) {
      query.department = department;
    }

    const users = await User.find(query).select('-password');

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/users/meter
// @desc    Get all meter department users
// @access  Private (All authenticated users)
router.get('/meter', protect, async (req, res) => {
  try {
    console.log('GET /api/users/meter - Request received');
    const users = await User.find({ department: 'meter' }).select('-password');
    console.log(`GET /api/users/meter - Found ${users.length} meter users`);

    res.json({ 
      users,
      count: users.length,
      department: 'meter'
    });
  } catch (error) {
    console.error('Get meter users error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST /api/users
// @desc    Create a new user
// @access  Private (Admin only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const userData = req.body;
    
    const user = await User.create(userData);

    res.status(201).json({
      _id: user._id,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      employeeId: user.employeeId,
      department: user.department,
      role: user.role,
      isActive: user.isActive,
      jobsCompleted: user.jobsCompleted,
      weeklyPerformance: user.weeklyPerformance,
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT /api/users/:id
// @desc    Update a user
// @access  Private (Admin only)
router.put('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   DELETE /api/users/:id
// @desc    Delete a user
// @access  Private (Admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/users/:id/progress
// @desc    Get progress statistics for a specific operative
// @access  Private (Admin only)
router.get('/:id/progress', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const Job = require('../models/job.model');
    const userId = req.params.id;

    // Get user details
    const user = await User.findById(userId).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Get date range (default to all time, or use provided dates)
    const { startDate, endDate } = req.query;
    
    // Build date filter - if dates provided, use them; otherwise get all jobs
    let dateFilter = {};
    if (startDate || endDate) {
      dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Start of day
        dateFilter.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); // End of day
        dateFilter.$lte = end;
      }
    }
    // If no dates provided, don't filter by date (get all jobs)

    // Get all jobs assigned to this user, optionally filtered by date range
    const query = {
      assignedTo: userId
    };
    
    if (Object.keys(dateFilter).length > 0) {
      query.scheduledDate = dateFilter;
    }

    console.log('Progress query:', JSON.stringify(query, null, 2));
    console.log('Date filter:', dateFilter);
    console.log('User ID:', userId);

    const allJobs = await Job.find(query)
    .select('status startLocation endLocation location address house scheduledDate completedDate jobId sequenceNumber')
    .populate('house', 'latitude longitude address postcode city');

    console.log(`Found ${allJobs.length} jobs for user ${userId}`);
    console.log('Jobs by status:', {
      total: allJobs.length,
      completed: allJobs.filter(j => j.status === 'completed').length,
      pending: allJobs.filter(j => j.status === 'pending').length,
      in_progress: allJobs.filter(j => j.status === 'in_progress').length,
      cancelled: allJobs.filter(j => j.status === 'cancelled').length,
    });

    // Calculate statistics
    const totalJobs = allJobs.length;
    const completedJobs = allJobs.filter(j => j.status === 'completed').length;
    const pendingJobs = allJobs.filter(j => j.status === 'pending').length;
    const inProgressJobs = allJobs.filter(j => j.status === 'in_progress').length;
    const cancelledJobs = allJobs.filter(j => j.status === 'cancelled').length;

    // Calculate completion percentage
    const completionPercentage = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

    // Calculate jobs with meter readings
    const jobsWithReading = allJobs.filter(j => {
      if (j.status !== 'completed') return false;
      if (j.meterReadings) {
        const electric = j.meterReadings.electric;
        const gas = j.meterReadings.gas;
        const water = j.meterReadings.water;
        if ((electric != null && electric !== '' && electric !== undefined) ||
            (gas != null && gas !== '' && gas !== undefined) ||
            (water != null && water !== '' && water !== undefined)) {
          return true;
        }
      }
      if (j.registerValues && Array.isArray(j.registerValues) && j.registerValues.length > 0) {
        return true;
      }
      return false;
    }).length;

    // Calculate valid no access jobs
    const validNoAccessJobs = allJobs.filter(j => j.status === 'completed' && j.validNoAccess === true).length;

    // Calculate total points
    const totalPoints = allJobs
      .filter(j => j.status === 'completed')
      .reduce((sum, j) => sum + (j.points || 0), 0);

    // Calculate total distance (already in miles)
    const totalDistanceMiles = allJobs
      .filter(j => j.status === 'completed')
      .reduce((sum, j) => sum + (j.distanceTraveled || 0), 0);

    // Calculate work hours for today
    const VehicleCheck = require('../models/vehicleCheck.model');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's vehicle check (start time and end time)
    const todayVehicleCheck = await VehicleCheck.findOne({
      operative: userId,
      checkDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).sort({ checkDate: -1 }).select('shiftStartTime shiftEndTime checkDate');

    // Get last completed job for today (end time)
    const lastCompletedJob = await Job.findOne({
      assignedTo: userId,
      status: 'completed',
      completedDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).sort({ completedDate: -1 });

    // Calculate work hours
    let workHours = null;
    let startTime = null;
    let endTime = null;
    let totalHours = null;

    if (todayVehicleCheck && todayVehicleCheck.shiftStartTime) {
      startTime = todayVehicleCheck.shiftStartTime;
      
      // Use shiftEndTime from vehicle check if available (8 hours from start)
      if (todayVehicleCheck.shiftEndTime) {
        endTime = todayVehicleCheck.shiftEndTime;
        const diffMs = endTime - startTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        totalHours = Math.round(diffHours * 100) / 100; // Round to 2 decimal places
      } else if (lastCompletedJob && lastCompletedJob.completedDate) {
        // Fallback to last completed job if shift end time not set
        endTime = lastCompletedJob.completedDate;
        const diffMs = endTime - startTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        totalHours = Math.round(diffHours * 100) / 100; // Round to 2 decimal places
      } else {
        // Shift started but no jobs completed yet - calculate from current time
        const now = new Date();
        const diffMs = now - startTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        totalHours = Math.round(diffHours * 100) / 100;
      }

      workHours = {
        startTime: startTime,
        endTime: endTime,
        totalHours: totalHours,
        isActive: !endTime || (endTime && new Date() < endTime), // Active if no end time or current time is before end time
        shiftEndTime: todayVehicleCheck.shiftEndTime // Include shift end time (8 hours from start)
      };
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        email: user.email,
        phone: user.phone,
        currentLocation: user.currentLocation || null,
      },
      statistics: {
        totalJobs,
        completedJobs,
        pendingJobs,
        inProgressJobs,
        cancelledJobs,
        completionPercentage: Math.round(completionPercentage * 100) / 100,
        jobsWithReading,
        validNoAccessJobs,
        totalPoints,
        totalDistanceMiles: Math.round(totalDistanceMiles * 100) / 100,
      },
      dateRange: {
        start: startDate ? new Date(startDate).toISOString().split('T')[0] : null,
        end: endDate ? new Date(endDate).toISOString().split('T')[0] : null,
      },
      workHours: workHours, // Today's work hours (start time, end time, total hours)
      // Include job locations for map visualization
      jobLocations: allJobs.map(job => ({
        jobId: job.jobId || job._id.toString(),
        sequenceNumber: job.sequenceNumber,
        status: job.status,
        scheduledDate: job.scheduledDate,
        completedDate: job.completedDate,
        // Job address location (try multiple sources)
        jobLocation: (() => {
          if (job.address?.latitude && job.address?.longitude) {
            return {
              latitude: job.address.latitude,
              longitude: job.address.longitude,
              source: 'address'
            };
          }
          if (job.house && typeof job.house === 'object' && job.house.latitude && job.house.longitude) {
            return {
              latitude: job.house.latitude,
              longitude: job.house.longitude,
              source: 'house'
            };
          }
          if (job.location?.latitude && job.location?.longitude) {
            return {
              latitude: job.location.latitude,
              longitude: job.location.longitude,
              source: 'location'
            };
          }
          return null;
        })(),
        // Start location
        startLocation: job.startLocation ? {
          latitude: job.startLocation.latitude,
          longitude: job.startLocation.longitude,
          timestamp: job.startLocation.timestamp
        } : null,
        // End/completion location
        endLocation: job.endLocation ? {
          latitude: job.endLocation.latitude,
          longitude: job.endLocation.longitude,
          timestamp: job.endLocation.timestamp
        } : null,
      })).filter(j => j.jobLocation || j.startLocation || j.endLocation) // Only include jobs with location data
    });
  } catch (error) {
    console.error('Get user progress error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT /api/users/me/location
// @desc    Update current location of the logged-in user
// @access  Private
router.put('/me/location', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    const { latitude, longitude, accuracy } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        currentLocation: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          timestamp: new Date(),
          accuracy: accuracy ? parseFloat(accuracy) : null,
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Emit WebSocket event for real-time location updates
    if (global.io) {
      global.io.to('admin_room').emit('operativeLocationUpdate', {
        type: 'location_updated',
        userId: user._id,
        location: user.currentLocation,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          employeeId: user.employeeId,
        }
      });
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      location: user.currentLocation
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT /api/users/:id/location
// @desc    Update current location of an operative (admin can update any)
// @access  Private (Admin only)
router.put('/:id/location', protect, async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Only admin can update other users' locations
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const { latitude, longitude, accuracy } = req.body;

    if (latitude == null || longitude == null) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      {
        currentLocation: {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
          timestamp: new Date(),
          accuracy: accuracy ? parseFloat(accuracy) : null,
        }
      },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Emit WebSocket event for real-time location updates
    if (global.io) {
      global.io.to('admin_room').emit('operativeLocationUpdate', {
        type: 'location_updated',
        userId: user._id,
        location: user.currentLocation,
        user: {
          _id: user._id,
          firstName: user.firstName,
          lastName: user.lastName,
          employeeId: user.employeeId,
        }
      });
    }

    res.json({
      success: true,
      message: 'Location updated successfully',
      location: user.currentLocation
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/users/:id/location
// @desc    Get current location of an operative
// @access  Private (Admin only)
router.get('/:id/location', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const user = await User.findById(req.params.id).select('currentLocation firstName lastName employeeId');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        employeeId: user.employeeId,
        currentLocation: user.currentLocation || null,
      }
    });
  } catch (error) {
    console.error('Get location error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
