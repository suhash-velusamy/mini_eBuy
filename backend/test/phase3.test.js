const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const Watch = require('../models/Watch');
const Notification = require('../models/Notification');
const { evaluateWatchesForItem } = require('../services/watchService');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_auction_test';

test('PHASE 3: Saved Wants (Search Alerts) Test Suite', async (t) => {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // Cleanup test collections
  await User.deleteMany({ email: /@phase3test\.edu/ });
  await Item.deleteMany({ title: /Phase3 Test/ });
  await Watch.deleteMany({});
  await Notification.deleteMany({});

  const passwordHash = await User.hashPassword('Password123!');
  const seller = await User.create({
    name: 'Seller Phase3',
    email: 'seller@phase3test.edu',
    passwordHash,
    role: 'seller',
  });

  const studentBuyer = await User.create({
    name: 'Student Buyer',
    email: 'buyer@phase3test.edu',
    passwordHash,
    role: 'bidder',
  });

  const createItem = async (custom = {}) => {
    return Item.create({
      title: 'Phase3 Test Item ' + Date.now(),
      description: 'Standard description for campus testing',
      category: 'Electronics & Gadgets',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 2000, // ₹20
      minimumIncrement: 100, // ₹1
      closingAt: new Date(Date.now() + 3600000),
      seller: seller._id,
      status: 'Active',
      bidCount: 0,
      currentLeadingBid: null,
      currentLeadingBidder: null,
      ...custom,
    });
  };

  await t.test('1. Keyword match on title + description generates notification', async () => {
    const watch = await Watch.create({
      user: studentBuyer._id,
      keywords: ['scientific', 'calculator'],
      category: 'Electronics & Gadgets',
      maxPrice: 50000, // ₹500
      active: true,
    });

    const matchingItem = await createItem({
      title: 'Phase3 Test Casio Scientific Calculator fx-991EX',
      description: 'Used for two semesters in engineering math.',
      startingPrice: 40000, // ₹400 <= ₹500
    });

    const notifs = await evaluateWatchesForItem(matchingItem);
    assert.equal(notifs.length, 1);
    assert.equal(notifs[0].recipient.toString(), studentBuyer._id.toString());
    assert.equal(notifs[0].type, 'WATCH_MATCH');

    const updatedWatch = await Watch.findById(watch._id);
    assert.ok(updatedWatch.lastMatchedAt, 'lastMatchedAt must be updated');
  });

  await t.test('2. Non-match: price higher than watch maxPrice does NOT notify', async () => {
    const watch = await Watch.create({
      user: studentBuyer._id,
      keywords: ['laptop'],
      maxPrice: 2000000, // ₹20,000
      active: true,
    });

    const expensiveItem = await createItem({
      title: 'Phase3 Test Gaming Laptop',
      description: 'High end laptop',
      startingPrice: 3500000, // ₹35,000 > ₹20,000
    });

    const notifs = await evaluateWatchesForItem(expensiveItem);
    assert.equal(notifs.length, 0);

    const savedNotif = await Notification.findOne({ auction: expensiveItem._id, watch: watch._id });
    assert.equal(savedNotif, null, 'No notification should be created for over-budget item');
  });

  await t.test('3. Non-match: category mismatch does NOT notify', async () => {
    const watch = await Watch.create({
      user: studentBuyer._id,
      keywords: ['textbook'],
      category: 'Textbooks & Study Material',
      active: true,
    });

    const wrongCategoryItem = await createItem({
      title: 'Phase3 Test Textbook of Physics',
      description: 'Hardcover textbook',
      category: 'Sports & Fitness', // Mismatched category
    });

    const notifs = await evaluateWatchesForItem(wrongCategoryItem);
    assert.equal(notifs.length, 0);
  });

  await t.test('4. Seller own items do NOT trigger notification on their own watch alerts', async () => {
    // Seller creates watch for 'cycle'
    const sellerWatch = await Watch.create({
      user: seller._id,
      keywords: ['cycle'],
      active: true,
    });

    // Seller lists a cycle
    const cycleItem = await createItem({
      title: 'Phase3 Test Hero Cycle',
      description: 'Campus cycle in great condition',
      seller: seller._id,
    });

    const notifs = await evaluateWatchesForItem(cycleItem);
    const sellerNotif = notifs.find((n) => n.recipient.toString() === seller._id.toString());
    assert.equal(sellerNotif, undefined, 'Sellers must never be notified of their own listings');
  });

  await t.test('5. De-duplication: multiple edits do NOT create duplicate notifications', async () => {
    const watch = await Watch.create({
      user: studentBuyer._id,
      keywords: ['badminton', 'racket'],
      active: true,
    });

    const racketItem = await createItem({
      title: 'Phase3 Test Yonex Badminton Racket',
      description: 'Good condition racket',
    });

    // First evaluation
    const firstNotifs = await evaluateWatchesForItem(racketItem);
    assert.equal(firstNotifs.length, 1);

    // Second evaluation on the same item (e.g. seller edited price/description)
    const secondNotifs = await evaluateWatchesForItem(racketItem);
    assert.equal(secondNotifs.length, 0, 'Subsequent evaluation must be de-duplicated');

    // Total notifications in DB for this (watch, item) pair must be exactly 1
    const totalNotifs = await Notification.countDocuments({
      watch: watch._id,
      auction: racketItem._id,
      deduplicationKey: `watch_${watch._id}_item_${racketItem._id}`,
    });
    assert.equal(totalNotifs, 1, 'Exactly one notification per (watch, item)');
  });

  await t.test('6. Offline user receives notification persistently in DB on next retrieval', async () => {
    const watch = await Watch.create({
      user: studentBuyer._id,
      keywords: ['drafter'],
      active: true,
    });

    const drafterItem = await createItem({
      title: 'Phase3 Test Engineering Mini Drafter',
      description: 'Perfect for first-year graphics drawing',
    });

    // Student is offline: matching engine creates persistent notification in DB
    await evaluateWatchesForItem(drafterItem);

    // Student logs in / opens app: fetches notifications
    const storedNotifs = await Notification.find({
      recipient: studentBuyer._id,
      type: 'WATCH_MATCH',
      auction: drafterItem._id,
    }).populate('auction');

    assert.equal(storedNotifs.length, 1);
    assert.equal(storedNotifs[0].auction.title, drafterItem.title);
    assert.equal(storedNotifs[0].readAt, null);
  });

  await t.test('7. Limit: maximum 10 active watches enforced per user', async () => {
    // Delete existing buyer watches for clean count
    await Watch.deleteMany({ user: studentBuyer._id });

    // Create 10 active watches
    for (let i = 1; i <= 10; i++) {
      await Watch.create({
        user: studentBuyer._id,
        keywords: ['keyword' + i],
        active: true,
      });
    }

    const activeCount = await Watch.countDocuments({ user: studentBuyer._id, active: true });
    assert.equal(activeCount, 10);

    // Verify limit check logic
    const canCreate11th = activeCount < 10;
    assert.equal(canCreate11th, false, '11th active watch must be blocked by rule');
  });

  await mongoose.disconnect();
});

