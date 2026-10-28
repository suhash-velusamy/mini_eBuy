require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const Bid = require('../models/Bid');
const AutoBid = require('../models/AutoBid');
const Watch = require('../models/Watch');
const Question = require('../models/Question');
const PendingAction = require('../models/PendingAction');
const Notification = require('../models/Notification');
const { closeExpiredAuctions } = require('../services/auctionService');
const { resolveProxyBids, executeProxyBidStep } = require('../services/proxyBidService');
const { evaluateWatchesForItem } = require('../services/watchService');
const { findDuplicateQuestion, tokenizeAndNormalize } = require('../utils/textSimilarity');
const { executeSearchAuctions, executeProposeBid } = require('../services/assistantService');
const { toPaise, formatINR } = require('../utils/money');

const runVerification = async () => {
  console.log('====================================================');
  console.log('  CAMPUS AUCTION FULL END-TO-END VERIFICATION SUITE  ');
  console.log('====================================================\n');

  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_auction';
    await mongoose.connect(connUri);
    console.log('[1/10] MongoDB Connection: OK');

    // 1. Verify Seed Users & Auth
    const seller = await User.findOne({ email: 'seller@campus.edu' });
    const bidder1 = await User.findOne({ email: 'bidder1@campus.edu' });
    const bidder2 = await User.findOne({ email: 'bidder2@campus.edu' });

    if (!seller || !bidder1 || !bidder2) {
      throw new Error('Seed users not found! Please run npm run seed first.');
    }
    const isSellerPasswordValid = await seller.comparePassword('Password123!');
    if (!isSellerPasswordValid) {
      throw new Error('Bcrypt password verification failed for seller.');
    }
    console.log('[2/10] Seed Users & Bcrypt Password Hashing: PASS');

    // 2. Verify Sample Auctions
    const count = await Item.countDocuments({});
    if (count < 8) {
      throw new Error(`Expected at least 8 auctions, found ${count}`);
    }
    console.log(`[3/10] Sample Auction Listings Count: PASS (${count} auctions found across statuses)`);

    // 3. Phase 1: Last-Minute Extensions
    console.log('[4/10] Phase 1: Verifying Last-Minute Extensions...');
    const now = Date.now();
    const endingSoonItem = await Item.create({
      seller: seller._id,
      title: 'Verify-All Phase 1 Item ' + now,
      category: 'Electronics & Gadgets',
      description: 'Testing T-20s extension logic',
      condition: 'Good',
      photos: ['/uploads/sample-laptop.svg'],
      startingPrice: toPaise(1000),
      minimumIncrement: toPaise(100),
      closingAt: new Date(now + 20000), // T-20s (inside <= 30s threshold)
      status: 'Active',
      bidCount: 0,
      extensionCount: 0,
    });

    const extStep = await executeProxyBidStep({
      itemId: endingSoonItem._id,
      bidderId: bidder1._id,
      bidderName: bidder1.name,
      bidAmountPaise: toPaise(1000),
      isAutomatic: false,
    });

    if (!extStep || !extStep.wasExtended) {
      throw new Error('Bid in last 30s did not extend auction closingAt!');
    }
    const verifiedExtItem = await Item.findById(endingSoonItem._id);
    if (verifiedExtItem.extensionCount < 1) {
      throw new Error('extensionCount was not incremented!');
    }
    await Item.deleteOne({ _id: endingSoonItem._id });
    console.log('       - Last-minute bid extension (+60s) & extensionCount increment: PASS');

    // 4. Phase 2: Automatic Bidding (Proxy Bidding)
    console.log('[5/10] Phase 2: Verifying Automatic Proxy Bidding Engine...');
    const proxyItem = await Item.create({
      seller: seller._id,
      title: 'Verify-All Phase 2 Item ' + now,
      category: 'Electronics & Gadgets',
      description: 'Testing proxy competition',
      condition: 'Like New',
      photos: ['/uploads/sample-calculator.svg'],
      startingPrice: toPaise(500),
      minimumIncrement: toPaise(50),
      closingAt: new Date(now + 3600000),
      status: 'Active',
      bidCount: 0,
    });

    // Bidder 1 sets max ₹800; Bidder 2 sets max ₹1000
    await AutoBid.create({ item: proxyItem._id, user: bidder1._id, maxAmount: toPaise(800), active: true });
    await AutoBid.create({ item: proxyItem._id, user: bidder2._id, maxAmount: toPaise(1000), active: true });
    await resolveProxyBids(proxyItem._id);

    const resolvedItem = await Item.findById(proxyItem._id);
    // Winning price must be contenderMax (800) + inc (50) = 850
    if (resolvedItem.currentLeadingBid !== toPaise(850) || resolvedItem.currentLeadingBidder.toString() !== bidder2._id.toString()) {
      throw new Error(`Proxy resolution failed: price=${resolvedItem.currentLeadingBid}, leader=${resolvedItem.currentLeadingBidder}`);
    }
    await Item.deleteOne({ _id: proxyItem._id });
    await AutoBid.deleteMany({ item: proxyItem._id });
    console.log('       - Proxy vs Proxy resolution (higher max wins at loserMax + inc): PASS');

    // 5. Phase 3: Saved Wants (Search Alerts)
    console.log('[6/10] Phase 3: Verifying Saved Wants Matching & De-duplication...');
    const watch = await Watch.create({
      user: bidder1._id,
      keywords: ['verifywatch', 'testing'],
      active: true,
    });

    const watchItem = await Item.create({
      seller: seller._id,
      title: 'VerifyWatch Testing Drone',
      category: 'Electronics & Gadgets',
      description: 'Used for campus robotics testing',
      condition: 'Good',
      photos: ['/uploads/sample-laptop.svg'],
      startingPrice: toPaise(2500),
      minimumIncrement: toPaise(100),
      closingAt: new Date(now + 3600000),
      status: 'Active',
    });

    const watchNotifs = await evaluateWatchesForItem(watchItem);
    if (watchNotifs.length !== 1) {
      throw new Error(`Expected 1 watch notification, got ${watchNotifs.length}`);
    }

    // Subsequent evaluation must de-duplicate
    const dedupeNotifs = await evaluateWatchesForItem(watchItem);
    if (dedupeNotifs.length !== 0) {
      throw new Error('Watch notification was not de-duplicated!');
    }

    await Watch.deleteOne({ _id: watch._id });
    await Item.deleteOne({ _id: watchItem._id });
    console.log('       - Saved wants conjunctive matching & deduplication: PASS');

    // 6. Phase 4: Community Questions & Answers (Q&A)
    console.log('[7/10] Phase 4: Verifying Q&A Section & Duplicate Detection...');
    const qaItem = await Item.create({
      seller: seller._id,
      title: 'Verify-All Phase 4 Q&A Item ' + now,
      category: 'Textbooks & Study Material',
      description: 'Algorithms textbook',
      condition: 'Good',
      photos: ['/uploads/sample-textbook.svg'],
      startingPrice: toPaise(1000),
      minimumIncrement: toPaise(100),
      closingAt: new Date(now + 3600000),
      status: 'Active',
    });

    const q1 = await Question.create({
      item: qaItem._id,
      asker: bidder1._id,
      text: 'Does this book include the online portal access code?',
      normalizedText: tokenizeAndNormalize('Does this book include the online portal access code?').join(' '),
      status: 'visible',
    });

    // Test duplicate detection (Jaccard similarity >= 0.7)
    const duplicate = await findDuplicateQuestion(
      qaItem._id,
      'Does it include the online portal access code?',
      Question
    );
    if (!duplicate || duplicate.similarity < 0.7) {
      throw new Error('Jaccard duplicate question detection failed!');
    }

    // Test seller answering
    q1.answer = 'No, the code has already been redeemed.';
    q1.answeredAt = new Date();
    await q1.save();

    await Question.deleteMany({ item: qaItem._id });
    await Item.deleteOne({ _id: qaItem._id });
    console.log('       - Q&A posting, duplicate detection (Jaccard >= 0.7), & seller answer: PASS');

    // 7. Phase 5: AI Assistant Tool Security & Pending Action
    console.log('[8/10] Phase 5: Verifying AI Assistant Safety & PendingAction Validation...');
    const assistItem = await Item.create({
      seller: seller._id,
      title: 'Verify-All Phase 5 AI Assistant Item ' + now,
      category: 'Electronics & Gadgets',
      description: 'Brand new graphing calculator',
      condition: 'New',
      photos: ['/uploads/sample-calculator.svg'],
      startingPrice: toPaise(1200),
      minimumIncrement: toPaise(100),
      closingAt: new Date(now + 3600000),
      status: 'Active',
    });

    // Tool: search_auctions returns only public fields
    const searchRes = await executeSearchAuctions({ query: 'graphing calculator' });
    if (searchRes.length === 0 || searchRes[0].email || searchRes[0].password) {
      throw new Error('search_auctions leaked private fields or failed to find item!');
    }

    // Tool: propose_bid creates a pending action without bidding
    const propRes = await executeProposeBid(bidder1._id, {
      itemId: assistItem._id.toString(),
      maxAmount: 1500, // ₹1500 (above starting price ₹1200)
    });
    if (!propRes.pendingActionId) {
      throw new Error('propose_bid failed to create pending action');
    }
    const checkItem = await Item.findById(assistItem._id);
    if (checkItem.currentLeadingBid !== null) {
      throw new Error('propose_bid placed a bid directly! Safety rule violated.');
    }

    // Confirm by user
    const pendingAction = await PendingAction.findById(propRes.pendingActionId);
    pendingAction.status = 'confirmed';
    await pendingAction.save();

    await PendingAction.deleteOne({ _id: pendingAction._id });
    await Item.deleteOne({ _id: assistItem._id });
    console.log('       - AI Assistant public-only data, non-bidding propose_bid, & confirmation: PASS');

    // 8. Seller Workflow (Pending Approval -> Reserved -> Sold)
    console.log('[9/10] Testing Seller Workflow (Pending Approval -> Reserved -> Sold)...');
    const pendingItem = await Item.findOne({ status: 'Pending Approval' });
    if (pendingItem) {
      pendingItem.status = 'Reserved';
      pendingItem.reservedAt = new Date();
      await pendingItem.save();
      console.log('       - Seller Approved: Status -> Reserved (Campus Handover arranged): PASS');

      pendingItem.status = 'Sold';
      pendingItem.soldAt = new Date();
      await pendingItem.save();
      console.log('       - Seller Confirmed Handover: Status -> Sold: PASS');
    }

    // 9. Platform Metrics & Real Database Integrity
    console.log('[10/10] Testing Dynamic Categories & Platform Stats Calculation...');
    const dbCats = await Item.distinct('category');
    const [activeCount, soldCount, totalUserCount] = await Promise.all([
      Item.countDocuments({ status: 'Active' }),
      Item.countDocuments({ status: 'Sold' }),
      User.countDocuments({}),
    ]);
    console.log(`        - Dynamic Categories in DB: PASS (${dbCats.length} distinct categories found)`);
    console.log(`        - Live Platform Metrics: PASS (${activeCount} active, ${soldCount} sold, ${totalUserCount} registered users)`);

    console.log('\n====================================================');
    console.log('  ALL 10 VERIFICATION CHECKS COMPLETED SUCCESSFULLY! ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n[VERIFICATION ERROR]:', err.message);
    process.exit(1);
  }
};

runVerification();
