const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  chatWithAssistant,
  getAssistantHistory,
  confirmAction,
  cancelAction,
} = require('../controllers/assistantController');

// All assistant interactions require authentication
router.use(protect);

router.post('/chat', chatWithAssistant);
router.get('/history', getAssistantHistory);
router.post('/actions/:id/confirm', confirmAction);
router.post('/actions/:id/cancel', cancelAction);

module.exports = router;

