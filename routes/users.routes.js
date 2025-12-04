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
    const users = await User.find({ department: 'meter' }).select('-password');

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

    // Get date range (default to last 7 days)
    const { startDate, endDate } = req.query;
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date();
    start.setDate(start.getDate() - 7); // Default to 7 days ago

    // Get all jobs assigned to this user in the date range, including location data
    const allJobs = await Job.find({
      assignedTo: userId,
      scheduledDate: {
        $gte: start,
        $lte: end
      }
    })
    .select('status startLocation endLocation location address house scheduledDate completedDate jobId sequenceNumber')
    .populate('house', 'latitude longitude address postcode city');

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

    // Calculate total distance
    const totalDistanceKm = allJobs
      .filter(j => j.status === 'completed')
      .reduce((sum, j) => sum + (j.distanceTraveled || 0), 0);
    const totalDistanceMiles = totalDistanceKm * 0.621371;

    // Calculate work hours for today
    const VehicleCheck = require('../models/vehicleCheck.model');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's vehicle check (start time)
    const todayVehicleCheck = await VehicleCheck.findOne({
      operative: userId,
      checkDate: {
        $gte: today,
        $lt: tomorrow
      }
    }).sort({ checkDate: -1 });

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
      
      if (lastCompletedJob && lastCompletedJob.completedDate) {
        endTime = lastCompletedJob.completedDate;
        const diffMs = endTime - startTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        totalHours = Math.round(diffHours * 100) / 100; // Round to 2 decimal places
      } else {
        // Shift started but no jobs completed yet
        const now = new Date();
        const diffMs = now - startTime;
        const diffHours = diffMs / (1000 * 60 * 60);
        totalHours = Math.round(diffHours * 100) / 100;
      }

      workHours = {
        startTime: startTime,
        endTime: endTime,
        totalHours: totalHours,
        isActive: !endTime // If no end time, shift is still active
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
        totalDistanceKm: Math.round(totalDistanceKm * 100) / 100,
        totalDistanceMiles: Math.round(totalDistanceMiles * 100) / 100,
      },
      dateRange: {
        start: start.toISOString().split('T')[0],
        end: end.toISOString().split('T')[0],
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
