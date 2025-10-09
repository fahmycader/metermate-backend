const express = require('express');
const router = express.Router();
const MeterReading = require('../models/meterReading.model');
const Job = require('../models/job.model');
const { protect } = require('../middleware/auth');

// @route   POST /api/meter-readings
// @desc    Create a new meter reading
// @access  Private (Meter readers only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const meterReadingData = {
      ...req.body,
      meterReader: req.user.id,
    };

    const meterReading = await MeterReading.create(meterReadingData);

    // Update the job status to completed
    await Job.findByIdAndUpdate(
      meterReadingData.jobId,
      { 
        status: 'completed',
        completedDate: new Date(),
      }
    );

    // Populate the meter reading with job and user data
    const populatedReading = await MeterReading.findById(meterReading._id)
      .populate('jobId', 'jobType address house assignedTo')
      .populate('meterReader', 'firstName lastName username employeeId');

    res.status(201).json({
      success: true,
      message: 'Meter reading saved successfully',
      data: populatedReading
    });
    
    // Emit WebSocket events for meter reading creation
    if (global.io) {
      global.io.to('admin_room').emit('mileageUpdate', {
        type: 'meterReadingCreated',
        reading: populatedReading,
        timestamp: new Date()
      });
      
      global.io.to('admin_room').emit('wageUpdate', {
        type: 'wageDataChanged',
        userId: populatedReading.meterReader._id,
        timestamp: new Date()
      });
    }
  } catch (error) {
    console.error('Create meter reading error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/meter-readings
// @desc    Get meter readings for current user
// @access  Private (Meter readers only)
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const { page = 1, limit = 10, date } = req.query;
    
    let query = { meterReader: req.user.id };
    
    if (date) {
      const startOfDay = new Date(date);
      const endOfDay = new Date(date);
      endOfDay.setDate(endOfDay.getDate() + 1);
      
      query.readingDate = {
        $gte: startOfDay,
        $lt: endOfDay
      };
    }

    const meterReadings = await MeterReading.find(query)
      .populate('jobId', 'jobType address house assignedTo')
      .populate('meterReader', 'firstName lastName username employeeId')
      .sort({ readingDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MeterReading.countDocuments(query);

    res.json({
      success: true,
      data: meterReadings,
      pagination: {
        totalPages: Math.ceil(total / limit),
        currentPage: page,
        total,
      }
    });
  } catch (error) {
    console.error('Get meter readings error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/meter-readings/today
// @desc    Get today's meter readings for current user
// @access  Private (Meter readers only)
router.get('/today', protect, async (req, res) => {
  try {
    if (req.user.role !== 'meter_reader') {
      return res.status(403).json({ message: 'Access denied. Meter readers only.' });
    }

    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

    const meterReadings = await MeterReading.find({
      meterReader: req.user.id,
      readingDate: {
        $gte: startOfDay,
        $lt: endOfDay
      }
    })
      .populate('jobId', 'jobType address house assignedTo')
      .populate('meterReader', 'firstName lastName username employeeId')
      .sort({ readingDate: -1 });

    res.json({
      success: true,
      data: meterReadings,
      count: meterReadings.length,
      date: today.toISOString().split('T')[0]
    });
  } catch (error) {
    console.error('Get today\'s meter readings error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   GET /api/meter-readings/:id
// @desc    Get a single meter reading
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const meterReading = await MeterReading.findById(req.params.id)
      .populate('jobId', 'jobType address house assignedTo')
      .populate('meterReader', 'firstName lastName username employeeId');

    if (!meterReading) {
      return res.status(404).json({ message: 'Meter reading not found' });
    }

    // If user is meter_reader, only show their readings
    if (req.user.role === 'meter_reader' && meterReading.meterReader._id.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({
      success: true,
      data: meterReading
    });
  } catch (error) {
    console.error('Get meter reading error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT /api/meter-readings/:id
// @desc    Update a meter reading
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const meterReading = await MeterReading.findById(req.params.id);

    if (!meterReading) {
      return res.status(404).json({ message: 'Meter reading not found' });
    }

    // If user is meter_reader, only allow updating their own readings
    if (req.user.role === 'meter_reader' && meterReading.meterReader.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const updatedReading = await MeterReading.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    )
      .populate('jobId', 'jobType address house assignedTo')
      .populate('meterReader', 'firstName lastName username employeeId');

    res.json({
      success: true,
      message: 'Meter reading updated successfully',
      data: updatedReading
    });
  } catch (error) {
    console.error('Update meter reading error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   DELETE /api/meter-readings/:id
// @desc    Delete a meter reading
// @access  Private (Admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const meterReading = await MeterReading.findByIdAndDelete(req.params.id);

    if (!meterReading) {
      return res.status(404).json({ message: 'Meter reading not found' });
    }

    res.json({ 
      success: true,
      message: 'Meter reading deleted successfully' 
    });
  } catch (error) {
    console.error('Delete meter reading error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;
