const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createWatch,
  getMyWatches,
  updateWatch,
  deleteWatch,
} = require('../controllers/watchController');

// All watch endpoints require authentication
router.use(requireAuth);

router.post('/', createWatch);
router.get('/', getMyWatches);
router.put('/:id', updateWatch);
router.delete('/:id', deleteWatch);

module.exports = router;
