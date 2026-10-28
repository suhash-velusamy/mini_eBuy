const Watch = require('../models/Watch');
const Notification = require('../models/Notification');
const { toPaise } = require('../utils/money');

/**
 * Create a new watch alert.
 * Limit: Max 10 active watches per user.
 */
const createWatch = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check active limit
    const activeCount = await Watch.countDocuments({ user: userId, active: true });
    if (activeCount >= 10) {
      return res.status(400).json({
        success: false,
        message: 'Maximum limit of 10 active search alerts reached. Please deactivate or remove an existing want.',
      });
    }

    let { keywords, category, condition, maxPrice } = req.body;

    // Normalize keywords
    if (typeof keywords === 'string') {
      keywords = keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);
    } else if (Array.isArray(keywords)) {
      keywords = keywords.map((k) => String(k).trim()).filter(Boolean);
    }

    if (!keywords || keywords.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one keyword is required for your search alert.',
      });
    }

    if (keywords.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'A maximum of 10 keywords is allowed per search alert.',
      });
    }

    let maxPricePaise = null;
    if (maxPrice !== undefined && maxPrice !== null && maxPrice !== '') {
      const num = Number(maxPrice);
      if (isNaN(num) || num <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Max price must be a positive number.',
        });
      }
      maxPricePaise = toPaise(num);
    }

    const watch = await Watch.create({
      user: userId,
      keywords,
      category: category ? category.trim() : null,
      condition: condition || null,
      maxPrice: maxPricePaise,
      active: true,
    });

    res.status(201).json({
      success: true,
      message: 'Saved want created successfully!',
      watch,
    });
  } catch (err) {
    console.error('Error creating watch:', err);
    res.status(500).json({
      success: false,
      message: 'Server error creating search alert: ' + err.message,
    });
  }
};

/**
 * Get all watches for the authenticated student.
 */
const getMyWatches = async (req, res) => {
  try {
    const watches = await Watch.find({ user: req.user._id }).sort({ createdAt: -1 });

    // Attach unread match count per watch
    const watchesWithCount = await Promise.all(
      watches.map(async (w) => {
        const unreadMatches = await Notification.countDocuments({
          recipient: req.user._id,
          watch: w._id,
          type: 'WATCH_MATCH',
          readAt: null,
        });
        const wObj = w.toObject({ virtuals: true });
        wObj.unreadMatches = unreadMatches;
        return wObj;
      })
    );

    res.json({
      success: true,
      watches: watchesWithCount,
    });
  } catch (err) {
    console.error('Error fetching watches:', err);
    res.status(500).json({
      success: false,
      message: 'Server error fetching search alerts.',
    });
  }
};

/**
 * Update a watch.
 */
const updateWatch = async (req, res) => {
  try {
    const watch = await Watch.findOne({ _id: req.params.id, user: req.user._id });
    if (!watch) {
      return res.status(404).json({
        success: false,
        message: 'Search alert not found.',
      });
    }

    const { keywords, category, condition, maxPrice, active } = req.body;

    if (keywords !== undefined) {
      let kwList = keywords;
      if (typeof keywords === 'string') {
        kwList = keywords.split(',').map((k) => k.trim()).filter(Boolean);
      } else if (Array.isArray(keywords)) {
        kwList = keywords.map((k) => String(k).trim()).filter(Boolean);
      }
      if (!kwList || kwList.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'At least one keyword is required.',
        });
      }
      watch.keywords = kwList;
    }

    if (category !== undefined) {
      watch.category = category ? category.trim() : null;
    }

    if (condition !== undefined) {
      watch.condition = condition || null;
    }

    if (maxPrice !== undefined) {
      if (maxPrice === null || maxPrice === '') {
        watch.maxPrice = null;
      } else {
        const num = Number(maxPrice);
        if (isNaN(num) || num <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Max price must be a positive number.',
          });
        }
        watch.maxPrice = toPaise(num);
      }
    }

    if (active !== undefined) {
      // If activating, check active limit
      if (active && !watch.active) {
        const activeCount = await Watch.countDocuments({ user: req.user._id, active: true });
        if (activeCount >= 10) {
          return res.status(400).json({
            success: false,
            message: 'Maximum limit of 10 active search alerts reached.',
          });
        }
      }
      watch.active = Boolean(active);
    }

    await watch.save();

    res.json({
      success: true,
      message: 'Search alert updated successfully.',
      watch: watch.toObject({ virtuals: true }),
    });
  } catch (err) {
    console.error('Error updating watch:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating search alert.',
    });
  }
};

/**
 * Delete a watch.
 */
const deleteWatch = async (req, res) => {
  try {
    const deleted = await Watch.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Search alert not found.',
      });
    }

    res.json({
      success: true,
      message: 'Search alert removed successfully.',
    });
  } catch (err) {
    console.error('Error deleting watch:', err);
    res.status(500).json({
      success: false,
      message: 'Server error deleting search alert.',
    });
  }
};

module.exports = {
  createWatch,
  getMyWatches,
  updateWatch,
  deleteWatch,
};

