const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
  createWatch,
  getMyWatches,
  updateWatch,
  deleteWatch,
} = require('../controllers/watchController');

// All watch endpoints require authentication
router.use(protect);

router.post('/', createWatch);
router.get('/', getMyWatches);
router.put('/:id', updateWatch);
router.delete('/:id', deleteWatch);

module.exports = router;
