const Question = require('../models/Question');
const Item = require('../models/Item');
const Notification = require('../models/Notification');
const { emitToAuction, emitToUser } = require('../sockets/socketManager');
const { tokenizeAndNormalize, findDuplicateQuestion } = require('../utils/textSimilarity');

// In-memory sliding window rate-limiter: max 10 questions per user per hour
const userHourlyQuestionLog = new Map();

function checkUserHourlyRateLimit(userId) {
  const oneHourAgo = Date.now() - 3600000;
  let timestamps = userHourlyQuestionLog.get(userId.toString()) || [];
  timestamps = timestamps.filter((t) => t > oneHourAgo);
  userHourlyQuestionLog.set(userId.toString(), timestamps);

  if (timestamps.length >= 10) {
    return false;
  }
  timestamps.push(Date.now());
  return true;
}

/**
 * Check for duplicate question as user types (live duplicate detection)
 */
const checkDuplicateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    if (!text || text.trim().length < 5) {
      return res.json({ success: true, duplicate: null });
    }

    const match = await findDuplicateQuestion(id, text, Question);
    if (match) {
      return res.json({
        success: true,
        duplicate: {
          text: match.matchedQuestion.text,
          answer: match.matchedQuestion.answer,
          askerName: match.matchedQuestion.asker?.name || 'Peer',
          similarity: match.similarity,
        },
      });
    }

    res.json({ success: true, duplicate: null });
  } catch (err) {
    console.error('Error checking duplicate question:', err);
    res.status(500).json({ success: false, message: 'Error checking duplicate question.' });
  }
};

/**
 * Post a new question on an auction listing
 */
const askQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;
    const userId = req.user._id;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Question text is required.',
      });
    }

    const trimmedText = text.trim();
    if (trimmedText.length < 10 || trimmedText.length > 300) {
      return res.status(400).json({
        success: false,
        message: 'Question must be between 10 and 300 characters.',
      });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Auction item not found.',
      });
    }

    // Rule: Seller cannot ask on own item
    if (item.seller.toString() === userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot ask questions on your own auction listing.',
      });
    }

    // Rule: No questions after auction closes
    const now = new Date();
    if (item.status !== 'Active' || new Date(item.closingAt) <= now) {
      return res.status(400).json({
        success: false,
        message: 'Questions are closed because this auction has ended.',
      });
    }

    // Rule: Max 3 questions per user per item
    const userQuestionCount = await Question.countDocuments({
      item: id,
      asker: userId,
    });
    if (userQuestionCount >= 3) {
      return res.status(400).json({
        success: false,
        message: 'You have reached the maximum limit of 3 questions on this listing.',
      });
    }

    // Rule: Rate limit 10 questions per user per hour
    if (!checkUserHourlyRateLimit(userId)) {
      return res.status(429).json({
        success: false,
        message: 'Hourly limit exceeded. You can post up to 10 questions per hour.',
      });
    }

    // Rule: Duplicate detection (token Jaccard >= 0.7)
    const duplicate = await findDuplicateQuestion(id, trimmedText, Question);
    if (duplicate) {
      return res.status(409).json({
        success: false,
        isDuplicate: true,
        message: 'Someone already asked a similar question.',
        existingQuestion: {
          _id: duplicate.matchedQuestion._id,
          text: duplicate.matchedQuestion.text,
          answer: duplicate.matchedQuestion.answer,
          askerName: duplicate.matchedQuestion.asker?.name || 'Peer',
          similarity: duplicate.similarity,
        },
      });
    }

    const tokens = tokenizeAndNormalize(trimmedText);
    const newQuestion = await Question.create({
      item: id,
      asker: userId,
      text: trimmedText,
      normalizedText: tokens.join(' '),
      status: 'visible',
    });

    const populatedQuestion = await Question.findById(newQuestion._id).populate(
      'asker',
      'name'
    );

    // Notify seller
    try {
      const notif = await Notification.create({
        recipient: item.seller,
        type: 'NEW_QUESTION',
        message: `💬 New question on "${item.title}": "${trimmedText.substring(0, 80)}..."`,
        auction: item._id,
      });
      emitToUser(item.seller, 'notification:new', notif);
    } catch (err) {
      console.error('Error notifying seller of question:', err.message);
    }

    // Broadcast live to room
    emitToAuction(id, 'qaUpdated', { itemId: id });

    res.status(201).json({
      success: true,
      message: 'Your question has been posted to the seller!',
      question: populatedQuestion,
    });
  } catch (err) {
    console.error('Error asking question:', err);
    res.status(500).json({
      success: false,
      message: 'Server error posting question: ' + err.message,
    });
  }
};

/**
 * Get all questions for an auction
 */
