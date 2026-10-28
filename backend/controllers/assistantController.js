const Conversation = require('../models/Conversation');
const PendingAction = require('../models/PendingAction');
const Item = require('../models/Item');
const AutoBid = require('../models/AutoBid');
const { processAssistantChat } = require('../services/assistantService');
const { resolveProxyBids } = require('../services/proxyBidService');
const { formatINR } = require('../utils/money');

// Rate limiting: 20 messages per 10 minutes per user
const userChatRateMap = new Map();

function checkChatRateLimit(userId) {
  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  let timestamps = userChatRateMap.get(userId.toString()) || [];
  timestamps = timestamps.filter((t) => t > tenMinutesAgo);
  userChatRateMap.set(userId.toString(), timestamps);

  if (timestamps.length >= 20) {
    return false;
  }
  timestamps.push(Date.now());
  return true;
}

/**
 * Handle student chat with AI Assistant
 */
const chatWithAssistant = async (req, res) => {
  try {
    const userId = req.user._id;
    const { message } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty.',
      });
    }

    if (!checkChatRateLimit(userId)) {
      return res.status(429).json({
        success: false,
        message: 'Rate limit exceeded: you can send up to 20 messages per 10 minutes.',
      });
    }

    // Get or create conversation
    let conversation = await Conversation.findOne({ user: userId });
    if (!conversation) {
      conversation = await Conversation.create({ user: userId, messages: [] });
    }

    // Process message through AI assistant service
    const { reply, pendingAction } = await processAssistantChat(
      userId,
      conversation,
      message.trim()
    );

    // Persist messages in conversation
    conversation.messages.push({
      role: 'user',
      content: message.trim(),
      timestamp: new Date(),
    });

    conversation.messages.push({
      role: 'assistant',
      content: reply,
      pendingAction: pendingAction?.pendingActionId || null,
      timestamp: new Date(),
    });

    // Keep conversation length bounded to last 50 messages
    if (conversation.messages.length > 50) {
      conversation.messages = conversation.messages.slice(-50);
    }

    await conversation.save();

    res.json({
      success: true,
      reply,
      pendingAction,
    });
  } catch (err) {
    console.error('AI Assistant chat error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error processing assistant request.',
    });
  }
};

/**
 * Get conversation history and any active pending action
 */
const getAssistantHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const conversation = await Conversation.findOne({ user: userId }).populate({
      path: 'messages.pendingAction',
      populate: { path: 'itemId', select: 'title currentLeadingBid startingPrice status' },
    });

    // Check for any currently active pending action
    const activePendingAction = await PendingAction.findOne({
      user: userId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    })
      .populate('itemId', 'title currentLeadingBid startingPrice status')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      messages: conversation ? conversation.messages : [],
      activePendingAction,
    });
  } catch (err) {
    console.error('Error fetching assistant history:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve assistant history.',
    });
  }
};

/**
 * Confirm a pending action (Created by assistant, confirmed by student click)
 */
const confirmAction = async (req, res) => {
  try {
    const actionId = req.params.id;
    const userId = req.user._id;

    const action = await PendingAction.findById(actionId);
    if (!action) {
      return res.status(404).json({
        success: false,
        message: 'Action proposal not found.',
      });
    }

    // Rule: Must be confirmed by the same user who initiated it
    if (action.user.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to confirm this action.',
      });
    }

    // Rule: Action must not be expired
    if (new Date(action.expiresAt) <= new Date()) {
      action.status = 'expired';
      await action.save();
      return res.status(400).json({
        success: false,
        message: 'This proposed action has expired. Please ask the assistant again.',
      });
    }

    // Rule: Action cannot be confirmed twice (atomic conditional transition)
    const atomicClaim = await PendingAction.findOneAndUpdate(
      { _id: actionId, status: 'pending' },
      { $set: { status: 'confirmed' } },
      { new: true }
    );

    if (!atomicClaim) {
      return res.status(400).json({
        success: false,
        message: `Action has already been ${action.status}.`,
      });
    }

    // Re-validate item state on server
    const item = await Item.findById(action.itemId);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Auction item no longer exists.',
      });
    }

    if (item.status !== 'Active' || new Date(item.closingAt) <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot place bid: this auction has already closed.',
      });
    }

    if (item.seller.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot bid on your own listing.',
      });
    }

    // Re-validate min bid
    const minNextBidPaise = item.currentLeadingBid
      ? item.currentLeadingBid + item.minimumIncrement
      : item.startingPrice;

    if (action.maxAmount < minNextBidPaise) {
      return res.status(400).json({
        success: false,
        message: `Price increased while deciding! Minimum valid bid is now ${formatINR(minNextBidPaise)}.`,
      });
    }

    // Atomically upsert Phase 2 AutoBid
    await AutoBid.findOneAndUpdate(
      { item: action.itemId, user: userId },
      { $set: { maxAmount: action.maxAmount, active: true } },
      { upsert: true, new: true }
    );

    // Trigger proxy resolution
    await resolveProxyBids(action.itemId);

    res.json({
      success: true,
      message: `🎉 Automatic bid activated up to ₹${(action.maxAmount / 100).toLocaleString('en-IN')}!`,
      itemId: action.itemId,
    });
  } catch (err) {
    console.error('Error confirming assistant action:', err);
    res.status(500).json({
      success: false,
      message: 'Server error confirming action: ' + err.message,
    });
  }
};

/**
 * Cancel a pending action
 */
const cancelAction = async (req, res) => {
  try {
    const actionId = req.params.id;
    const userId = req.user._id;

    const action = await PendingAction.findOne({ _id: actionId, user: userId });
    if (!action) {
      return res.status(404).json({
        success: false,
        message: 'Action not found.',
      });
    }

    if (action.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `Action is already ${action.status}.`,
      });
    }

    action.status = 'cancelled';
    await action.save();

    res.json({
      success: true,
      message: 'Proposed bid cancelled.',
    });
  } catch (err) {
    console.error('Error cancelling assistant action:', err);
    res.status(500).json({
      success: false,
      message: 'Server error cancelling action.',
    });
  }
};

module.exports = {
  chatWithAssistant,
  getAssistantHistory,
  confirmAction,
  cancelAction,
};

