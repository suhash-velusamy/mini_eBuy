require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const Item = require('../models/Item');
const Bid = require('../models/Bid');
const Notification = require('../models/Notification');
const { toPaise } = require('../utils/money');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Generate sample item SVG images
const createSampleSvg = (filename, label, color, iconEmoji) => {
  const filePath = path.join(uploadsDir, filename);
  if (!fs.existsSync(filePath)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${color};stop-opacity:0.85" />
      <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)" />
  <circle cx="400" cy="260" r="130" fill="white" fill-opacity="0.1" />
  <text x="400" y="290" font-family="Arial, sans-serif" font-size="80" text-anchor="middle" fill="white">${iconEmoji}</text>
  <text x="400" y="440" font-family="'Segoe UI', Roboto, sans-serif" font-size="32" font-weight="bold" text-anchor="middle" fill="#ffffff" letter-spacing="1">${label}</text>
  <text x="400" y="480" font-family="'Segoe UI', Roboto, sans-serif" font-size="18" text-anchor="middle" fill="#94a3b8">Campus Verified Listing • mini eBay</text>
</svg>`;
    fs.writeFileSync(filePath, svg, 'utf8');
  }
  return `/uploads/${filename}`;
};

const sampleImages = {
  bicycle: createSampleSvg('sample-bicycle.svg', 'Hero Sprint Pro 21-Speed', '#0284c7', '🚲'),
  calculator: createSampleSvg('sample-calculator.svg', 'Casio FX-991EX Scientific Calc', '#4f46e5', '🧮'),
  textbook: createSampleSvg('sample-textbook.svg', 'CLRS Algorithms 4th Edition', '#059669', '📚'),
  laptop: createSampleSvg('sample-laptop.svg', 'Dell Inspiron 15 Core i5', '#2563eb', '💻'),
  labcoat: createSampleSvg('sample-labcoat.svg', 'Chemistry Lab Coat & Safety Kit', '#d97706', '🥼'),
  guitar: createSampleSvg('sample-guitar.svg', 'Yamaha F310 Acoustic Guitar', '#ea580c', '🎸'),
  kettle: createSampleSvg('sample-kettle.svg', 'Prestige Electric Kettle 1.5L', '#dc2626', '🫖'),
  headphones: createSampleSvg('sample-headphones.svg', 'Sony WH-CH520 BT Headphones', '#7c3aed', '🎧'),
  badminton: createSampleSvg('sample-badminton.svg', 'Yonex Muscle Power 29 Racket', '#0891b2', '🏸'),
  tablelamp: createSampleSvg('sample-tablelamp.svg', 'Wipro Rechargable LED Study Lamp', '#16a34a', '💡'),
};

const seedDatabase = async () => {
  try {
    const connUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campus_auction';
    console.log(`[Seed] Connecting to MongoDB: ${connUri}...`);
    await mongoose.connect(connUri);
    console.log('[Seed] Connected successfully.');

    // Clear existing collections safely
    console.log('[Seed] Clearing previous data in campus_auction database...');
    await User.deleteMany({});
    await Item.deleteMany({});
    await Bid.deleteMany({});
    await Notification.deleteMany({});

    // 1. Create Users
    console.log('[Seed] Creating demo campus users...');
    const defaultPassword = 'Password123!';
    const passwordHash = await User.hashPassword(defaultPassword);

    const seller = await User.create({
      name: 'John Seller (Senior CSE)',
      email: 'seller@campus.edu',
      passwordHash,
    });

    const bidder1 = await User.create({
      name: 'Alice Bidder (Sophomore ECE)',
      email: 'bidder1@campus.edu',
      passwordHash,
    });

    const bidder2 = await User.create({
      name: 'Bob Bidder (Junior Mech)',
      email: 'bidder2@campus.edu',
      passwordHash,
    });

    const bidder3 = await User.create({
      name: 'Charlie Bidder (Freshman IT)',
      email: 'bidder3@campus.edu',
      passwordHash,
    });

    console.log(`[Seed] Users created:
      - Seller:   seller@campus.edu  / ${defaultPassword}
      - Bidder 1: bidder1@campus.edu / ${defaultPassword}
      - Bidder 2: bidder2@campus.edu / ${defaultPassword}
      - Bidder 3: bidder3@campus.edu / ${defaultPassword}`);

    // Timestamps
    const now = Date.now();
    const twoMinutesFromNow = new Date(now + 2 * 60 * 1000); // For live countdown demo!
    const threeMinutesFromNow = new Date(now + 3 * 60 * 1000);
    const tomorrow = new Date(now + 24 * 60 * 60 * 1000);
    const threeDaysLater = new Date(now + 3 * 24 * 60 * 60 * 1000);
    const fiveDaysLater = new Date(now + 5 * 24 * 60 * 60 * 1000);
    const twoHoursAgo = new Date(now - 2 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000);

    // 2. Sample Auctions
    console.log('[Seed] Creating sample auction listings across all states...');

    // Item 1: Active - Ending in 2 minutes for testing live expiration!
    const item1 = await Item.create({
      seller: seller._id,
      title: 'Hero Sprint Pro 21-Speed Mountain Bicycle',
      category: 'Bicycles & Mobility',
      description: 'Used for 2 semesters to commute between hostel and academic block. Dual disc brakes, Shimano 21 gears, freshly oiled chain, included combination lock. Perfect for campus roads.',
      condition: 'Good',
      photos: [sampleImages.bicycle],
      startingPrice: toPaise(3500), // ₹3,500
      minimumIncrement: toPaise(200), // ₹200
      currentLeadingBid: toPaise(4100), // ₹4,100
      currentLeadingBidder: bidder1._id,
      bidCount: 3,
      closingAt: twoMinutesFromNow,
      status: 'Active',
    });

    // Record bid history for Item 1
    await Bid.create({ auction: item1._id, bidder: bidder2._id, amount: toPaise(3500), createdAt: new Date(now - 30 * 60 * 1000) });
    await Bid.create({ auction: item1._id, bidder: bidder3._id, amount: toPaise(3800), createdAt: new Date(now - 15 * 60 * 1000) });
    await Bid.create({ auction: item1._id, bidder: bidder1._id, amount: toPaise(4100), createdAt: new Date(now - 5 * 60 * 1000) });

    // Item 2: Active - Ending in 3 minutes (No bids yet, test first bid)
    const item2 = await Item.create({
      seller: seller._id,
      title: 'Casio FX-991EX ClassWiz Scientific Calculator',
      category: 'Electronics & Gadgets',
      description: 'Standard scientific calculator for engineering mathematics and exams. 552 functions, high-resolution natural textbook display. Barely used, battery condition 100%.',
      condition: 'Like New',
      photos: [sampleImages.calculator],
      startingPrice: toPaise(850),
      minimumIncrement: toPaise(50),
      currentLeadingBid: null,
      currentLeadingBidder: null,
      bidCount: 0,
      closingAt: threeMinutesFromNow,
      status: 'Active',
    });

    // Item 3: Active - Ending tomorrow
    const item3 = await Item.create({
      seller: seller._id,
      title: 'Introduction to Algorithms (CLRS) 4th Edition',
      category: 'Textbooks & Study Material',
      description: 'The bible of Computer Science algorithms. Hardcover edition in pristine condition with minimal pencil annotations. Vital for Data Structures, Algorithms, and coding interview prep.',
      condition: 'Like New',
      photos: [sampleImages.textbook],
      startingPrice: toPaise(1200),
      minimumIncrement: toPaise(100),
      currentLeadingBid: toPaise(1500),
      currentLeadingBidder: bidder2._id,
      bidCount: 2,
      closingAt: tomorrow,
      status: 'Active',
    });
    await Bid.create({ auction: item3._id, bidder: bidder1._id, amount: toPaise(1200), createdAt: new Date(now - 60 * 60 * 1000) });
    await Bid.create({ auction: item3._id, bidder: bidder2._id, amount: toPaise(1500), createdAt: new Date(now - 20 * 60 * 1000) });

    // Item 4: Active - Ending in 3 days
    const item4 = await Item.create({
      seller: seller._id,
      title: 'Dell Inspiron 15 Core i5 Laptop (16GB RAM / 512GB SSD)',
      category: 'Electronics & Gadgets',
      description: 'Senior passing out and upgrading. Great condition, battery backup around 3.5 hours, original charger and laptop sleeve included. Suitable for coding, web development, and daily coursework.',
      condition: 'Good',
      photos: [sampleImages.laptop],
      startingPrice: toPaise(22000),
      minimumIncrement: toPaise(1000),
      currentLeadingBid: toPaise(24000),
      currentLeadingBidder: bidder3._id,
      bidCount: 2,
      closingAt: threeDaysLater,
      status: 'Active',
    });
    await Bid.create({ auction: item4._id, bidder: bidder1._id, amount: toPaise(22000), createdAt: new Date(now - 3 * 60 * 60 * 1000) });
    await Bid.create({ auction: item4._id, bidder: bidder3._id, amount: toPaise(24000), createdAt: new Date(now - 1 * 60 * 60 * 1000) });

    // Item 5: Active - Sports & Fitness
    const item5 = await Item.create({
      seller: seller._id,
      title: 'Yonex Muscle Power 29 Light Badminton Racket + Cover',
      category: 'Sports & Fitness',
      description: 'Graphite shaft badminton racket with BG65 titanium string tension at 24lbs. Handled with care at campus indoor sports complex. Free pack of 3 nylon shuttlecocks included.',
      condition: 'Good',
      photos: [sampleImages.badminton],
      startingPrice: toPaise(900),
      minimumIncrement: toPaise(50),
      currentLeadingBid: null,
      currentLeadingBidder: null,
      bidCount: 0,
      closingAt: fiveDaysLater,
      status: 'Active',
    });

    // Item 6: Pending Approval (Auction expired with a winner, awaiting seller's decision)
    const item6 = await Item.create({
      seller: seller._id,
      title: 'Yamaha F310 Natural Acoustic Guitar + Padded Gig Bag',
      category: 'Hostel Essentials',
      description: 'Full-size steel string acoustic guitar. Rich warm sound, low action, ideal for hostel jamming and campus music club. Comes with capo, tuner, and picks.',
      condition: 'Good',
      photos: [sampleImages.guitar],
      startingPrice: toPaise(4500),
      minimumIncrement: toPaise(250),
      currentLeadingBid: toPaise(5500),
      currentLeadingBidder: bidder1._id,
      bidCount: 3,
      closingAt: twoHoursAgo,
      status: 'Pending Approval',
      provisionalWinner: bidder1._id,
      winningAmount: toPaise(5500),
    });
    await Bid.create({ auction: item6._id, bidder: bidder2._id, amount: toPaise(4500), createdAt: new Date(now - 5 * 60 * 60 * 1000) });
    await Bid.create({ auction: item6._id, bidder: bidder3._id, amount: toPaise(5000), createdAt: new Date(now - 3 * 60 * 60 * 1000) });
    await Bid.create({ auction: item6._id, bidder: bidder1._id, amount: toPaise(5500), createdAt: new Date(now - 2 * 60 * 60 * 1000) });

    await Notification.create({
      recipient: seller._id,
      type: 'SELLER_APPROVAL_REQUIRED',
      message: 'Auction closed for "Yamaha F310 Natural Acoustic Guitar"! Provisional winning bid of ₹5,500 requires your approval.',
      auction: item6._id,
    });
    await Notification.create({
      recipient: bidder1._id,
      type: 'PROVISIONAL_WIN',
      message: 'Congratulations! You are the provisional winner of "Yamaha F310 Natural Acoustic Guitar" with a bid of ₹5,500. Waiting for seller approval.',
      auction: item6._id,
    });

    // Item 7: Reserved (Seller approved, awaiting campus handover)
    const item7 = await Item.create({
      seller: seller._id,
      title: 'Chemistry / Bio Lab Coat (Size L) & Safety Goggles Kit',
      category: 'Lab Equipment',
      description: 'Mandatory 100% cotton lab coat for B.Tech First Year chemistry and material science labs. Clean, washed, no chemical stains. Includes UV-protective safety glasses.',
      condition: 'Good',
      photos: [sampleImages.labcoat],
      startingPrice: toPaise(300),
      minimumIncrement: toPaise(50),
      currentLeadingBid: toPaise(450),
      currentLeadingBidder: bidder2._id,
      bidCount: 2,
      closingAt: oneDayAgo,
      status: 'Reserved',
      provisionalWinner: bidder2._id,
      winningAmount: toPaise(450),
      sellerDecision: { decision: 'Approved', decidedAt: new Date(now - 12 * 60 * 60 * 1000), reason: 'Price acceptable' },
      reservedAt: new Date(now - 12 * 60 * 60 * 1000),
    });
    await Bid.create({ auction: item7._id, bidder: bidder3._id, amount: toPaise(350), createdAt: new Date(now - 28 * 60 * 60 * 1000) });
    await Bid.create({ auction: item7._id, bidder: bidder2._id, amount: toPaise(450), createdAt: new Date(now - 25 * 60 * 60 * 1000) });

    // Item 8: Sold (Handover completed)
    const item8 = await Item.create({
      seller: seller._id,
      title: 'Prestige 1.5L Stainless Steel Electric Kettle',
      category: 'Hostel Essentials',
      description: 'Fast boiling kettle for midnight Maggie, coffee, and tea in hostel room. Auto cut-off feature, power indicator, 360-degree swivel base.',
      condition: 'Like New',
      photos: [sampleImages.kettle],
      startingPrice: toPaise(400),
      minimumIncrement: toPaise(50),
      currentLeadingBid: toPaise(650),
      currentLeadingBidder: bidder3._id,
      bidCount: 3,
      closingAt: new Date(now - 48 * 60 * 60 * 1000),
      status: 'Sold',
      provisionalWinner: bidder3._id,
      winningAmount: toPaise(650),
      sellerDecision: { decision: 'Approved', decidedAt: new Date(now - 40 * 60 * 60 * 1000) },
      reservedAt: new Date(now - 40 * 60 * 60 * 1000),
      soldAt: new Date(now - 24 * 60 * 60 * 1000),
    });

    // Item 9: Unsold (Closed with no bids)
    const item9 = await Item.create({
      seller: seller._id,
      title: 'Wipro 6W LED Rechargeable Study Lamp',
      category: 'Hostel Essentials',
      description: 'Foldable desk lamp with 3 color temperature modes and touch control. Built-in lithium battery lasts 4 hours on single charge.',
      condition: 'Fair',
      photos: [sampleImages.tablelamp],
      startingPrice: toPaise(500),
      minimumIncrement: toPaise(50),
      currentLeadingBid: null,
      currentLeadingBidder: null,
      bidCount: 0,
      closingAt: oneDayAgo,
      status: 'Unsold',
      outcomeReason: 'Auction ended without any accepted bids',
    });

    // Item 10: Cancelled (Cancelled by seller)
    const item10 = await Item.create({
      seller: seller._id,
      title: 'Sony WH-CH520 Wireless Bluetooth Headphones',
      category: 'Electronics & Gadgets',
      description: '50-hour battery life, lightweight, DSEE sound upscaling. Black color, original type-C cable.',
      condition: 'Good',
      photos: [sampleImages.headphones],
      startingPrice: toPaise(1800),
      minimumIncrement: toPaise(100),
      currentLeadingBid: null,
      currentLeadingBidder: null,
      bidCount: 0,
      closingAt: tomorrow,
      status: 'Cancelled',
      cancellationReason: 'Decided to gift item to roommate instead',
    });

    console.log(`[Seed] Successfully seeded 10 auction listings across all states:
      1. Active (Ending in 2m, 3 bids): Hero Sprint Pro 21-Speed
      2. Active (Ending in 3m, 0 bids): Casio FX-991EX Calculator
      3. Active (Ending in 24h, 2 bids): CLRS Algorithms 4th Edition
      4. Active (Ending in 3d, 2 bids): Dell Inspiron 15 Core i5
      5. Active (Ending in 5d, 0 bids): Yonex Badminton Racket
      6. Pending Approval (Winner: Alice Bidder): Yamaha F310 Guitar
      7. Reserved (Winner: Bob Bidder): Chemistry Lab Coat & Kit
      8. Sold (Winner: Charlie Bidder): Prestige Electric Kettle
      9. Unsold: Wipro LED Study Lamp
      10. Cancelled: Sony Bluetooth Headphones`);

    console.log('[Seed] Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedDatabase();
