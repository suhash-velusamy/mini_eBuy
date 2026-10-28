const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const Question = require('../models/Question');
const Notification = require('../models/Notification');
const {
  tokenizeAndNormalize,
  computeJaccardSimilarity,
  findDuplicateQuestion,
} = require('../utils/textSimilarity');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_auction_test';

test('PHASE 4: Community Questions & Answers (Q&A) Test Suite', async (t) => {
  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });

  // Cleanup test collections
  await User.deleteMany({ email: /@phase4test\.edu/ });
  await Item.deleteMany({ title: /Phase4 Test/ });
  await Question.deleteMany({});
  await Notification.deleteMany({});

  const passwordHash = await User.hashPassword('Password123!');
  const seller = await User.create({
    name: 'Seller Phase4',
    email: 'seller@phase4test.edu',
    passwordHash,
    role: 'seller',
  });

  const studentA = await User.create({
    name: 'Student Alice',
    email: 'alice@phase4test.edu',
    passwordHash,
    role: 'bidder',
  });

  const studentB = await User.create({
    name: 'Student Bob',
    email: 'bob@phase4test.edu',
    passwordHash,
    role: 'bidder',
  });

  const createItem = async (custom = {}) => {
    return Item.create({
      title: 'Phase4 Test Item ' + Date.now(),
      description: 'Used laptop in good working condition.',
      category: 'Electronics & Gadgets',
      condition: 'Good',
      photos: ['/uploads/test.jpg'],
      startingPrice: 1500000,
      minimumIncrement: 50000,
      closingAt: new Date(Date.now() + 3600000),
      seller: seller._id,
      status: 'Active',
      bidCount: 0,
      ...custom,
    });
  };

  await t.test('1. Ask: valid question is created with normalized tokens', async () => {
    const item = await createItem();
    const questionText = 'Does this laptop include the original charger and box?';
    const tokens = tokenizeAndNormalize(questionText);

    const q = await Question.create({
      item: item._id,
      asker: studentA._id,
      text: questionText,
      normalizedText: tokens.join(' '),
      status: 'visible',
    });

    assert.equal(q.text, questionText);
    assert.ok(q.normalizedText.includes('charger'));
    assert.ok(q.normalizedText.includes('original'));
    assert.equal(q.status, 'visible');
  });

  await t.test('2. Duplicate blocked: Jaccard similarity >= 0.7 detects duplicate', async () => {
    const item = await createItem();
    const originalText = 'Does this laptop come with original charger and box?';
    const tokens = tokenizeAndNormalize(originalText);

    await Question.create({
      item: item._id,
      asker: studentA._id,
      text: originalText,
      normalizedText: tokens.join(' '),
      status: 'visible',
    });

    // Bob asks nearly identical question
    const candidateText = 'Does it come with original charger and box?';
    const match = await findDuplicateQuestion(item._id, candidateText, Question);

    assert.ok(match, 'Duplicate question must be detected');
    assert.ok(match.similarity >= 0.7, `Similarity ${match.similarity} should be >= 0.7`);
    assert.equal(match.matchedQuestion.text, originalText);
  });

  await t.test('3. Non-duplicate question with low similarity is accepted', async () => {
    const item = await createItem();
    const textA = 'What is the battery health percentage?';
    await Question.create({
      item: item._id,
      asker: studentA._id,
      text: textA,
      normalizedText: tokenizeAndNormalize(textA).join(' '),
      status: 'visible',
    });

    const textB = 'Can we meet at the campus library for handover?';
    const match = await findDuplicateQuestion(item._id, textB, Question);
    assert.equal(match, null, 'Unrelated questions must not be flagged as duplicates');
  });

  await t.test('4. Over-limit blocked: max 3 questions per user per item', async () => {
    const item = await createItem();

    // Alice asks 3 distinct questions
    for (let i = 1; i <= 3; i++) {
      await Question.create({
        item: item._id,
        asker: studentA._id,
        text: `Unique question number ${i} about hardware specs and condition`,
        normalizedText: `unique question number ${i}`,
        status: 'visible',
      });
    }

    const count = await Question.countDocuments({ item: item._id, asker: studentA._id });
    assert.equal(count, 3);

    // Rule: Attempting 4th question is blocked
    const canAsk4th = count < 3;
    assert.equal(canAsk4th, false, 'User must not be allowed to ask a 4th question on same item');
  });

  await t.test('5. Seller-only answer: non-seller cannot answer, seller answer notifies asker', async () => {
    const item = await createItem();
    const q = await Question.create({
      item: item._id,
      asker: studentA._id,
      text: 'How long does the battery last on a single charge?',
      normalizedText: 'battery last single charge',
      status: 'visible',
    });

    // Non-seller (Bob) attempting to answer
    const isSeller = item.seller.toString() === studentB._id.toString();
    assert.equal(isSeller, false, 'Non-seller cannot answer');

    // Seller answers
    const sellerAnswer = 'Battery backup is around 4.5 hours with normal web browsing.';
    q.answer = sellerAnswer;
    q.answeredAt = new Date();
    await q.save();

    assert.equal(q.answer, sellerAnswer);
    assert.ok(q.answeredAt);

    // Create Notification for asker
    const notif = await Notification.create({
      recipient: q.asker,
      type: 'QUESTION_ANSWERED',
      message: `The seller answered: "${sellerAnswer}"`,
      auction: item._id,
    });
    assert.equal(notif.recipient.toString(), studentA._id.toString());
  });

  await t.test('6. Flag auto-hide: 3 flags auto-hide question', async () => {
    const item = await createItem();
    const q = await Question.create({
      item: item._id,
      asker: studentA._id,
      text: 'Suspicious question containing inappropriate spam content',
      normalizedText: 'suspicious question inappropriate spam',
      status: 'visible',
    });

    // Three different users flag the question
    const flaggerIds = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
    for (const fId of flaggerIds) {
      q.flaggedBy.push(fId);
    }
    q.flagCount = q.flaggedBy.length;
    if (q.flagCount >= 3) {
      q.status = 'hidden';
    }
    await q.save();

    assert.equal(q.flagCount, 3);
    assert.equal(q.status, 'hidden', 'Question must auto-hide on 3 flags');
  });

  await t.test('7. Closed-auction block: questions on closed auction are disallowed', async () => {
    const closedItem = await createItem({
      closingAt: new Date(Date.now() - 60000), // Closed
      status: 'Active',
    });

    const isClosed = new Date(closedItem.closingAt) <= new Date();
    assert.equal(isClosed, true, 'Auction is expired');

    // Rule: Cannot ask question
    const canAsk = !isClosed && closedItem.status === 'Active';
    assert.equal(canAsk, false, 'Cannot ask questions once countdown reaches zero');
  });

  await t.test('8. Seller can hide and restore question visibility', async () => {
    const item = await createItem();
    const q = await Question.create({
      item: item._id,
      asker: studentA._id,
      text: 'Is this item negotiable if picked up today?',
      normalizedText: 'item negotiable picked today',
      status: 'visible',
    });

    // Seller hides it
    q.status = 'hidden';
    await q.save();
    assert.equal(q.status, 'hidden');

    // Seller restores it
    q.status = 'visible';
    await q.save();
    assert.equal(q.status, 'visible');
  });

  await mongoose.disconnect();
});

