/**
 * CampusBid / Campus Auction - Core Rules & State Machine Unit Tests
 * Uses Node.js native test runner (node:test, node:assert)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { toPaise, toINR, formatINR } = require('../utils/money');

describe('1. Currency & Precision Arithmetic (Paise ↔ Rupee)', () => {
  it('converts decimal and integer rupees to integer paise accurately', () => {
    assert.equal(toPaise(10), 1000);
    assert.equal(toPaise(99.5), 9950);
    assert.equal(toPaise(1250.75), 125075);
    assert.equal(toPaise('500'), 50000);
    assert.equal(toPaise(0), 0);
  });

  it('converts integer paise back to rupees', () => {
    assert.equal(toINR(1000), 10);
    assert.equal(toINR(9950), 99.5);
    assert.equal(toINR(125075), 1250.75);
    assert.equal(toINR(0), 0);
  });

  it('formats rupees with Indian currency symbol and notation', () => {
    assert.equal(formatINR(120000), '₹1,200');
    assert.equal(formatINR(10000000), '₹1,00,000');
    assert.equal(formatINR(5000), '₹50');
  });

  it('safely handles non-finite or empty inputs', () => {
    assert.equal(toPaise(null), 0);
    assert.equal(toPaise(undefined), 0);
    assert.equal(toPaise('abc'), 0);
    assert.equal(toINR(null), 0);
  });
});

describe('2. Bidding Validation Rules', () => {
  const sellerId = 'user_seller_123';
  const buyer1Id = 'user_buyer_456';
  const buyer2Id = 'user_buyer_789';

  function validateBid({ auction, bidderId, bidAmountRupees }) {
    if (!auction) return { allowed: false, reason: 'Auction not found' };
    if (auction.status !== 'Active') {
      return { allowed: false, reason: `Auction is ${auction.status}, not open for bidding` };
    }
    const now = Date.now();
    if (new Date(auction.closingAt).getTime() <= now) {
      return { allowed: false, reason: 'Auction has already closed' };
    }
    if (String(auction.seller) === String(bidderId)) {
      return { allowed: false, reason: 'Sellers cannot bid on their own listings' };
    }

    const bidPaise = toPaise(bidAmountRupees);
    if (!bidPaise || bidPaise <= 0) {
      return { allowed: false, reason: 'Bid amount must be a positive number' };
    }

    const minRequiredPaise = auction.bidsCount === 0
      ? auction.startingPricePaise
      : auction.currentPricePaise + auction.minIncrementPaise;

    if (bidPaise < minRequiredPaise) {
      return {
        allowed: false,
        reason: `Bid must be at least ₹${minRequiredPaise / 100}`,
      };
    }

    return { allowed: true, bidPaise };
  }

  it('rejects self-bidding by the listing seller', () => {
    const auction = {
      status: 'Active',
      closingAt: new Date(Date.now() + 60000),
      seller: sellerId,
      startingPricePaise: 50000,
      currentPricePaise: 50000,
      minIncrementPaise: 5000,
      bidsCount: 0,
    };
    const result = validateBid({ auction, bidderId: sellerId, bidAmountRupees: 600 });
    assert.equal(result.allowed, false);
    assert.match(result.reason, /Sellers cannot bid on their own listings/);
  });

  it('rejects bids on expired auctions', () => {
    const auction = {
      status: 'Active',
      closingAt: new Date(Date.now() - 5000), // closed 5s ago
      seller: sellerId,
      startingPricePaise: 50000,
      currentPricePaise: 50000,
      minIncrementPaise: 5000,
      bidsCount: 0,
    };
    const result = validateBid({ auction, bidderId: buyer1Id, bidAmountRupees: 600 });
    assert.equal(result.allowed, false);
    assert.match(result.reason, /already closed/);
  });

  it('rejects bids on non-active statuses', () => {
    const auction = {
      status: 'Pending Approval',
      closingAt: new Date(Date.now() + 60000),
      seller: sellerId,
      startingPricePaise: 50000,
      currentPricePaise: 50000,
      minIncrementPaise: 5000,
      bidsCount: 1,
    };
    const result = validateBid({ auction, bidderId: buyer1Id, bidAmountRupees: 600 });
    assert.equal(result.allowed, false);
    assert.match(result.reason, /not open for bidding/);
  });

  it('enforces starting price on the first bid', () => {
    const auction = {
      status: 'Active',
      closingAt: new Date(Date.now() + 60000),
      seller: sellerId,
      startingPricePaise: 50000, // ₹500
      currentPricePaise: 50000,
      minIncrementPaise: 5000,  // ₹50
      bidsCount: 0,
    };
    // ₹450 should fail
    const tooLow = validateBid({ auction, bidderId: buyer1Id, bidAmountRupees: 450 });
    assert.equal(tooLow.allowed, false);

    // Exact ₹500 should pass
    const exact = validateBid({ auction, bidderId: buyer1Id, bidAmountRupees: 500 });
    assert.equal(exact.allowed, true);
    assert.equal(exact.bidPaise, 50000);
  });

  it('enforces minimum increment on subsequent bids', () => {
    const auction = {
      status: 'Active',
      closingAt: new Date(Date.now() + 60000),
      seller: sellerId,
      startingPricePaise: 50000,
      currentPricePaise: 70000, // current ₹700
      minIncrementPaise: 5000,  // min increment ₹50 -> next minimum ₹750
      bidsCount: 2,
    };
    const tooLow = validateBid({ auction, bidderId: buyer2Id, bidAmountRupees: 740 });
    assert.equal(tooLow.allowed, false);
    assert.match(tooLow.reason, /at least ₹750/);

    const validBid = validateBid({ auction, bidderId: buyer2Id, bidAmountRupees: 750 });
    assert.equal(validBid.allowed, true);
  });
});

describe('3. Auction Lifecycle State Machine', () => {
  const allowedTransitions = {
    Active: ['Pending Approval', 'Unsold', 'Cancelled'],
    'Pending Approval': ['Reserved', 'Unsold', 'Active'],
    Reserved: ['Sold', 'Active', 'Unsold'],
    Sold: [],
    Unsold: ['Active'], // Relist allowed
    Cancelled: [],
  };

  function canTransition(currentStatus, nextStatus) {
    const targets = allowedTransitions[currentStatus] || [];
    return targets.includes(nextStatus);
  }

  it('allows Active -> Pending Approval when countdown completes with bids', () => {
    assert.equal(canTransition('Active', 'Pending Approval'), true);
  });

  it('allows Active -> Unsold when countdown completes with zero bids', () => {
    assert.equal(canTransition('Active', 'Unsold'), true);
  });

  it('allows Active -> Cancelled if seller cancels before bids', () => {
    assert.equal(canTransition('Active', 'Cancelled'), true);
  });

  it('allows Pending Approval -> Reserved when seller accepts highest bid', () => {
    assert.equal(canTransition('Pending Approval', 'Reserved'), true);
  });

  it('allows Reserved -> Sold when handover is completed on campus', () => {
    assert.equal(canTransition('Reserved', 'Sold'), true);
  });

  it('prevents direct transition from Active to Sold', () => {
    assert.equal(canTransition('Active', 'Sold'), false);
  });

  it('prevents any modification on Sold or Cancelled terminal states', () => {
    assert.equal(canTransition('Sold', 'Active'), false);
    assert.equal(canTransition('Cancelled', 'Active'), false);
  });
});
