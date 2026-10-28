require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Item = require('../models/Item');
const Bid = require('../models/Bid');
const Notification = require('../models/Notification');

async function cleanMockData() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_auction';
  console.log(`Connecting to: ${uri}`);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

  const dummyEmails = [
    'seller@campus.edu',
    'bidder1@campus.edu',
    'bidder2@campus.edu',
    'bidder3@campus.edu',
    'admin@campus.edu',
  ];

  // 1. Find dummy users
  const dummyUsers = await User.find({ email: { $in: dummyEmails } });
  const dummyUserIds = dummyUsers.map((u) => u._id);
  console.log(`Found ${dummyUsers.length} dummy seeded users to remove.`);

  // 2. Remove items created by dummy users
  const deletedItems = await Item.deleteMany({ seller: { $in: dummyUserIds } });
  console.log(`Removed ${deletedItems.deletedCount} dummy seeded auction items.`);

  // 3. Remove bids created by dummy users or on deleted items
  const deletedBids = await Bid.deleteMany({
    $or: [{ bidder: { $in: dummyUserIds } }, { auction: { $nin: (await Item.find({}, '_id')).map((i) => i._id) } }],
  });
  console.log(`Removed ${deletedBids.deletedCount} dummy bids.`);

  // 4. Remove notifications for dummy users
  const deletedNotifs = await Notification.deleteMany({ user: { $in: dummyUserIds } });
  console.log(`Removed ${deletedNotifs.deletedCount} dummy notifications.`);

  // 5. Remove dummy users
  const deletedUsers = await User.deleteMany({ _id: { $in: dummyUserIds } });
  console.log(`Removed ${deletedUsers.deletedCount} dummy user accounts.`);

  // Verify remaining data in DB
  const remainingUsers = await User.find({}, 'name email role');
  console.log('\n--- REMAINING REAL USERS IN DATABASE ---');
  remainingUsers.forEach((u) => console.log(`• ${u.name} (${u.email}) [${u.role}]`));

  const remainingItems = await Item.find({}, 'title status startingPrice seller');
  console.log('\n--- REMAINING REAL AUCTION ITEMS IN DATABASE ---');
  if (remainingItems.length === 0) {
    console.log('No items currently. Real users can create listings dynamically!');
  } else {
    remainingItems.forEach((i) => console.log(`• ${i.title} [${i.status}]`));
  }

  await mongoose.disconnect();
  console.log('\nClean-up completed successfully.');
  process.exit(0);
}

cleanMockData().catch((err) => {
  console.error('Clean-up failed:', err);
  process.exit(1);
});

