const express = require('express');
const router = express.Router();
const { getMyListings, getMyBids } = require('../controllers/userController');
const { getNotifications } = require('../controllers/notificationController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/me/listings', getMyListings);
router.get('/me/bids', getMyBids);
router.get('/me/notifications', getNotifications);

module.exports = router;
