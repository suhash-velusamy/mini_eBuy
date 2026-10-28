const Item = require('../models/Item');
const Bid = require('../models/Bid');
const AutoBid = require('../models/AutoBid');
const Notification = require('../models/Notification');
const { emitToAuction, emitToUser } = require('../sockets/socketManager');
const { formatINR } = require('../utils/money');

/**
 * Executes a single atomic bid on an item with Phase 1 extension handling and retry logic.
 */
async function executeProxyBidStep({
  itemId,
  bidderId,
  bidderName,
  bidAmountPaise,
  isAutomatic = true,
}) {
  const MAX_RETRIES = 5;
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    attempts++;
    const item = await Item.findById(itemId).populate('seller', 'name email');
    if (!item || item.status !== 'Active') return null;

    const now = new Date();
    if (new Date(item.closingAt) <= now) return null;

    // Check minimum increment
    const minRequired = item.currentLeadingBid
      ? item.currentLeadingBid + item.minimumIncrement
      : item.startingPrice;

    if (bidAmountPaise < minRequired) return null;

    // Phase 1: Last-minute extension check (<= 30s)
    const timeRemainingMs = new Date(item.closingAt).getTime() - now.getTime();
    const shouldExtend = timeRemainingMs > 0 && timeRemainingMs <= 30000;
    const newClosingAt = shouldExtend ? new Date(now.getTime() + 60000) : item.closingAt;

    const previousLeaderId = item.currentLeadingBidder;

    const query = {
      _id: itemId,
      status: 'Active',
      closingAt: item.closingAt,
      seller: { $ne: bidderId },
      $or: [
        { currentLeadingBid: null, startingPrice: { $lte: bidAmountPaise } },
        {
          currentLeadingBid: { $ne: null, $lt: bidAmountPaise },
          $expr: {
            $gte: [bidAmountPaise, { $add: ['$currentLeadingBid', '$minimumIncrement'] }],
          },
        },
      ],
    };

    const updateDoc = {
      $set: {
        currentLeadingBid: bidAmountPaise,
        currentLeadingBidder: bidderId,
      },
      $inc: { bidCount: 1 },
    };

    if (shouldExtend) {
      updateDoc.$set.closingAt = newClosingAt;
      updateDoc.$inc.extensionCount = 1;
      if (!item.originalClosesAt) {
        updateDoc.$set.originalClosesAt = item.closingAt;
      }
    }

    const updatedAuction = await Item.findOneAndUpdate(query, updateDoc, { new: true })
      .populate('seller', 'name email')
      .populate('currentLeadingBidder', 'name');

    if (updatedAuction) {
      // Create Bid document
      const committedBid = await Bid.create({
        auction: itemId,
        bidder: bidderId,
        amount: bidAmountPaise,
        isAutomatic,
        extendedClosing: shouldExtend,
      });

      // Socket: auctionExtended
      if (shouldExtend) {
        emitToAuction(itemId, 'auctionExtended', {
          itemId,
          auctionId: itemId,
          closesAt: updatedAuction.closingAt,
          closingAt: updatedAuction.closingAt,
          extensionCount: updatedAuction.extensionCount,
        });
      }

      // Socket: newBid and bid:placed
      const bidPayload = {
        auctionId: itemId,
        itemId,
        currentLeadingBid: bidAmountPaise,
        currentLeadingBidINR: bidAmountPaise / 100,
        bidCount: updatedAuction.bidCount,
        minNextBid: bidAmountPaise + updatedAuction.minimumIncrement,
        minNextBidINR: (bidAmountPaise + updatedAuction.minimumIncrement) / 100,
        closesAt: updatedAuction.closingAt,
        closingAt: updatedAuction.closingAt,
        extensionCount: updatedAuction.extensionCount,
        extendedClosing: shouldExtend,
        newBid: {
          _id: committedBid._id,
          amount: bidAmountPaise,
          amountINR: bidAmountPaise / 100,
          createdAt: committedBid.createdAt,
          isAutomatic,
          extendedClosing: shouldExtend,
          bidder: {
            _id: bidderId,
            name: bidderName,
          },
        },
      };

      emitToAuction(itemId, 'bid:placed', bidPayload);
      emitToAuction(itemId, 'newBid', bidPayload);

      // Notify previous leader if outbid
      if (previousLeaderId && previousLeaderId.toString() !== bidderId.toString()) {
        try {
          const outbidNotif = await Notification.create({
            recipient: previousLeaderId,
            type: 'OUTBID',
            message: `You were outbid on "${updatedAuction.title}"! The leading bid is now ${formatINR(bidAmountPaise)}.`,
            auction: updatedAuction._id,
          });
          emitToUser(previousLeaderId, 'notification:new', outbidNotif);
          emitToUser(previousLeaderId, 'auction:outbid', {
            auctionId: updatedAuction._id,
            title: updatedAuction.title,
            newAmount: bidAmountPaise,
            formattedAmount: formatINR(bidAmountPaise),
          });
        } catch {
          // Non-blocking notification
        }
      }

      return { updatedAuction, committedBid, wasExtended: shouldExtend };
    }

    // Jittered backoff on conflict
    if (attempts < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 25) + 10));
    }
  }

  return null;
}

