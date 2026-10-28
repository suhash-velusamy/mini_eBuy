import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Gavel,
  Clock,
  ShieldCheck,
  User,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ChevronRight,
  TrendingUp,
  Tag,
  Share2,
  MapPin,
  Calendar,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import { auctionApi } from '../api/auctionApi';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import StatusBadge from '../components/StatusBadge';
import CountdownTimer from '../components/CountdownTimer';
import BidHistory from '../components/BidHistory';

const formatINR = (paise) => {
  if (!paise) return '₹0';
  return '₹' + (paise / 100).toLocaleString('en-IN');
};

const AuctionDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();

  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [bidAmountInput, setBidAmountInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [biddingLoading, setBiddingLoading] = useState(false);
  const [bidError, setBidError] = useState('');
  const [bidSuccess, setBidSuccess] = useState('');

  // Seller Action Modals
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showFailedPickupModal, setShowFailedPickupModal] = useState(false);
  const [failedPickupReason, setFailedPickupReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAuctionAndBids = async () => {
    try {
      setLoading(true);
      const [auctionRes, bidsRes] = await Promise.all([
        auctionApi.getAuctionById(id),
        auctionApi.getAuctionBids(id),
      ]);

      if (auctionRes.success) {
        setAuction(auctionRes.auction);

        // Pre-fill bid input with minimum next valid bid in INR
        const minNextINR = auctionRes.auction.currentLeadingBid
          ? (auctionRes.auction.currentLeadingBid + auctionRes.auction.minimumIncrement) / 100
          : auctionRes.auction.startingPrice / 100;
        setBidAmountInput(String(minNextINR));
      }

      if (bidsRes.success) {
        setBids(bidsRes.bids);
      }
    } catch (err) {
      console.error('Error fetching auction details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctionAndBids();
  }, [id]);

  // Real-time socket updates for this auction room
  useEffect(() => {
    if (!socket || !id) return;

    // Join room
    socket.emit('join:auction', id);

    // Listen for new bids
    const handleBidPlaced = (data) => {
      if (data.auctionId === id) {
        setAuction((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentLeadingBid: data.currentLeadingBid,
            currentLeadingBidder: data.newBid?.bidder?._id,
            bidCount: data.bidCount,
          };
        });

        // Add new bid to history top
        setBids((prev) => [data.newBid, ...prev.filter((b) => b._id !== data.newBid._id)]);

        // Update suggested bid input
        const nextMinINR = data.minNextBidINR;
        setBidAmountInput(String(nextMinINR));
      }
    };

    // Listen for status changes (e.g. closed, approved, cancelled)
    const handleStatusChanged = (data) => {
      if (data.auctionId === id) {
        setAuction((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: data.status,
            winningAmount: data.winningAmount || prev.winningAmount,
            sellerDecision: data.sellerDecision || prev.sellerDecision,
            reservedAt: data.reservedAt || prev.reservedAt,
            soldAt: data.soldAt || prev.soldAt,
            outcomeReason: data.outcomeReason || prev.outcomeReason,
          };
        });
      }
    };

    socket.on('bid:placed', handleBidPlaced);
    socket.on('auction:status_changed', handleStatusChanged);

    return () => {
      socket.emit('leave:auction', id);
      socket.off('bid:placed', handleBidPlaced);
      socket.off('auction:status_changed', handleStatusChanged);
    };
  }, [socket, id]);

  const isSeller = user && auction && auction.seller?._id === user._id;
  const isLeadingBidder =
    user && auction && auction.currentLeadingBidder === user._id;

  const minNextBidINR = auction
    ? auction.currentLeadingBid
      ? (auction.currentLeadingBid + auction.minimumIncrement) / 100
      : auction.startingPrice / 100
    : 0;

  // Handle Bid Submission
  const handlePlaceBid = async (e) => {
    e.preventDefault();
    setBidError('');
    setBidSuccess('');

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/auctions/${id}` } } });
      return;
    }

    const numericAmount = parseFloat(bidAmountInput);
    if (isNaN(numericAmount) || numericAmount < minNextBidINR) {
      setBidError(`Your bid must be at least ₹${minNextBidINR.toLocaleString('en-IN')}`);
      return;
    }

    setBiddingLoading(true);

    try {
      const idempotencyKey = `bid_${id}_${user._id}_${Date.now()}`;
      const res = await auctionApi.placeBid(id, numericAmount, idempotencyKey);

      if (res.success) {
        setBidSuccess(`🎉 Bid of ₹${numericAmount.toLocaleString('en-IN')} placed successfully!`);
        // Updated state will also arrive via socket
      }
    } catch (err) {
      setBidError(err.customMessage || err.message || 'Failed to place bid. Please try again.');
    } finally {
      setBiddingLoading(false);
    }
  };

  const addQuickIncrement = (incrementINR) => {
    const current = parseFloat(bidAmountInput) || minNextBidINR;
    setBidAmountInput(String(Math.max(minNextBidINR, current + incrementINR)));
  };

  // Seller Action Handlers
  const handleApproveBid = async () => {
    if (!window.confirm('Are you sure you want to approve this winning bid and reserve the item for campus handover?')) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await auctionApi.approveBid(id, 'Seller accepted winning bid');
      if (res.success) {
        setAuction(res.auction);
      }
    } catch (err) {
      alert(err.customMessage || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectBid = async () => {
    try {
      setActionLoading(true);
      const res = await auctionApi.rejectBid(id, rejectReason);
      if (res.success) {
        setAuction(res.auction);
        setShowRejectModal(false);
      }
    } catch (err) {
      alert(err.customMessage || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmHandover = async () => {
    if (!window.confirm('Confirm that the in-person campus handover has taken place and payment was received?')) {
      return;
    }
    try {
      setActionLoading(true);
      const res = await auctionApi.confirmHandover(id);
      if (res.success) {
        setAuction(res.auction);
      }
    } catch (err) {
      alert(err.customMessage || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleFailedPickup = async () => {
    try {
      setActionLoading(true);
      const res = await auctionApi.recordFailedPickup(id, failedPickupReason);
      if (res.success) {
        setAuction(res.auction);
        setShowFailedPickupModal(false);
      }
    } catch (err) {
      alert(err.customMessage || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelAuction = async () => {
    try {
      setActionLoading(true);
      const res = await auctionApi.cancelAuction(id, cancelReason);
      if (res.success) {
        setAuction(res.auction);
        setShowCancelModal(false);
      }
    } catch (err) {
      alert(err.customMessage || err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-slate-200 rounded w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-7 aspect-[4/3] bg-slate-200 rounded-2xl" />
            <div className="lg:col-span-5 space-y-4">
              <div className="h-8 bg-slate-200 rounded w-3/4" />
              <div className="h-32 bg-slate-200 rounded-xl" />
              <div className="h-40 bg-slate-200 rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!auction) {
    return (
      <div className="max-w-xl mx-auto text-center py-20 px-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-slate-900">Auction Listing Not Found</h2>
        <p className="text-xs text-slate-500 mt-1">
          This auction may have been removed or does not exist.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Browse</span>
        </Link>
      </div>
    );
  }

  const photos = auction.photos && auction.photos.length > 0 ? auction.photos : ['/placeholder.svg'];

  return (
    <div className="min-h-screen pb-20">
      {/* Breadcrumb Bar */}
      <div className="bg-white border-b border-slate-200/80 py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Link to="/" className="hover:text-blue-600 transition-colors flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Auctions</span>
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span>{auction.category}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
            <span className="font-semibold text-slate-800 truncate max-w-xs">{auction.title}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10">
          {/* LEFT COLUMN: Photos & Item Description */}
          <div className="lg:col-span-7 space-y-6">
            {/* Main Photo Card */}
            <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm p-4">
              <div className="relative aspect-[4/3] rounded-2xl bg-slate-100 overflow-hidden">
                <img
                  src={photos[selectedPhotoIndex]}
                  alt={auction.title}
                  className="w-full h-full object-cover transition-all duration-300"
                  onError={(e) => {
                    e.target.src =
                      'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=60';
                  }}
                />
                <div className="absolute top-3 left-3">
                  <StatusBadge status={auction.status} size="md" />
                </div>
              </div>

              {/* Thumbnail Selector */}
              {photos.length > 1 && (
                <div className="flex items-center gap-3 mt-4 overflow-x-auto pb-1">
                  {photos.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedPhotoIndex(idx)}
                      className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 transition-all flex-shrink-0 ${
                        selectedPhotoIndex === idx
                          ? 'border-blue-600 shadow-md ring-2 ring-blue-500/20'
                          : 'border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={p} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Item Details and Specifications */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-6">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {auction.category}
                  </span>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                    Condition: {auction.condition}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                  {auction.title}
                </h1>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-2">
                  Item Description
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {auction.description}
                </p>
              </div>

              {/* Campus Handover & Seller Info Box */}
              <div className="pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm flex-shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Listed By Student
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      {auction.seller?.name || 'Verified Student'}
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Verified College Member
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                      Pickup Location
                    </span>
                    <span className="font-bold text-sm text-slate-900">
                      Campus Handover
                    </span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">
                      Public campus spot arranged after auction
                    </span>
                  </div>
                </div>
              </div>

              {/* Outcome Reason if Cancelled, Rejected, or Failed Pickup */}
              {auction.cancellationReason && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  <span className="font-bold">Cancellation Reason: </span>
                  {auction.cancellationReason}
                </div>
              )}
              {auction.outcomeReason && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  <span className="font-bold">Outcome Details: </span>
                  {auction.outcomeReason}
                </div>
              )}
            </div>

            {/* Public Bid History Section */}
            <BidHistory bids={bids} currentWinningBidderId={auction.currentLeadingBidder} />
          </div>

          {/* RIGHT COLUMN: Bidding Box, Live Timer & Seller Actions */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Timer Card */}
            {auction.status === 'Active' && (
              <CountdownTimer targetDate={auction.closingAt} variant="full" />
            )}

            {/* Price & Bidding Action Box */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/50 p-6 sm:p-7 space-y-6">
              {/* Pricing overview */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {auction.currentLeadingBid ? 'Current Leading Bid' : 'Starting Bid'}
                  </span>
                  <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                    {formatINR(auction.currentLeadingBid || auction.startingPrice)}
                  </span>
                </div>

                <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-xs text-slate-600">
                  <span>Minimum Bid Increment:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {formatINR(auction.minimumIncrement)}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Minimum Valid Next Bid:</span>
                  <span className="font-bold text-blue-700 font-mono bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                    ₹{minNextBidINR.toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span>Total Bids Placed:</span>
                  <span className="font-semibold text-slate-900">
                    {auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}
                  </span>
                </div>
              </div>

              {/* Status Notice Banners */}
              {isLeadingBidder && auction.status === 'Active' && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="font-semibold">
                    You are currently the leading bidder for this auction!
                  </span>
                </div>
              )}

              {auction.status === 'Pending Approval' && (
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>Auction Closed — Awaiting Seller Approval</span>
                  </div>
                  <p>
                    Winning Amount:{' '}
                    <span className="font-mono font-bold">
                      {formatINR(auction.winningAmount || auction.currentLeadingBid)}
                    </span>
                  </p>
                  {auction.provisionalWinner && (
                    <p>
                      Provisional Winner:{' '}
                      <span className="font-semibold">{auction.provisionalWinner.name}</span>
                    </p>
                  )}
                </div>
              )}

              {auction.status === 'Reserved' && (
                <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200 text-purple-900 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <ShieldCheck className="w-4 h-4 text-purple-600" />
                    <span>Item Reserved for Campus Handover</span>
                  </div>
                  <p className="leading-relaxed">
                    The seller accepted the final bid of{' '}
                    <span className="font-bold font-mono">
                      {formatINR(auction.winningAmount || auction.currentLeadingBid)}
                    </span>
                    . Both parties can arrange the in-person campus handover.
                  </p>
                </div>
              )}

              {auction.status === 'Sold' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-700">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Sale Completed!</span>
                  </div>
                  <p>
                    Sold for{' '}
                    <span className="font-bold font-mono">
                      {formatINR(auction.winningAmount || auction.currentLeadingBid)}
                    </span>
                  </p>
                  {auction.soldAt && (
                    <p className="text-[11px] text-emerald-700">
                      Completed on {new Date(auction.soldAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              )}

              {/* Bidding Form (Only active when auction is Active and user is NOT seller) */}
              {auction.status === 'Active' && !isSeller && (
                <form onSubmit={handlePlaceBid} className="space-y-4">
                  {bidError && (
                    <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>{bidError}</span>
                    </div>
                  )}

                  {bidSuccess && (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                      <span>{bidSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Enter Your Bid Amount (₹)
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">
                        ₹
                      </span>
                      <input
                        type="number"
                        step="any"
                        required
                        value={bidAmountInput}
                        onChange={(e) => setBidAmountInput(e.target.value)}
                        placeholder={`Minimum ₹${minNextBidINR}`}
                        className="w-full pl-8 pr-4 py-3 rounded-xl border border-slate-300 font-mono font-bold text-base focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition-all"
                      />
                    </div>
                  </div>

                  {/* Quick Increment Buttons */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      Quick Add:
                    </span>
                    <button
                      type="button"
                      onClick={() => addQuickIncrement(50)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all"
                    >
                      +₹50
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuickIncrement(100)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all"
                    >
                      +₹100
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuickIncrement(500)}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all"
                    >
                      +₹500
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={biddingLoading}
                    className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-sm shadow-lg shadow-blue-500/20 hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {biddingLoading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Gavel className="w-4 h-4" />
                        <span>Place Verified Bid Now</span>
                      </>
                    )}
                  </button>

                  <p className="text-[11px] text-center text-slate-400">
                    Bids cannot be withdrawn once committed. Handled via atomic concurrency.
                  </p>
                </form>
              )}

              {/* Notice if user is the seller */}
              {isSeller && (
                <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-1">
                  <p className="font-bold">You are the seller of this listing.</p>
                  <p className="text-slate-600">
                    You cannot bid on your own item. Use the seller control panel below to manage this
                    auction.
                  </p>
                </div>
              )}

              {/* Guest notice */}
              {!isAuthenticated && auction.status === 'Active' && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
                  <p className="text-xs text-slate-600 font-medium">
                    You must be logged in with your college account to place bids.
                  </p>
                  <Link
                    to="/login"
                    state={{ from: { pathname: `/auctions/${id}` } }}
                    className="inline-block w-full py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-sm hover:bg-blue-700 transition-all"
                  >
                    Sign In to Place a Bid
                  </Link>
                </div>
              )}
            </div>

            {/* SELLER CONTROL PANEL (Only visible to the seller of this listing) */}
            {isSeller && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>Seller Control Panel</span>
                </h3>

                {/* Cancel listing button (Active only) */}
                {auction.status === 'Active' && (
                  <button
                    onClick={() => setShowCancelModal(true)}
                    className="w-full py-2.5 px-4 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all text-center"
                  >
                    Cancel Listing
                  </button>
                )}

                {/* Approve or Reject Provisional Win (Pending Approval only) */}
                {auction.status === 'Pending Approval' && (
                  <div className="space-y-2">
                    <button
                      onClick={handleApproveBid}
                      disabled={actionLoading}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      ✓ Approve Winning Bid (Reserve Item)
                    </button>
                    <button
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                      className="w-full py-2.5 px-4 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all"
                    >
                      ✕ Reject Winning Bid
                    </button>
                  </div>
                )}

                {/* Confirm Handover or Record Failed Pickup (Reserved only) */}
                {auction.status === 'Reserved' && (
                  <div className="space-y-2">
                    <button
                      onClick={handleConfirmHandover}
                      disabled={actionLoading}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      🤝 Confirm Campus Handover Completed (Mark Sold)
                    </button>
                    <button
                      onClick={() => setShowFailedPickupModal(true)}
                      disabled={actionLoading}
                      className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all"
                    >
                      ⚠️ Record Failed Pickup
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL: Cancel Auction */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Cancel Auction Listing</h4>
            <p className="text-xs text-slate-500">
              Please provide a reason for cancelling this auction. Any active bidders will be notified.
            </p>
            <textarea
              rows="3"
              required
              placeholder="e.g. Decided to keep item, or item damaged"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={actionLoading || !cancelReason.trim()}
                onClick={handleCancelAuction}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50"
              >
                Confirm Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Reject Bid */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Reject Provisional Winning Bid</h4>
            <p className="text-xs text-slate-500">
              Provide a reason for rejecting the highest bid. The bidder will be notified.
            </p>
            <textarea
              rows="3"
              placeholder="e.g. Final amount was below reserve expectations"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleRejectBid}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700"
              >
                Reject Bid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Failed Pickup */}
      {showFailedPickupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-base font-bold text-slate-900">Record Failed Campus Pickup</h4>
            <p className="text-xs text-slate-500">
              State the reason why the campus handover could not be completed. Full audit history will be preserved.
            </p>
            <textarea
              rows="3"
              placeholder="e.g. Buyer did not show up or communicate for 48 hours"
              value={failedPickupReason}
              onChange={(e) => setFailedPickupReason(e.target.value)}
              className="w-full p-3 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowFailedPickupModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleFailedPickup}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900"
              >
                Save Outcome
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuctionDetails;
