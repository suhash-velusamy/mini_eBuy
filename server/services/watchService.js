const Watch = require('../models/Watch');
const Notification = require('../models/Notification');
const { emitToUser } = require('../sockets/socketManager');
const { formatINR } = require('../utils/money');

/**
 * Evaluates all active watches against an item.
 * Runs on listing creation and update.
 * Matches keywords conjunctive (case-insensitive) on title + description.
 * De-duplicates notifications per (watch, item) pair.
 */
async function evaluateWatchesForItem(item) {
  if (!item || item.status !== 'Active') return [];

  try {
    const sellerId = typeof item.seller === 'object' ? item.seller?._id : item.seller;
    const activeWatches = await Watch.find({
      active: true,
      user: { $ne: sellerId },
    }).populate('user', 'name email');

    const matchedNotifications = [];
    const searchableText = `${item.title || ''} ${item.description || ''}`.toLowerCase();
    const itemPrice = item.currentLeadingBid || item.startingPrice || 0;

    for (const watch of activeWatches) {
      // 1. Category check (if specified)
      if (watch.category && watch.category.trim() !== '') {
        if (watch.category.trim().toLowerCase() !== (item.category || '').trim().toLowerCase()) {
          continue;
        }
      }

      // 2. Condition check (if specified)
      if (watch.condition && watch.condition.trim() !== '') {
        if (watch.condition.trim().toLowerCase() !== (item.condition || '').trim().toLowerCase()) {
          continue;
        }
      }

      // 3. Max price check (if specified)
      if (typeof watch.maxPrice === 'number' && watch.maxPrice > 0) {
        if (itemPrice > watch.maxPrice) {
          continue;
        }
      }

      // 4. Keyword check: conjunctive match on title + description
      const keywords = watch.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean);
      const allMatch = keywords.every((kw) => searchableText.includes(kw));
      if (!allMatch) {
        continue;
      }

      // 5. De-duplicate: 1 notification per (watch, item)
      const deduplicationKey = `watch_${watch._id}_item_${item._id}`;
      const existing = await Notification.findOne({ deduplicationKey });
      if (existing) {
        continue;
      }

      try {
        const notif = await Notification.create({
          recipient: watch.user._id,
          type: 'WATCH_MATCH',
          message: `🎯 Saved Want Match: "${item.title}" matches your search alert! Starting at ${formatINR(item.startingPrice)}.`,
          auction: item._id,
          watch: watch._id,
          deduplicationKey,
        });

        watch.lastMatchedAt = new Date();
        await watch.save();

        // Emit live socket events
        emitToUser(watch.user._id, 'notification:new', notif);
        emitToUser(watch.user._id, 'watch:match', {
          watchId: watch._id,
          notification: notif,
          item: {
            _id: item._id,
            title: item.title,
            category: item.category,
            startingPrice: item.startingPrice,
            currentLeadingBid: item.currentLeadingBid,
            closingAt: item.closingAt,
          },
        });

        matchedNotifications.push(notif);
      } catch (err) {
        // Ignore duplicate key error in race conditions
        if (err.code !== 11000) {
          console.error('Error creating watch notification:', err.message);
        }
      }
    }

    return matchedNotifications;
  } catch (err) {
    console.error('Error in evaluateWatchesForItem:', err.message);
    return [];
  }
}

module.exports = {
  evaluateWatchesForItem,
};

