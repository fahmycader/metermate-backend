const express = require('express');
const router = express.Router();
const House = require('../models/house.model');
const { protect } = require('../middleware/auth');

// @route   GET /api/houses
// @desc    Get all houses
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    
    let query = {};
    
    if (search) {
      query = {
        $or: [
          { address: { $regex: search, $options: 'i' } },
          { postcode: { $regex: search, $options: 'i' } },
          { city: { $regex: search, $options: 'i' } },
        ],
      };
    }

    const houses = await House.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await House.countDocuments(query);

    res.json({
      houses,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total,
    });
  } catch (error) {
    console.error('Get houses error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   POST /api/houses
// @desc    Create a new house
// @access  Private (Admin only)
router.post('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const houseData = req.body;
    
    const house = await House.create(houseData);

    res.status(201).json(house);
  } catch (error) {
    console.error('Create house error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   PUT /api/houses/:id
// @desc    Update a house
// @access  Private (Admin only)
router.put('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const house = await House.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!house) {
      return res.status(404).json({ message: 'House not found' });
    }

    res.json(house);
  } catch (error) {
    console.error('Update house error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// @route   DELETE /api/houses/:id
// @desc    Delete a house
// @access  Private (Admin only)
router.delete('/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin only.' });
    }

    const house = await House.findByIdAndDelete(req.params.id);

    if (!house) {
      return res.status(404).json({ message: 'House not found' });
    }

    res.json({ message: 'House deleted successfully' });
  } catch (error) {
    console.error('Delete house error:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

module.exports = router;

