const cron = require('node-cron');
const Item = require('../models/Item');
const Notification = require('../models/Notification');
const { emitToAuction, emitToUser } = require('../sockets/socketManager');
const { formatINR } = require('../utils/money');

/**
 * Atomically check and close expired active auctions
 */
const closeExpiredAuctions = async () => {
  try {
    const now = new Date();

    // Query active auctions that have passed their closing time
    const expiredAuctions = await Item.find({
      status: 'Active',
      closingAt: { $lte: now },
    });

    if (!expiredAuctions || expiredAuctions.length === 0) {
      return 0;
    }

    let closedCount = 0;

    for (const item of expiredAuctions) {
      const hasBids = item.bidCount > 0 && item.currentLeadingBid;

      const updateData = hasBids
        ? {
            status: 'Pending Approval',
            provisionalWinner: item.currentLeadingBidder,
            winningAmount: item.currentLeadingBid,
          }
        : {
            status: 'Unsold',
            outcomeReason: 'Auction ended without any accepted bids',
          };

      // Atomic conditional update ensures idempotency
      const closedItem = await Item.findOneAndUpdate(
        {
          _id: item._id,
          status: 'Active', // Concurrency guard
        },
        {
          $set: updateData,
        },
        { new: true }
      ).populate('seller', 'name email').populate('provisionalWinner', 'name email');

      if (!closedItem) {
        // Another worker or process already claimed this item
        continue;
      }

      closedCount++;
      const formattedAmount = closedItem.winningAmount
        ? formatINR(closedItem.winningAmount)
        : '';

      if (hasBids && closedItem.provisionalWinner) {
        // 1. Notify Seller
        try {
          const sellerNotif = await Notification.create({
            recipient: closedItem.seller._id,
            type: 'SELLER_APPROVAL_REQUIRED',
            message: `Auction closed for "${closedItem.title}"! Provisional winning bid of ${formattedAmount} is pending your approval.`,
            auction: closedItem._id,
            deduplicationKey: `close_approval_${closedItem._id}`,
          });
          emitToUser(closedItem.seller._id, 'notification:new', sellerNotif);
        } catch (err) {
          // Deduplication key caught duplicate
        }

        // 2. Notify Provisional Winner
        try {
          const winnerNotif = await Notification.create({
            recipient: closedItem.provisionalWinner._id,
            type: 'PROVISIONAL_WIN',
            message: `Congratulations! You are the provisional winner of "${closedItem.title}" at ${formattedAmount}. Waiting for seller approval.`,
            auction: closedItem._id,
            deduplicationKey: `close_winner_${closedItem._id}`,
          });
          emitToUser(closedItem.provisionalWinner._id, 'notification:new', winnerNotif);
        } catch (err) {
          // Deduplication key caught duplicate
        }
      } else {
        // Notify Seller of Unsold outcome
        try {
          const unsoldNotif = await Notification.create({
            recipient: closedItem.seller._id,
            type: 'AUCTION_UNSOLD',
            message: `Your auction for "${closedItem.title}" closed without any bids and is marked Unsold.`,
            auction: closedItem._id,
            deduplicationKey: `close_unsold_${closedItem._id}`,
          });
          emitToUser(closedItem.seller._id, 'notification:new', unsoldNotif);
        } catch (err) {
          // Ignore duplicate
        }
      }

      // Broadcast final status to public auction room
      emitToAuction(closedItem._id, 'auction:status_changed', {
        auctionId: closedItem._id,
        status: closedItem.status,
        winningAmount: closedItem.winningAmount,
        provisionalWinner: closedItem.provisionalWinner ? {
          _id: closedItem.provisionalWinner._id,
          name: closedItem.provisionalWinner.name,
        } : null,
      });
    }

    if (closedCount > 0) {
      console.log(`[Auction Service] Closed ${closedCount} expired auction(s).`);
    }

    return closedCount;
  } catch (error) {
    console.error(`[Auction Service Error]: ${error.message}`);
    return 0;
  }
};

/**
 * Initialize automatic auction closing scheduler
 */
const initAuctionScheduler = () => {
  // 1. Run immediate check on server startup
  console.log('[Auction Service] Performing startup expired auctions check...');
  closeExpiredAuctions();

  // 2. Run every 10 seconds
  const task = cron.schedule('*/10 * * * * *', async () => {
    await closeExpiredAuctions();
  });

  console.log('[Auction Service] Cron job registered: checking expired auctions every 10 seconds.');
  return task;
};

module.exports = {
  closeExpiredAuctions,
  initAuctionScheduler,
};
