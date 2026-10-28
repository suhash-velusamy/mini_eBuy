const Item = require('../models/Item');
const Bid = require('../models/Bid');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { toPaise, formatINR } = require('../utils/money');
const { emitToAuction, emitToUser } = require('../sockets/socketManager');

/**
 * @route   GET /api/auctions/categories
 * @desc    Get dynamic categories and active counts from database
 * @access  Public
 */
const getCategories = async (req, res) => {
  try {
    const defaultCategories = [
      'Textbooks & Study Material',
      'Electronics & Gadgets',
      'Bicycles & Mobility',
      'Lab Equipment',
      'Hostel Essentials',
      'Sports & Fitness',
      'Other',
    ];
    const dbCategories = await Item.distinct('category');
    const combined = Array.from(new Set([...defaultCategories, ...dbCategories])).filter(Boolean);

    // Get item counts per category for active listings
    const categoryCounts = await Item.aggregate([
      { $match: { status: 'Active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    categoryCounts.forEach((c) => {
      countMap[c._id] = c.count;
    });

    const result = combined.map((name) => ({
      name,
      activeCount: countMap[name] || 0,
    }));

    res.status(200).json({
      success: true,
      categories: combined,
      categoryDetails: result,
    });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
};

/**
 * @route   GET /api/auctions/stats
 * @desc    Get live platform metrics dynamically from database
 * @access  Public
 */
const getAuctionStats = async (req, res) => {
  try {
    const [totalActive, totalBids, totalSold, totalUsers] = await Promise.all([
      Item.countDocuments({ status: 'Active' }),
      Bid.countDocuments({}),
      Item.countDocuments({ status: 'Sold' }),
      User.countDocuments({}),
    ]);

    const soldVolumeAgg = await Item.aggregate([
      { $match: { status: 'Sold', winningAmount: { $ne: null } } },
      { $group: { _id: null, totalPaise: { $sum: '$winningAmount' } } },
    ]);

    const totalVolumePaise = soldVolumeAgg[0]?.totalPaise || 0;

    res.status(200).json({
      success: true,
      stats: {
        activeAuctions: totalActive,
        totalBids: totalBids,
        completedHandovers: totalSold,
        verifiedStudents: totalUsers,
        totalSalesVolumeINR: totalVolumePaise / 100,
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch platform stats.' });
  }
};

/**
 * @route   GET /api/auctions
 * @desc    Browse, search, and filter auctions
 * @access  Public
 */
const getAuctions = async (req, res) => {
  try {
    const {
      search,
      category,
      condition,
      minPrice,
      maxPrice,
      status,
      closingSoon,
      sort,
      page = 1,
      limit = 12,
    } = req.query;

    const query = {};

    // 1. Status Filter
    if (status && status !== 'all') {
      query.status = status;
    } else if (!status) {
      // Default to Active auctions for browsing
      query.status = 'Active';
    }

    // 2. Keyword Search (title or description)
    if (search && search.trim() !== '') {
      query.$or = [
        { title: { $regex: search.trim(), $options: 'i' } },
        { description: { $regex: search.trim(), $options: 'i' } },
      ];
    }

    // 3. Category Filter
    if (category && category !== 'All') {
      query.category = category;
    }

    // 4. Condition Filter
    if (condition && condition !== 'All') {
      query.condition = condition;
    }

    // 5. Price Filter (in INR -> convert to paise)
    if (minPrice || maxPrice) {
      const minPaise = minPrice ? toPaise(minPrice) : 0;
      const maxPaise = maxPrice ? toPaise(maxPrice) : Infinity;

      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          // If no current bid, compare startingPrice
          {
            currentLeadingBid: null,
            startingPrice: {
              ...(minPrice ? { $gte: minPaise } : {}),
              ...(maxPrice ? { $lte: maxPaise } : {}),
            },
          },
          // If current bid exists, compare currentLeadingBid
          {
            currentLeadingBid: {
              ...(minPrice ? { $gte: minPaise } : {}),
              ...(maxPrice ? { $lte: maxPaise } : {}),
            },
          },
        ],
      });
    }

    // 6. Closing soon (closing within next 24 hours and still active)
    if (closingSoon === 'true') {
      const now = new Date();
      const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      query.closingAt = { $gte: now, $lte: next24h };
      query.status = 'Active';
    }

    // 7. Sorting
    let sortOptions = { createdAt: -1 }; // default newest
    if (sort === 'price_asc') {
      sortOptions = { currentLeadingBid: 1, startingPrice: 1 };
    } else if (sort === 'price_desc') {
      sortOptions = { currentLeadingBid: -1, startingPrice: -1 };
    } else if (sort === 'closing_soon') {
      sortOptions = { closingAt: 1 };
    } else if (sort === 'bids_desc') {
      sortOptions = { bidCount: -1 };
    } else if (sort === 'newest') {
      sortOptions = { createdAt: -1 };
    }

    // 8. Pagination
    const pageNum = Math.max(1, parseInt(page, 10));
    const pageSize = Math.max(1, Math.min(50, parseInt(limit, 10)));
    const skip = (pageNum - 1) * pageSize;

    const total = await Item.countDocuments(query);
    const items = await Item.find(query)
      .populate('seller', 'name email profilePhoto')
      .populate('provisionalWinner', 'name email')
      .sort(sortOptions)
      .skip(skip)
      .limit(pageSize);

    res.status(200).json({
      success: true,
      count: items.length,
      total,
      page: pageNum,
      totalPages: Math.ceil(total / pageSize) || 1,
      items,
    });
  } catch (error) {
    console.error('Error fetching auctions:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch auctions.',
    });
  }
};

/**
 * @route   POST /api/auctions
 * @desc    Create a new auction listing
 * @access  Private (Authenticated users only)
 */
const createAuction = async (req, res) => {
  try {
    const {
      title,
      category,
      description,
      condition,
      startingPrice,
      minimumIncrement,
      closingAt,
    } = req.body;

    if (!title || !category || !description || !condition || !startingPrice || !closingAt) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields.',
      });
    }

    // Process uploaded photos
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please upload at least one photo of the item.',
      });
    }

    const photoPaths = req.files.map((file) => `/uploads/${file.filename}`);

    // Validate closing date
    const closingDate = new Date(closingAt);
    const now = new Date();
    if (isNaN(closingDate.getTime()) || closingDate <= new Date(now.getTime() + 60 * 1000)) {
      return res.status(400).json({
        success: false,
        message: 'Auction closing time must be at least 1 minute in the future.',
      });
    }

    // Validate pricing
    const startingPricePaise = toPaise(startingPrice);
    if (startingPricePaise < 100) {
      return res.status(400).json({
        success: false,
        message: 'Starting price must be at least ₹1.',
      });
    }

    const minIncrementPaise = minimumIncrement
      ? toPaise(minimumIncrement)
      : Math.max(100, Math.round(startingPricePaise * 0.05)); // Default 5% or min ₹1

    const newItem = await Item.create({
      seller: req.user._id,
      title: title.trim(),
      category: category.trim(),
      description: description.trim(),
      condition,
      photos: photoPaths,
      startingPrice: startingPricePaise,
      minimumIncrement: minIncrementPaise,
      closingAt: closingDate,
      status: 'Active',
    });

    const populatedItem = await Item.findById(newItem._id).populate(
      'seller',
      'name email profilePhoto'
    );

    res.status(201).json({
      success: true,
      message: 'Auction listing created successfully.',
      auction: populatedItem,
    });
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to create auction listing.',
    });
  }
};