/**
 * Evaluates and resolves all active auto-bids on an item.
 * Runs after any manual bid or new/raised proxy max.
 */
async function resolveProxyBids(itemId) {
  let safetyLoopLimit = 30; // Prevents infinite recursion
  let anyBidGenerated = false;

  while (safetyLoopLimit-- > 0) {
    const item = await Item.findById(itemId);
    if (!item || item.status !== 'Active') break;
    if (new Date(item.closingAt) <= new Date()) break;

    // Fetch active AutoBids sorted by highest maxAmount, tie-break by earlier createdAt
    const activeAutoBids = await AutoBid.find({ item: itemId, active: true })
      .populate('user', 'name email')
      .sort({ maxAmount: -1, createdAt: 1 });

    if (!activeAutoBids || activeAutoBids.length === 0) break;

    const currentLeaderId = item.currentLeadingBidder
      ? item.currentLeadingBidder.toString()
      : null;
    const currentPrice = item.currentLeadingBid || 0;
    const inc = item.minimumIncrement;
    const minNextBid = currentPrice ? currentPrice + inc : item.startingPrice;

    // Case A: Only 1 active proxy bidder
    if (activeAutoBids.length === 1) {
      const topBidder = activeAutoBids[0];

      // If already leading, no action needed
      if (currentLeaderId === topBidder.user._id.toString()) {
        break;
      }

      // Check if topBidder can afford minNextBid
      if (topBidder.maxAmount < minNextBid) {
        // Exhausted
        topBidder.active = false;
        await topBidder.save();
        await notifyExhausted(topBidder, item);
        break;
      }

      // Bid minNextBid on their behalf
      const res = await executeProxyBidStep({
        itemId,
        bidderId: topBidder.user._id,
        bidderName: topBidder.user.name,
        bidAmountPaise: minNextBid,
        isAutomatic: true,
      });

      if (!res) break;
      anyBidGenerated = true;

      if (topBidder.maxAmount === minNextBid) {
        // Reached their exact max while leading
      }
      continue;
    }

    // Case B: 2 or more active proxy bidders competing
    const winner = activeAutoBids[0];
    const contender = activeAutoBids[1];

    // Check if contender's max is below minNextBid
    if (contender.maxAmount < minNextBid) {
      contender.active = false;
      await contender.save();
      await notifyExhausted(contender, item);
      continue; // Loop again to handle remaining
    }

    // Contender can bid.
    // If current leader is not contender, contender places a bid first if needed
    if (currentLeaderId !== contender.user._id.toString() && currentLeaderId !== winner.user._id.toString()) {
      const stepAmount = Math.min(contender.maxAmount, minNextBid);
      const res = await executeProxyBidStep({
        itemId,
        bidderId: contender.user._id,
        bidderName: contender.user.name,
        bidAmountPaise: stepAmount,
        isAutomatic: true,
      });
      if (!res) break;
      anyBidGenerated = true;
      continue;
    }

    // Two proxy bidders competing against each other:
    // Higher max wins. If equal maxes, winner (earlier createdAt) wins.
    if (winner.maxAmount === contender.maxAmount) {
      // Equal maxes: earlier auto-bid (winner) wins at the equal max
      const targetWinningPrice = winner.maxAmount;

      // 1. Contender bids up to their max if not already at it
      if (item.currentLeadingBid < contender.maxAmount && currentLeaderId !== contender.user._id.toString()) {
        await executeProxyBidStep({
          itemId,
          bidderId: contender.user._id,
          bidderName: contender.user.name,
          bidAmountPaise: contender.maxAmount,
          isAutomatic: true,
        });
      }

      // 2. Winner bids the equal max and wins due to earlier timestamp
      await executeProxyBidStep({
        itemId,
        bidderId: winner.user._id,
        bidderName: winner.user.name,
        bidAmountPaise: targetWinningPrice,
        isAutomatic: true,
      });

      // Contender is exhausted
      contender.active = false;
      await contender.save();
      await notifyExhausted(contender, item);
      break;
    } else {
      // Winner has strictly higher max: winner.maxAmount > contender.maxAmount
      // Winning price is min(winner.maxAmount, contender.maxAmount + inc)
      const targetWinningPrice = Math.min(winner.maxAmount, contender.maxAmount + inc);

      // If current leader is not contender, record contender's best bid
      if (currentLeaderId !== contender.user._id.toString() && item.currentLeadingBid < contender.maxAmount) {
        await executeProxyBidStep({
          itemId,
          bidderId: contender.user._id,
          bidderName: contender.user.name,
          bidAmountPaise: contender.maxAmount,
          isAutomatic: true,
        });
      }

      // Winner counters and claims the lead at targetWinningPrice
      await executeProxyBidStep({
        itemId,
        bidderId: winner.user._id,
        bidderName: winner.user.name,
        bidAmountPaise: targetWinningPrice,
        isAutomatic: true,
      });

      // Contender max was beaten -> exhaust contender
      contender.active = false;
      await contender.save();
      await notifyExhausted(contender, item);
      continue;
    }
  }

  // Broadcast updated auto-bid panel
  await emitPublicAutoBids(itemId);

  return anyBidGenerated;
}

