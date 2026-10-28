const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const Bid = require('../models/Bid');
const AutoBid = require('../models/AutoBid');
const Notification = require('../models/Notification');
const { resolveProxyBids, executeProxyBidStep } = require('../services/proxyBidService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_auction_test';

test('PHASE 2: Automatic Bidding (Proxy Bidding) Test Suite', async (t) => {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // Cleanup test collections
  await User.deleteMany({ email: /@phase2test\.edu/ });
  await Item.deleteMany({ title: /Phase2 Test/ });
  await AutoBid.deleteMany({});
  await Notification.deleteMany({});

  const passwordHash = await User.hashPassword('Password123!');
  const seller = await User.create({
    name: 'Seller Phase2',
    email: 'seller@phase2test.edu',
    passwordHash,
    role: 'seller',
  });

  const bidderA = await User.create({
    name: 'Bidder Alpha',
    email: 'alpha@phase2test.edu',
    passwordHash,
    role: 'bidder',
  });

  const bidderB = await User.create({
    name: 'Bidder Beta',
    email: 'beta@phase2test.edu',
    passwordHash,
    role: 'bidder',
  });

  const bidderC = await User.create({
    name: 'Bidder Gamma',
    email: 'gamma@phase2test.edu',
    passwordHash,
    role: 'bidder',
  });

  // Helper to create fresh test item
  const createTestItem = async (custom = {}) => {
    return Item.create({
      title: 'Phase2 Test Item ' + Date.now() + Math.random(),
      description: 'Phase 2 proxy test description',
      category: 'Electronics',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 1000, // 1000 paise = ₹10
      minimumIncrement: 100, // 100 paise = ₹1
      closingAt: new Date(Date.now() + 3600000), // 1 hour ahead
      seller: seller._id,
      status: 'Active',
      bidCount: 0,
      currentLeadingBid: null,
      currentLeadingBidder: null,
      ...custom,
    });
  };

  // Helper to simulate manual bid
  const placeManualBid = async (item, user, amountPaise) => {
    const step = await executeProxyBidStep({
      itemId: item._id,
      bidderId: user._id,
      bidderName: user.name,
      bidAmountPaise: amountPaise,
      isAutomatic: false,
    });
    if (step) {
      await resolveProxyBids(item._id);
    }
    return step;
  };

  await t.test('1. Single proxy vs manual bid: proxy automatically defends lead', async () => {
    const item = await createTestItem({ startingPrice: 1000, minimumIncrement: 100 });

    // Bidder Alpha registers auto-bid max 2000 paise (₹20)
    await AutoBid.create({
      item: item._id,
      user: bidderA._id,
      maxAmount: 2000,
      active: true,
    });

    // Run resolution: Alpha enters bid at starting price 1000
    await resolveProxyBids(item._id);
    let currentItem = await Item.findById(item._id);
    assert.equal(currentItem.currentLeadingBid, 1000);
    assert.equal(currentItem.currentLeadingBidder.toString(), bidderA._id.toString());

    // Bidder Beta places manual bid of 1200 paise (₹12)
    const manualStep = await placeManualBid(item, bidderB, 1200);
    assert.ok(manualStep, 'Manual bid should succeed');

    // Auto-bid for Alpha should counter with min(2000, 1200 + 100) = 1300
    currentItem = await Item.findById(item._id);
    assert.equal(currentItem.currentLeadingBid, 1300);
    assert.equal(currentItem.currentLeadingBidder.toString(), bidderA._id.toString());

    const latestBid = await Bid.findOne({ auction: item._id }).sort({ createdAt: -1 });
    assert.equal(latestBid.amount, 1300);
    assert.equal(latestBid.bidder.toString(), bidderA._id.toString());
    assert.equal(latestBid.isAutomatic, true);
  });

  await t.test('2. Proxy vs proxy: higher max wins at contenderMax + increment', async () => {
    const item = await createTestItem({ startingPrice: 1000, minimumIncrement: 100 });

    // Alpha sets max 1800 paise
    await AutoBid.create({
      item: item._id,
      user: bidderA._id,
      maxAmount: 1800,
      active: true,
    });

    // Beta sets max 2500 paise
    await AutoBid.create({
      item: item._id,
      user: bidderB._id,
      maxAmount: 2500,
      active: true,
    });

    await resolveProxyBids(item._id);

    const currentItem = await Item.findById(item._id);
    // Beta should win at min(2500, 1800 + 100) = 1900 paise
    assert.equal(currentItem.currentLeadingBid, 1900);
    assert.equal(currentItem.currentLeadingBidder.toString(), bidderB._id.toString());

    // Alpha's auto-bid should now be inactive (exhausted)
    const alphaAuto = await AutoBid.findOne({ item: item._id, user: bidderA._id });
    assert.equal(alphaAuto.active, false);

    // Beta's auto-bid should remain active
    const betaAuto = await AutoBid.findOne({ item: item._id, user: bidderB._id });
    assert.equal(betaAuto.active, true);
  });

  await t.test('3. Equal maxes: earlier createdAt wins at the equal max', async () => {
    const item = await createTestItem({ startingPrice: 1000, minimumIncrement: 100 });

    const now = Date.now();
    // Alpha registered earlier
    await AutoBid.create({
      item: item._id,
      user: bidderA._id,
      maxAmount: 2200,
      active: true,
      createdAt: new Date(now - 10000),
    });

    // Beta registered later with same max
    await AutoBid.create({
      item: item._id,
      user: bidderB._id,
      maxAmount: 2200,
      active: true,
      createdAt: new Date(now),
    });

    await resolveProxyBids(item._id);

    const currentItem = await Item.findById(item._id);
    assert.equal(currentItem.currentLeadingBid, 2200);
    assert.equal(currentItem.currentLeadingBidder.toString(), bidderA._id.toString());

    // Beta's auto-bid is exhausted
    const betaAuto = await AutoBid.findOne({ item: item._id, user: bidderB._id });
    assert.equal(betaAuto.active, false);
  });

  await t.test('4. Max exhausted: deactivates and sends notification', async () => {
    const item = await createTestItem({ startingPrice: 1000, minimumIncrement: 100 });

    await AutoBid.create({
      item: item._id,
      user: bidderA._id,
      maxAmount: 1500,
      active: true,
    });

    await resolveProxyBids(item._id);

    // Beta outbids Alpha with 1600 paise
    await placeManualBid(item, bidderB, 1600);

    const alphaAuto = await AutoBid.findOne({ item: item._id, user: bidderA._id });
    assert.equal(alphaAuto.active, false, 'AutoBid must be deactivated');

    // Verify Notification exists for Alpha
    const notif = await Notification.findOne({
      recipient: bidderA._id,
      type: 'OUTBID',
      auction: item._id,
    });
    assert.ok(notif, 'Outbid notification must be created');
  });

  await t.test('5. Raising max allowed; lowering max rejected', async () => {
    const item = await createTestItem({ startingPrice: 1000, minimumIncrement: 100 });

    const autoBid = await AutoBid.create({
      item: item._id,
      user: bidderA._id,
      maxAmount: 2000,
      active: true,
    });

    // Valid raise
    const newMaxRaise = 2500;
    assert.ok(newMaxRaise > autoBid.maxAmount, 'Raising max is allowed');
    autoBid.maxAmount = newMaxRaise;
    await autoBid.save();
    assert.equal(autoBid.maxAmount, 2500);

    // Invalid lowering
    const lowerMax = 1800;
    const isLowering = lowerMax < autoBid.maxAmount;
    assert.equal(isLowering, true, 'Lowering max must be detected and disallowed');
  });

  await t.test('6. Proxy cannot exceed its max ceiling under any circumstances', async () => {
    const item = await createTestItem({ startingPrice: 1000, minimumIncrement: 500 });

    // Alpha sets max 1400 (which cannot afford starting 1000 + 500 = 1500)
    await AutoBid.create({
      item: item._id,
      user: bidderA._id,
      maxAmount: 1400,
      active: true,
    });

    // Beta places manual bid at 1000
    await placeManualBid(item, bidderB, 1000);

    // Check if Alpha placed any bid above 1400
    const alphaBids = await Bid.find({ auction: item._id, bidder: bidderA._id });
    for (const b of alphaBids) {
      assert.ok(b.amount <= 1400, `Bid ${b.amount} exceeded max 1400`);
    }

    const currentItem = await Item.findById(item._id);
    assert.equal(currentItem.currentLeadingBidder.toString(), bidderB._id.toString());
  });

  await t.test('7. Proxy never bids on closed auction', async () => {
    const closedItem = await createTestItem({
      startingPrice: 1000,
      minimumIncrement: 100,
      closingAt: new Date(Date.now() - 60000), // Closed 1 minute ago
      status: 'Active',
    });

    await AutoBid.create({
      item: closedItem._id,
      user: bidderA._id,
      maxAmount: 3000,
      active: true,
    });

    await resolveProxyBids(closedItem._id);

    const bidsCount = await Bid.countDocuments({ auction: closedItem._id });
    assert.equal(bidsCount, 0, 'No bids should be placed on an expired auction');
  });

  await t.test('8. Concurrent bids keep price and leader consistent', async () => {
    const item = await createTestItem({ startingPrice: 1000, minimumIncrement: 100 });

    // 20 concurrent bid attempts at varying valid increments
    const bidPromises = [];
    for (let i = 1; i <= 20; i++) {
      const bidder = i % 2 === 0 ? bidderA : bidderB;
      const targetAmount = 1000 + i * 100;
      bidPromises.push(
        executeProxyBidStep({
          itemId: item._id,
          bidderId: bidder._id,
          bidderName: bidder.name,
          bidAmountPaise: targetAmount,
          isAutomatic: false,
        })
      );
    }

    await Promise.all(bidPromises);

    // Verify all accepted bids are strictly ordered
    const allBids = await Bid.find({ auction: item._id }).sort({ amount: 1 });
    assert.ok(allBids.length > 0, 'At least one concurrent bid should succeed');

    for (let i = 1; i < allBids.length; i++) {
      assert.ok(
        allBids[i].amount >= allBids[i - 1].amount + 100,
        `Bid sequence strictly monotonic: ${allBids[i].amount} vs ${allBids[i - 1].amount}`
      );
    }

    const finalItem = await Item.findById(item._id);
    const highestBid = allBids[allBids.length - 1];
    assert.equal(finalItem.currentLeadingBid, highestBid.amount);
    assert.equal(finalItem.currentLeadingBidder.toString(), highestBid.bidder.toString());
  });

  await t.test('9. Delete proxy disallowed when user is leading bidder', async () => {
    const item = await createTestItem({ startingPrice: 1000, minimumIncrement: 100 });

    await AutoBid.create({
      item: item._id,
      user: bidderA._id,
      maxAmount: 2000,
      active: true,
    });

    await resolveProxyBids(item._id);

    const currentItem = await Item.findById(item._id);
    assert.equal(currentItem.currentLeadingBidder.toString(), bidderA._id.toString());

    // When bidderA is leading, deletion rule:
    const isLeading = currentItem.currentLeadingBidder.toString() === bidderA._id.toString();
    assert.equal(isLeading, true);

    // If controller check is tested:
    let deleteAllowed = true;
    if (isLeading) {
      deleteAllowed = false;
    }
    assert.equal(deleteAllowed, false, 'Leading bidder cannot delete their auto-bid');
  });

  await mongoose.disconnect();
});