/**
 * @route   GET /api/auctions/:id
 * @desc    Get detailed information for a single auction
 * @access  Public
 */
const getAuctionById = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .populate('seller', 'name email profilePhoto createdAt')
      .populate('provisionalWinner', 'name email profilePhoto');

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Auction listing not found.',
      });
    }

    res.status(200).json({
      success: true,
      auction: item,
    });
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve auction details.',
    });
  }
};

/**
 * @route   PATCH /api/auctions/:id
 * @desc    Edit auction details (Only while Active and 0 bids)
 * @access  Private (Seller only)
 */
const updateAuction = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found.',
      });
    }

    if (item.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to edit this listing.',
      });
    }

    if (item.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: 'Only active auctions can be edited.',
      });
    }

    if (item.bidCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Auction cannot be edited once bidding has started.',
      });
    }

    const { title, description, category, condition, startingPrice, minimumIncrement, closingAt } = req.body;

    if (title) item.title = title.trim();
    if (description) item.description = description.trim();
    if (category) item.category = category.trim();
    if (condition) item.condition = condition;
    if (startingPrice) item.startingPrice = toPaise(startingPrice);
    if (minimumIncrement) item.minimumIncrement = toPaise(minimumIncrement);
    if (closingAt) {
      const newClose = new Date(closingAt);
      if (newClose > new Date()) {
        item.closingAt = newClose;
      }
    }

    await item.save();

    res.status(200).json({
      success: true,
      message: 'Auction listing updated successfully.',
      auction: item,
    });
  } catch (error) {
    console.error('Update auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update auction.',
    });
  }
};

