const Item = require('../models/Item');
const Bid = require('../models/Bid');

/**
 * @route   GET /api/users/me/listings
 * @desc    Get all listings created by the authenticated user
 * @access  Private
 */
const getMyListings = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { seller: req.user._id };

    if (status && status !== 'all') {
      filter.status = status;
    }

    const listings = await Item.find(filter)
      .populate('provisionalWinner', 'name email')
      .sort({ createdAt: -1 });

    // Calculate seller metrics
    const allSellerListings = await Item.find({ seller: req.user._id });
    const stats = {
      total: allSellerListings.length,
      active: allSellerListings.filter((i) => i.status === 'Active').length,
      pendingApproval: allSellerListings.filter((i) => i.status === 'Pending Approval').length,
      reserved: allSellerListings.filter((i) => i.status === 'Reserved').length,
      sold: allSellerListings.filter((i) => i.status === 'Sold').length,
      totalRevenueINR:
        allSellerListings
          .filter((i) => i.status === 'Sold' && i.winningAmount)
          .reduce((acc, curr) => acc + curr.winningAmount, 0) / 100,
    };

    res.status(200).json({
      success: true,
      stats,
      listings,
    });
  } catch (error) {
    console.error('Error in getMyListings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve your listings.',
    });
  }
};

/**
 * @route   GET /api/users/me/bids
 * @desc    Get all auctions the authenticated user has bid on
 * @access  Private
 */
const getMyBids = async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all distinct auctions the user has bid on
    const userBids = await Bid.find({ bidder: userId }).sort({ createdAt: -1 });
    const auctionMap = new Map();

    for (const b of userBids) {
      const aId = b.auction.toString();
      if (!auctionMap.has(aId)) {
        auctionMap.set(aId, {
          highestUserBidPaise: b.amount,
          latestBidDate: b.createdAt,
          totalUserBids: 1,
        });
      } else {
        const entry = auctionMap.get(aId);
        entry.totalUserBids += 1;
        if (b.amount > entry.highestUserBidPaise) {
          entry.highestUserBidPaise = b.amount;
        }
      }
    }

    const auctionIds = Array.from(auctionMap.keys());
    const auctions = await Item.find({ _id: { $in: auctionIds } })
      .populate('seller', 'name email profilePhoto')
      .populate('provisionalWinner', 'name email');

    const result = auctions.map((item) => {
      const userBidStats = auctionMap.get(item._id.toString());
      const isLeading =
        item.currentLeadingBidder &&
        item.currentLeadingBidder.toString() === userId.toString();
      const isWinner =
        item.provisionalWinner &&
        item.provisionalWinner._id.toString() === userId.toString();

      return {
        auction: item,
        highestUserBidPaise: userBidStats?.highestUserBidPaise || 0,
        highestUserBidINR: (userBidStats?.highestUserBidPaise || 0) / 100,
        latestBidDate: userBidStats?.latestBidDate,
        totalUserBids: userBidStats?.totalUserBids || 1,
        isLeading,
        isWinner,
        statusText: isLeading
          ? item.status === 'Active'
            ? 'Winning'
            : isWinner
            ? 'Won'
            : item.status
          : 'Outbid',
      };
    });

    res.status(200).json({
      success: true,
      count: result.length,
      bids: result,
    });
  } catch (error) {
    console.error('Error in getMyBids:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve your bids.',
    });
  }
};

module.exports = {
  getMyListings,
  getMyBids,
};