/**
 * Notifies a user that their proxy bid max has been reached and exhausted.
 */
async function notifyExhausted(autoBid, item) {
  try {
    const formattedMax = formatINR(autoBid.maxAmount);
    const notif = await Notification.create({
      recipient: autoBid.user._id || autoBid.user,
      type: 'OUTBID',
      message: `You were outbid on "${item.title}". Your automatic maximum of ${formattedMax} was reached.`,
      auction: item._id,
    });
    emitToUser(autoBid.user._id || autoBid.user, 'notification:new', notif);
  } catch {
    // Non-blocking notification
  }
}

/**
 * Broadcasts public auto-bidders panel to the item room.
 * Displays only public fields: user displayName and maxAmount.
 */
async function emitPublicAutoBids(itemId) {
  try {
    const activeAutoBids = await AutoBid.find({ item: itemId, active: true })
      .populate('user', 'name')
      .sort({ maxAmount: -1, createdAt: 1 });

    const safeList = activeAutoBids.map((ab) => ({
      _id: ab._id,
      maxAmount: ab.maxAmount,
      maxAmountINR: ab.maxAmount / 100,
      createdAt: ab.createdAt,
      user: {
        _id: ab.user?._id,
        name: ab.user?.name || 'Anonymous Student',
      },
    }));

    emitToAuction(itemId, 'autoBidUpdated', {
      itemId,
      auctionId: itemId,
      autoBidders: safeList,
    });
  } catch (err) {
    console.error('Error emitting auto-bids:', err.message);
  }
}

module.exports = {
  resolveProxyBids,
  emitPublicAutoBids,
  executeProxyBidStep,
};