/**
 * @route   POST /api/auctions/:id/cancel
 * @desc    Cancel an active listing
 * @access  Private (Seller only)
 */
const cancelAuction = async (req, res) => {
  try {
    const { reason } = req.body;
    const item = await Item.findById(req.params.id);

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found.',
      });
    }

    if (item.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the seller can cancel this auction.',
      });
    }

    if (item.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an auction with status "${item.status}".`,
      });
    }

    item.status = 'Cancelled';
    item.cancellationReason = reason ? reason.trim() : 'Cancelled by seller';
    await item.save();

    // Broadcast status change
    emitToAuction(item._id, 'auction:status_changed', {
      auctionId: item._id,
      status: 'Cancelled',
      reason: item.cancellationReason,
    });

    // Notify current leading bidder if any
    if (item.currentLeadingBidder) {
      const notif = await Notification.create({
        recipient: item.currentLeadingBidder,
        type: 'LISTING_CANCELLED',
        message: `The auction for "${item.title}" was cancelled by the seller.`,
        auction: item._id,
      });
      emitToUser(item.currentLeadingBidder, 'notification:new', notif);
    }

    res.status(200).json({
      success: true,
      message: 'Auction has been cancelled successfully.',
      auction: item,
    });
  } catch (error) {
    console.error('Cancel auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel auction.',
    });
  }
};

/**
 * @route   GET /api/auctions/:id/bids
 * @desc    Get public bid history for an auction
 * @access  Public
 */
const getAuctionBids = async (req, res) => {
  try {
    const bids = await Bid.find({ auction: req.params.id })
      .populate('bidder', 'name profilePhoto')
      .sort({ createdAt: -1 })
      .limit(100);

    const safeBids = bids.map((b) => ({
      _id: b._id,
      amount: b.amount,
      amountINR: b.amountINR,
      createdAt: b.createdAt,
      bidder: {
        _id: b.bidder?._id,
        name: b.bidder?.name || 'Anonymous Student',
      },
    }));

    res.status(200).json({
      success: true,
      bids: safeBids,
    });
  } catch (error) {
    console.error('Error fetching bids:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bid history.',
    });
  }
};

/**
 * @route   POST /api/auctions/:id/bids
 * @desc    Place a bid on an active auction (Concurrency-Safe)
 * @access  Private (Authenticated users only)
 */
const placeBid = async (req, res) => {
  try {
    const { amount, idempotencyKey } = req.body;
    const auctionId = req.params.id;
    const bidderId = req.user._id;

    if (!amount || isNaN(amount)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid numeric bid amount in INR.',
      });
    }

    const bidAmountPaise = toPaise(amount);
    if (bidAmountPaise <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Bid amount must be greater than ₹0.',
      });
    }

    // Check optional idempotency key
    if (idempotencyKey) {
      const existingBid = await Bid.findOne({
        auction: auctionId,
        bidder: bidderId,
        idempotencyKey,
      });
      if (existingBid) {
        return res.status(200).json({
          success: true,
          message: 'Bid was previously accepted (idempotent request).',
          bid: existingBid,
        });
      }
    }

    // Pre-check for clear, human-friendly error messages
    const currentItem = await Item.findById(auctionId);
    if (!currentItem) {
      return res.status(404).json({
        success: false,
        message: 'Auction item not found.',
      });
    }

    // Rule: Seller cannot bid on their own item
    if (currentItem.seller.toString() === bidderId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You cannot bid on your own auction listing.',
      });
    }

    // Rule: Auction must be Active
    if (currentItem.status !== 'Active') {
      return res.status(400).json({
        success: false,
        message: `This auction is no longer active. Current status: ${currentItem.status}.`,
      });
    }

    // Rule: Server-authoritative closing time check
    const now = new Date();
    if (new Date(currentItem.closingAt) <= now) {
      return res.status(400).json({
        success: false,
        message: 'Bidding has stopped because this auction has closed.',
      });
    }

    // Rule: Bid amount must meet minimum next valid bid
    const minRequiredPaise = currentItem.currentLeadingBid
      ? currentItem.currentLeadingBid + currentItem.minimumIncrement
      : currentItem.startingPrice;

    if (bidAmountPaise < minRequiredPaise) {
      return res.status(400).json({
        success: false,
        message: `Your bid of ${formatINR(bidAmountPaise)} is too low. The minimum valid bid is ${formatINR(minRequiredPaise)}.`,
      });
    }

    const previousLeadingBidderId = currentItem.currentLeadingBidder;

    // ATOMIC CONDITIONAL UPDATE:
    // Ensures concurrency safety against race conditions and simultaneous bids.
    const updatedAuction = await Item.findOneAndUpdate(
      {
        _id: auctionId,
        status: 'Active',
        closingAt: { $gt: now },
        seller: { $ne: bidderId },
        $or: [
          // Case 1: First bid ever placed
          {
            currentLeadingBid: null,
            startingPrice: { $lte: bidAmountPaise },
          },
          // Case 2: Subsequent higher bid meeting increment
          {
            currentLeadingBid: { $ne: null, $lt: bidAmountPaise },
            $expr: {
              $gte: [
                bidAmountPaise,
                { $add: ['$currentLeadingBid', '$minimumIncrement'] },
              ],
            },
          },
        ],
      },
      {
        $set: {
          currentLeadingBid: bidAmountPaise,
          currentLeadingBidder: bidderId,
        },
        $inc: { bidCount: 1 },
      },
      { new: true }
    ).populate('seller', 'name email');

    if (!updatedAuction) {
      // Race condition detected! Another bid was committed while this one was in flight.
      return res.status(409).json({
        success: false,
        message:
          'Another higher bid was placed right before yours. Please review the updated price and try again.',
      });
    }

    // Store the committed bid in the Bids collection
    const committedBid = await Bid.create({
      auction: auctionId,
      bidder: bidderId,
      amount: bidAmountPaise,
      idempotencyKey,
    });

    const formattedAmount = formatINR(bidAmountPaise);

    // 1. Notify previous leading bidder (if someone was outbid)
    if (
      previousLeadingBidderId &&
      previousLeadingBidderId.toString() !== bidderId.toString()
    ) {
      try {
        const outbidNotif = await Notification.create({
          recipient: previousLeadingBidderId,
          type: 'OUTBID',
          message: `You were outbid on "${updatedAuction.title}"! The leading bid is now ${formattedAmount}.`,
          auction: updatedAuction._id,
        });
        emitToUser(previousLeadingBidderId, 'notification:new', outbidNotif);
        emitToUser(previousLeadingBidderId, 'auction:outbid', {
          auctionId: updatedAuction._id,
          title: updatedAuction.title,
          newAmount: bidAmountPaise,
          formattedAmount,
        });
      } catch (err) {
        console.error('Error notifying outbid user:', err.message);
      }
    }

    // 2. Notify seller of new bid
    if (updatedAuction.seller) {
      try {
        const sellerNotif = await Notification.create({
          recipient: updatedAuction.seller._id,
          type: 'SELLER_APPROVAL_REQUIRED',
          message: `New leading bid of ${formattedAmount} placed on your item "${updatedAuction.title}" by ${req.user.name}.`,
          auction: updatedAuction._id,
        });
        emitToUser(updatedAuction.seller._id, 'notification:new', sellerNotif);
      } catch (err) {
        // Notification created
      }
    }

    // 3. Broadcast real-time bid event to public auction room
    emitToAuction(auctionId, 'bid:placed', {
      auctionId,
      currentLeadingBid: bidAmountPaise,
      currentLeadingBidINR: bidAmountPaise / 100,
      bidCount: updatedAuction.bidCount,
      minNextBid: bidAmountPaise + updatedAuction.minimumIncrement,
      minNextBidINR: (bidAmountPaise + updatedAuction.minimumIncrement) / 100,
      newBid: {
        _id: committedBid._id,
        amount: bidAmountPaise,
        amountINR: bidAmountPaise / 100,
        createdAt: committedBid.createdAt,
        bidder: {
          _id: req.user._id,
          name: req.user.name,
        },
      },
    });

    res.status(201).json({
      success: true,
      message: `Your bid of ${formattedAmount} was placed successfully!`,
      auction: updatedAuction,
      bid: committedBid,
    });
  } catch (error) {
    console.error('Place bid error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to place bid. Please try again.',
    });
  }
};

/**
 * @route   POST /api/auctions/:id/approve
 * @desc    Seller approves the provisional winning bid -> Status: Reserved
 * @access  Private (Seller only)
 */
const approveBid = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('provisionalWinner', 'name email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Auction not found.' });
    }

    if (item.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the seller can approve this bid.' });
    }

    if (item.status !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: `Auction must be "Pending Approval" to approve. Current status: ${item.status}`,
      });
    }

    item.status = 'Reserved';
    item.sellerDecision = {
      decision: 'Approved',
      decidedAt: new Date(),
      reason: req.body.reason || 'Seller accepted winning bid',
    };
    item.reservedAt = new Date();
    await item.save();

    const formattedAmount = formatINR(item.winningAmount || item.currentLeadingBid);

    // Notify provisional winner that item is Reserved
    if (item.provisionalWinner) {
      const buyerNotif = await Notification.create({
        recipient: item.provisionalWinner._id,
        type: 'ITEM_RESERVED',
        message: `Great news! The seller approved your winning bid of ${formattedAmount} for "${item.title}". The item is now Reserved for campus handover!`,
        auction: item._id,
      });
      emitToUser(item.provisionalWinner._id, 'notification:new', buyerNotif);
    }

    // Broadcast status change
    emitToAuction(item._id, 'auction:status_changed', {
      auctionId: item._id,
      status: 'Reserved',
      sellerDecision: item.sellerDecision,
      reservedAt: item.reservedAt,
    });

    res.status(200).json({
      success: true,
      message: 'Winning bid approved. Item is now Reserved for campus handover.',
      auction: item,
    });
  } catch (error) {
    console.error('Approve bid error:', error);
    res.status(500).json({ success: false, message: 'Failed to approve bid.' });
  }
};

/**
 * @route   POST /api/auctions/:id/reject
 * @desc    Seller rejects provisional winning bid -> Status: Rejected
 * @access  Private (Seller only)
 */
const rejectBid = async (req, res) => {
  try {
    const { reason } = req.body;
    const item = await Item.findById(req.params.id).populate('provisionalWinner', 'name email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Auction not found.' });
    }

    if (item.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the seller can reject this bid.' });
    }

    if (item.status !== 'Pending Approval') {
      return res.status(400).json({
        success: false,
        message: `Auction must be "Pending Approval" to reject. Current status: ${item.status}`,
      });
    }

    const rejectionReason = reason ? reason.trim() : 'Seller declined the final bid amount.';

    item.status = 'Rejected';
    item.sellerDecision = {
      decision: 'Rejected',
      decidedAt: new Date(),
      reason: rejectionReason,
    };
    item.outcomeReason = rejectionReason;
    await item.save();

    // Notify buyer of rejection
    if (item.provisionalWinner) {
      const buyerNotif = await Notification.create({
        recipient: item.provisionalWinner._id,
        type: 'SELLER_REJECTED',
        message: `The seller did not approve the winning bid for "${item.title}". Reason: ${rejectionReason}`,
        auction: item._id,
      });
      emitToUser(item.provisionalWinner._id, 'notification:new', buyerNotif);
    }

    emitToAuction(item._id, 'auction:status_changed', {
      auctionId: item._id,
      status: 'Rejected',
      outcomeReason: rejectionReason,
    });

    res.status(200).json({
      success: true,
      message: 'Winning bid rejected. Auction outcome recorded.',
      auction: item,
    });
  } catch (error) {
    console.error('Reject bid error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject bid.' });
  }
};

/**
 * @route   POST /api/auctions/:id/confirm-handover
 * @desc    Seller confirms in-person campus handover -> Status: Sold
 * @access  Private (Seller only)
 */
const confirmHandover = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).populate('provisionalWinner', 'name email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Auction not found.' });
    }

    if (item.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the seller can confirm handover.' });
    }

    if (item.status !== 'Reserved') {
      return res.status(400).json({
        success: false,
        message: `Item must be in "Reserved" status to confirm handover. Current status: ${item.status}`,
      });
    }

    item.status = 'Sold';
    item.soldAt = new Date();
    await item.save();

    const formattedAmount = formatINR(item.winningAmount || item.currentLeadingBid);

    // Notify buyer
    if (item.provisionalWinner) {
      const buyerNotif = await Notification.create({
        recipient: item.provisionalWinner._id,
        type: 'SALE_COMPLETED',
        message: `Campus handover completed! Your purchase of "${item.title}" for ${formattedAmount} is complete.`,
        auction: item._id,
      });
      emitToUser(item.provisionalWinner._id, 'notification:new', buyerNotif);
    }

    emitToAuction(item._id, 'auction:status_changed', {
      auctionId: item._id,
      status: 'Sold',
      soldAt: item.soldAt,
    });

    res.status(200).json({
      success: true,
      message: 'Campus handover confirmed. Item marked as Sold!',
      auction: item,
    });
  } catch (error) {
    console.error('Confirm handover error:', error);
    res.status(500).json({ success: false, message: 'Failed to confirm handover.' });
  }
};

/**
 * @route   POST /api/auctions/:id/failed-pickup
 * @desc    Seller records that the reserved buyer failed to complete pickup -> Status: Failed Pickup
 * @access  Private (Seller only)
 */
const recordFailedPickup = async (req, res) => {
  try {
    const { reason } = req.body;
    const item = await Item.findById(req.params.id).populate('provisionalWinner', 'name email');

    if (!item) {
      return res.status(404).json({ success: false, message: 'Auction not found.' });
    }

    if (item.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the seller can record failed pickup.' });
    }

    if (item.status !== 'Reserved') {
      return res.status(400).json({
        success: false,
        message: `Only "Reserved" auctions can be marked as Failed Pickup. Current status: ${item.status}`,
      });
    }

    const failureReason = reason ? reason.trim() : 'Buyer did not show up for scheduled pickup';

    item.status = 'Failed Pickup';
    item.outcomeReason = failureReason;
    await item.save();

    // Notify buyer
    if (item.provisionalWinner) {
      const buyerNotif = await Notification.create({
        recipient: item.provisionalWinner._id,
        type: 'FAILED_PICKUP',
        message: `The handover for "${item.title}" was recorded as Failed Pickup. Reason: ${failureReason}`,
        auction: item._id,
      });
      emitToUser(item.provisionalWinner._id, 'notification:new', buyerNotif);
    }

    emitToAuction(item._id, 'auction:status_changed', {
      auctionId: item._id,
      status: 'Failed Pickup',
      outcomeReason: failureReason,
    });

    res.status(200).json({
      success: true,
      message: 'Handover marked as Failed Pickup. Outcome recorded.',
      auction: item,
    });
  } catch (error) {
    console.error('Failed pickup error:', error);
    res.status(500).json({ success: false, message: 'Failed to record pickup status.' });
  }
};

module.exports = {
  getCategories,
  getAuctionStats,
  getAuctions,
  createAuction,
  getAuctionById,
  updateAuction,
  cancelAuction,
  getAuctionBids,
  placeBid,
  approveBid,
  rejectBid,
  confirmHandover,
  recordFailedPickup,
};
