const Notification = require('../models/Notification');

/**
 * @route   GET /api/notifications
 * @desc    Get all notifications for authenticated user
 * @access  Private
 */
const getNotifications = async (req, res) => {
  try {
    const { unreadOnly } = req.query;
    const filter = { recipient: req.user._id };

    if (unreadOnly === 'true') {
      filter.readAt = null;
    }

    const notifications = await Notification.find(filter)
      .populate('auction', 'title photos status')
      .sort({ createdAt: -1 })
      .limit(50);

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      readAt: null,
    });

    res.status(200).json({
      success: true,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications.',
    });
  }
};

/**
 * @route   PATCH /api/notifications/:id/read
 * @desc    Mark a specific notification as read
 * @access  Private
 */
const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      {
        _id: req.params.id,
        recipient: req.user._id,
      },
      {
        $set: { readAt: new Date() },
      },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found.',
      });
    }

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      readAt: null,
    });

    res.status(200).json({
      success: true,
      unreadCount,
      notification,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read.',
    });
  }
};

/**
 * @route   PATCH /api/notifications/read-all
 * @desc    Mark all user notifications as read
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      {
        recipient: req.user._id,
        readAt: null,
      },
      {
        $set: { readAt: new Date() },
      }
    );

    res.status(200).json({
      success: true,
      message: 'All notifications marked as read.',
      unreadCount: 0,
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read.',
    });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
};
