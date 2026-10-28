const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const Bid = require('../models/Bid');
const { closeExpiredAuctions } = require('../services/auctionService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_auction_test';

test('PHASE 1: Last-Minute Extensions Test Suite', async (t) => {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // Clean test collections
  await User.deleteMany({ email: /@phase1test\.edu/ });
  await Item.deleteMany({ title: /Phase1 Test/ });
  await Bid.deleteMany({});

  const passwordHash = await User.hashPassword('Password123!');
  const seller = await User.create({
    name: 'Seller Phase1',
    email: 'seller@phase1test.edu',
    passwordHash,
    role: 'seller',
  });

  const bidder1 = await User.create({
    name: 'Bidder One',
    email: 'bidder1@phase1test.edu',
    passwordHash,
    role: 'bidder',
  });

  const bidder2 = await User.create({
    name: 'Bidder Two',
    email: 'bidder2@phase1test.edu',
    passwordHash,
    role: 'bidder',
  });

  // Helper simulating placeBid logic
  const placeBidSim = async (auctionId, bidderId, bidAmountPaise) => {
    const MAX_RETRIES = 5;
    let attempts = 0;
    while (attempts < MAX_RETRIES) {
      attempts++;
      const item = await Item.findById(auctionId);
      if (!item || item.status !== 'Active') {
        throw new Error('Auction is not active');
      }
      const now = new Date();
      if (new Date(item.closingAt) <= now) {
        throw new Error('Auction closed');
      }
      const minRequired = item.currentLeadingBid
        ? item.currentLeadingBid + item.minimumIncrement
        : item.startingPrice;
      if (bidAmountPaise < minRequired) {
        throw new Error('Bid amount too low');
      }

      const timeRemainingMs = new Date(item.closingAt).getTime() - now.getTime();
      const shouldExtend = timeRemainingMs > 0 && timeRemainingMs <= 30000;
      const newClosingAt = shouldExtend ? new Date(now.getTime() + 60000) : item.closingAt;

      const updateQuery = {
        _id: auctionId,
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

      const updated = await Item.findOneAndUpdate(updateQuery, updateDoc, { new: true });
      if (updated) {
        const bid = await Bid.create({
          auction: auctionId,
          bidder: bidderId,
          amount: bidAmountPaise,
          extendedClosing: shouldExtend,
        });
        return { updated, bid, wasExtended: shouldExtend };
      }
    }
    throw new Error('Race condition retry exhausted');
  };

  await t.test('1. Bid at T-31s (outside 30s threshold) does NOT extend closing time', async () => {
    const now = new Date();
    const closesAt = new Date(now.getTime() + 31000); // 31 seconds remaining

    const item = await Item.create({
      seller: seller._id,
      title: 'Phase1 Test Item T-31s',
      category: 'Electronics',
      description: 'Testing T-31s no extension',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 10000, // ₹100
      minimumIncrement: 1000, // ₹10
      closingAt: closesAt,
      status: 'Active',
    });

    const result = await placeBidSim(item._id, bidder1._id, 10000);
    assert.equal(result.wasExtended, false);
    assert.equal(result.bid.extendedClosing, false);
    assert.equal(result.updated.extensionCount, 0);
    assert.equal(new Date(result.updated.closingAt).getTime(), closesAt.getTime());
  });

  await t.test('2. Bid at T-30s (at threshold) EXTENDS closing time by bidTime + 60s', async () => {
    const now = new Date();
    const closesAt = new Date(now.getTime() + 30000); // exactly 30s

    const item = await Item.create({
      seller: seller._id,
      title: 'Phase1 Test Item T-30s',
      category: 'Electronics',
      description: 'Testing T-30s extension',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 10000,
      minimumIncrement: 1000,
      closingAt: closesAt,
      status: 'Active',
    });

    const bidTimeBefore = Date.now();
    const result = await placeBidSim(item._id, bidder1._id, 10000);
    const bidTimeAfter = Date.now();

    assert.equal(result.wasExtended, true);
    assert.equal(result.bid.extendedClosing, true);
    assert.equal(result.updated.extensionCount, 1);
    assert.equal(new Date(result.updated.originalClosesAt).getTime(), closesAt.getTime());

    // Verified closesAt is ~60s in future from bidTime
    const newCloseMs = new Date(result.updated.closingAt).getTime();
    assert.ok(newCloseMs >= bidTimeBefore + 59000 && newCloseMs <= bidTimeAfter + 61000);
  });

  await t.test('3. Bid at T-5s (deep in last 30s) EXTENDS closing time by bidTime + 60s', async () => {
    const now = new Date();
    const closesAt = new Date(now.getTime() + 5000); // 5s remaining

    const item = await Item.create({
      seller: seller._id,
      title: 'Phase1 Test Item T-5s',
      category: 'Electronics',
      description: 'Testing T-5s extension',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 10000,
      minimumIncrement: 1000,
      closingAt: closesAt,
      status: 'Active',
    });

    const bidTime = Date.now();
    const result = await placeBidSim(item._id, bidder1._id, 10000);

    assert.equal(result.wasExtended, true);
    assert.equal(result.bid.extendedClosing, true);
    assert.equal(result.updated.extensionCount, 1);
    assert.ok(new Date(result.updated.closingAt).getTime() >= bidTime + 59000);
  });

  await t.test('4. Repeated extensions in last 30s increment extensionCount and push closing', async () => {
    const now = new Date();
    const closesAt = new Date(now.getTime() + 10000); // 10s remaining

    const item = await Item.create({
      seller: seller._id,
      title: 'Phase1 Test Item Repeated',
      category: 'Electronics',
      description: 'Testing repeated extension',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 10000,
      minimumIncrement: 1000,
      closingAt: closesAt,
      status: 'Active',
    });

    // 1st bid extends
    const r1 = await placeBidSim(item._id, bidder1._id, 10000);
    assert.equal(r1.wasExtended, true);
    assert.equal(r1.updated.extensionCount, 1);

    // Simulate moving clock near new deadline by setting closingAt to now + 15s
    await Item.findByIdAndUpdate(item._id, { closingAt: new Date(Date.now() + 15000) });

    // 2nd bid also extends
    const r2 = await placeBidSim(item._id, bidder2._id, 11000);
    assert.equal(r2.wasExtended, true);
    assert.equal(r2.updated.extensionCount, 2);
    assert.equal(r2.bid.extendedClosing, true);
  });

  await t.test('5. Invalid bid in last 30s does NOT extend closing time', async () => {
    const now = new Date();
    const closesAt = new Date(now.getTime() + 15000);

    const item = await Item.create({
      seller: seller._id,
      title: 'Phase1 Test Item Invalid Bid',
      category: 'Electronics',
      description: 'Testing invalid bid rejection',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 10000,
      minimumIncrement: 1000,
      closingAt: closesAt,
      status: 'Active',
    });

    // Attempt invalid low bid (< startingPrice)
    await assert.rejects(async () => {
      await placeBidSim(item._id, bidder1._id, 5000);
    }, /Bid amount too low/);

    const check = await Item.findById(item._id);
    assert.equal(check.extensionCount, 0);
    assert.equal(new Date(check.closingAt).getTime(), closesAt.getTime());
  });

  await t.test('6. Bid after close is rejected and never extends', async () => {
    const past = new Date(Date.now() - 5000); // expired 5s ago

    const item = await Item.create({
      seller: seller._id,
      title: 'Phase1 Test Item Past Close',
      category: 'Electronics',
      description: 'Testing bid after close',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 10000,
      minimumIncrement: 1000,
      closingAt: past,
      status: 'Active',
    });

    await assert.rejects(async () => {
      await placeBidSim(item._id, bidder1._id, 10000);
    }, /Auction closed/);

    const check = await Item.findById(item._id);
    assert.equal(check.extensionCount, 0);
  });

  await t.test('7. Cron sweeper reads fresh closesAt and does NOT close extended auction', async () => {
    const now = new Date();
    // Auction that was originally set to expire 5s ago, but was extended to +55s
    const item = await Item.create({
      seller: seller._id,
      title: 'Phase1 Test Item Cron Read',
      category: 'Electronics',
      description: 'Testing cron sweeper uses fresh closesAt',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 10000,
      minimumIncrement: 1000,
      originalClosesAt: new Date(now.getTime() - 5000),
      closingAt: new Date(now.getTime() + 55000), // extended into future
      status: 'Active',
      bidCount: 1,
      currentLeadingBid: 10000,
      currentLeadingBidder: bidder1._id,
    });

    // Run sweeper
    await closeExpiredAuctions();

    const afterCheck = await Item.findById(item._id);
    assert.equal(afterCheck.status, 'Active'); // Still active!
  });

  // Cleanup
  await User.deleteMany({ email: /@phase1test\.edu/ });
  await Item.deleteMany({ title: /Phase1 Test/ });
  await Bid.deleteMany({});
  await mongoose.disconnect();
});