const getAuctionQuestions = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.user?._id ? req.user._id.toString() : null;

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Auction item not found.',
      });
    }

    const isSeller = currentUserId && item.seller.toString() === currentUserId;

    // Filter query: Sellers see all statuses; others see visible (or their own flagged questions)
    let filter = { item: id };
    if (!isSeller) {
      if (currentUserId) {
        filter = {
          item: id,
          $or: [{ status: 'visible' }, { asker: currentUserId }],
        };
      } else {
        filter = { item: id, status: 'visible' };
      }
    }

    const questions = await Question.find(filter)
      .populate('asker', 'name')
      .sort({ createdAt: -1 });

    // Partition: Answered on top (pinned), then unanswered newest
    const answered = [];
    const unanswered = [];

    for (const q of questions) {
      const qObj = q.toObject({ virtuals: true });
      // Sanitize asker to displayName only (privacy rule)
      qObj.asker = {
        _id: q.asker?._id,
        name: q.asker?.name || 'Anonymous Student',
      };
      if (q.answer) {
        answered.push(qObj);
      } else {
        unanswered.push(qObj);
      }
    }

    // Sort answered by answeredAt descending, unanswered by createdAt descending
    answered.sort((a, b) => new Date(b.answeredAt || b.updatedAt) - new Date(a.answeredAt || a.updatedAt));
    unanswered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const sortedQuestions = [...answered, ...unanswered];

    res.json({
      success: true,
      questions: sortedQuestions,
      unansweredCount: unanswered.length,
      totalCount: sortedQuestions.length,
      isSeller,
    });
  } catch (err) {
    console.error('Error fetching questions:', err);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving questions.',
    });
  }
};

/**
 * Answer a question (Seller only)
 */
const answerQuestion = async (req, res) => {
  try {
    const { id, qId } = req.params;
    const { answer } = req.body;
    const userId = req.user._id;

    if (!answer || typeof answer !== 'string' || answer.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Answer text cannot be empty.',
      });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Auction item not found.',
      });
    }

    // Rule: Seller only can answer
    if (item.seller.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller can answer questions for this listing.',
      });
    }

    const question = await Question.findOne({ _id: qId, item: id });
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.',
      });
    }

    question.answer = answer.trim();
    question.answeredAt = new Date();
    await question.save();

    // Notify asker
    try {
      const notif = await Notification.create({
        recipient: question.asker,
        type: 'QUESTION_ANSWERED',
        message: `📢 The seller answered your question on "${item.title}": "${answer.trim().substring(0, 80)}..."`,
        auction: item._id,
      });
      emitToUser(question.asker, 'notification:new', notif);
    } catch (err) {
      console.error('Error notifying asker of answer:', err.message);
    }

    // Broadcast live update
    emitToAuction(id, 'qaUpdated', { itemId: id });

    res.json({
      success: true,
      message: 'Answer posted successfully!',
      question,
    });
  } catch (err) {
    console.error('Error answering question:', err);
    res.status(500).json({
      success: false,
      message: 'Server error answering question: ' + err.message,
    });
  }
};

/**
 * Flag a question. 3 flags auto-hide it.
 */
const flagQuestion = async (req, res) => {
  try {
    const { id, qId } = req.params;
    const userId = req.user._id;

    const question = await Question.findOne({ _id: qId, item: id });
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.',
      });
    }

    // Prevent duplicate flags by same user
    const hasFlagged = question.flaggedBy.some((u) => u.toString() === userId.toString());
    if (hasFlagged) {
      return res.status(400).json({
        success: false,
        message: 'You have already flagged this question.',
      });
    }

    question.flaggedBy.push(userId);
    question.flagCount = question.flaggedBy.length;

    // Auto-hide on 3 flags
    if (question.flagCount >= 3) {
      question.status = 'hidden';
    }

    await question.save();

    emitToAuction(id, 'qaUpdated', { itemId: id });

    res.json({
      success: true,
      message: question.status === 'hidden'
        ? 'Question received multiple flags and has been hidden pending review.'
        : 'Question has been flagged for review.',
      question,
    });
  } catch (err) {
    console.error('Error flagging question:', err);
    res.status(500).json({
      success: false,
      message: 'Server error flagging question.',
    });
  }
};

/**
 * Hide or restore question (Seller only)
 */
const updateQuestionStatus = async (req, res) => {
  try {
    const { id, qId } = req.params;
    const { status } = req.body;
    const userId = req.user._id;

    if (!['visible', 'hidden'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be visible or hidden.',
      });
    }

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Auction item not found.',
      });
    }

    // Only seller can hide or restore
    if (item.seller.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller can change question visibility.',
      });
    }

    const question = await Question.findOne({ _id: qId, item: id });
    if (!question) {
      return res.status(404).json({
        success: false,
        message: 'Question not found.',
      });
    }

    question.status = status;
    await question.save();

    emitToAuction(id, 'qaUpdated', { itemId: id });

    res.json({
      success: true,
      message: `Question is now ${status}.`,
      question,
    });
  } catch (err) {
    console.error('Error updating question status:', err);
    res.status(500).json({
      success: false,
      message: 'Server error updating question status.',
    });
  }
};

module.exports = {
  checkDuplicateQuestion,
  askQuestion,
  getAuctionQuestions,
  answerQuestion,
  flagQuestion,
  updateQuestionStatus,
};

