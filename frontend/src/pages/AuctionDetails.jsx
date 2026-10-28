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
  Handshake,
  Zap,
  Bot,
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

  // Bidder Confirmation Modal
  const [showBidConfirmModal, setShowBidConfirmModal] = useState(false);
  const [pendingBidAmount, setPendingBidAmount] = useState(0);
  const [extensionNotice, setExtensionNotice] = useState('');

  // Phase 2 Automatic Proxy Bidding State
  const [autoBidders, setAutoBidders] = useState([]);
  const [autoBidMaxInput, setAutoBidMaxInput] = useState('');
  const [autoBidLoading, setAutoBidLoading] = useState(false);
  const [autoBidError, setAutoBidError] = useState('');
  const [autoBidSuccess, setAutoBidSuccess] = useState('');
  const [showAutoBidForm, setShowAutoBidForm] = useState(false);

  // Seller Action Custom Modals (No native browser alerts/confirms!)
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [targetBidToApprove, setTargetBidToApprove] = useState(null);
  const [handoverMeetingNote, setHandoverMeetingNote] = useState('');
  const [showHandoverModal, setShowHandoverModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showFailedPickupModal, setShowFailedPickupModal] = useState(false);
  const [failedPickupReason, setFailedPickupReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  const fetchAuctionAndBids = async () => {
    try {
      setLoading(true);
      const [auctionRes, bidsRes, autoBidsRes] = await Promise.all([
        auctionApi.getAuctionById(id),
        auctionApi.getAuctionBids(id),
        auctionApi.getAutoBids(id),
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

      if (autoBidsRes.success) {
        setAutoBidders(autoBidsRes.autoBidders || []);
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

    // Listen for Phase 1 auctionExtended event
    const handleAuctionExtended = (data) => {
      if (data.itemId === id || data.auctionId === id) {
        setAuction((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            closingAt: data.closesAt || data.closingAt,
            extensionCount: data.extensionCount || (prev.extensionCount || 0) + 1,
          };
        });
        setExtensionNotice('⏱️ Last-minute bid! Auction extended by +60 seconds.');
        setTimeout(() => setExtensionNotice(''), 7000);
      }
    };

    // Listen for Phase 2 autoBidUpdated event
    const handleAutoBidUpdated = (data) => {
      if (data.itemId === id || data.auctionId === id) {
        setAutoBidders(data.autoBidders || []);
      }
    };

    socket.on('bid:placed', handleBidPlaced);
    socket.on('newBid', handleBidPlaced);
    socket.on('autoBidUpdated', handleAutoBidUpdated);
    socket.on('auctionExtended', handleAuctionExtended);
    socket.on('auction:status_changed', handleStatusChanged);

    return () => {
      socket.emit('leave:auction', id);
      socket.off('bid:placed', handleBidPlaced);
      socket.off('newBid', handleBidPlaced);
      socket.off('autoBidUpdated', handleAutoBidUpdated);
      socket.off('auctionExtended', handleAuctionExtended);
      socket.off('auction:status_changed', handleStatusChanged);
    };
  }, [socket, id]);

  const sellerId = typeof auction?.seller === 'object' ? auction?.seller?._id : auction?.seller;
  const isSeller = Boolean(user && sellerId && String(sellerId) === String(user._id));
  const isLeadingBidder =
    user && auction && (auction.currentLeadingBidder === user._id || auction.provisionalWinner?._id === user._id);

  const minNextBidINR = auction
    ? auction.currentLeadingBid
      ? (auction.currentLeadingBid + auction.minimumIncrement) / 100
      : auction.startingPrice / 100
    : 0;

  // Handle Bid Submission - Opens Confirmation Modal (Zero native browser prompts)
  const handlePlaceBid = (e) => {
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

    setPendingBidAmount(numericAmount);
    setShowBidConfirmModal(true);
  };

  const handleExecuteBid = async () => {
    setBiddingLoading(true);
    setBidError('');

    try {
      const idempotencyKey = `bid_${id}_${user._id}_${Date.now()}`;
      const res = await auctionApi.placeBid(id, pendingBidAmount, idempotencyKey);

      if (res.success) {
        setShowBidConfirmModal(false);
        setBidSuccess(`🎉 Bid of ₹${pendingBidAmount.toLocaleString('en-IN')} placed successfully!`);
        // Updated state will also arrive via socket
      }
    } catch (err) {
      setShowBidConfirmModal(false);
      setBidError(err.customMessage || err.message || 'Failed to place bid. Please try again.');
    } finally {
      setBiddingLoading(false);
    }
  };

  const addQuickIncrement = (incrementINR) => {
    const current = parseFloat(bidAmountInput) || minNextBidINR;
    setBidAmountInput(String(Math.max(minNextBidINR, current + incrementINR)));
  };

  // Phase 2: Automatic Proxy Bidding Handlers
  const myAutoBid = autoBidders.find((ab) => String(ab.user?._id) === String(user?._id));

  const handleSetAutoBid = async (e) => {
    e.preventDefault();
    setAutoBidError('');
    setAutoBidSuccess('');

    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: `/auctions/${id}` } } });
      return;
    }

    const numericMax = parseFloat(autoBidMaxInput);
    if (isNaN(numericMax) || numericMax < minNextBidINR) {
      setAutoBidError(`Your maximum bid must be at least ₹${minNextBidINR.toLocaleString('en-IN')}`);
      return;
    }

    setAutoBidLoading(true);
    try {
      const res = await auctionApi.setAutoBid(id, numericMax);
      if (res.success) {
        setAutoBidSuccess(`🤖 Automatic bid set up to ₹${numericMax.toLocaleString('en-IN')}!`);
        setAutoBidMaxInput('');
        setShowAutoBidForm(false);
        const [aRes, bRes, abRes] = await Promise.all([
          auctionApi.getAuctionById(id),
          auctionApi.getAuctionBids(id),
          auctionApi.getAutoBids(id),
        ]);
        if (aRes.success) setAuction(aRes.auction);
        if (bRes.success) setBids(bRes.bids);
        if (abRes.success) setAutoBidders(abRes.autoBidders || []);
      }
    } catch (err) {
      setAutoBidError(err.customMessage || err.message || 'Failed to set automatic bid.');
    } finally {
      setAutoBidLoading(false);
    }
  };

  const handleCancelAutoBid = async () => {
    setAutoBidError('');
    setAutoBidSuccess('');
    setAutoBidLoading(true);
    try {
      const res = await auctionApi.deleteAutoBid(id);
      if (res.success) {
        setAutoBidSuccess('Automatic bid cancelled successfully.');
        const abRes = await auctionApi.getAutoBids(id);
        if (abRes.success) setAutoBidders(abRes.autoBidders || []);
      }
    } catch (err) {
      setAutoBidError(err.customMessage || err.message || 'Failed to cancel automatic bid.');
    } finally {
      setAutoBidLoading(false);
    }
  };

  // Seller Custom Modal Action Handlers (Zero native window.confirm / alerts)
  const openApproveModal = (bidToApprove) => {
    setTargetBidToApprove(bidToApprove || null);
    setActionError('');
    setShowApproveModal(true);
  };

  const handleExecuteApprove = async () => {
    try {
      setActionLoading(true);
      setActionError('');
      const note = handoverMeetingNote.trim() || 'Campus Handover arranged by seller';
      const res = await auctionApi.approveBid(id, note);
      if (res.success) {
        setAuction(res.auction);
        setShowApproveModal(false);
        setActionSuccess('🎉 Winning bid approved! Item is now Reserved for campus handover.');
        const bidsRes = await auctionApi.getAuctionBids(id);
        if (bidsRes.success) setBids(bidsRes.bids);
      }
    } catch (err) {
      setActionError(err.customMessage || err.message || 'Failed to approve bid.');
    } finally {
      setActionLoading(false);
    }
  };

  const openRejectModal = () => {
    setActionError('');
    setRejectReason('');
    setShowRejectModal(true);
  };

  const handleExecuteReject = async () => {
    try {
      setActionLoading(true);
      setActionError('');
      const res = await auctionApi.rejectBid(id, rejectReason);
      if (res.success) {
        setAuction(res.auction);
        setShowRejectModal(false);
        setRejectReason('');
        setActionSuccess('Bid rejected. Auction leading price updated.');
        const bidsRes = await auctionApi.getAuctionBids(id);
        if (bidsRes.success) setBids(bidsRes.bids);
      }
    } catch (err) {
      setActionError(err.customMessage || err.message || 'Failed to reject bid.');
    } finally {
      setActionLoading(false);
    }
  };

  const openHandoverModal = () => {
    setActionError('');
    setShowHandoverModal(true);
  };

  const handleExecuteHandover = async () => {
    try {
      setActionLoading(true);
      setActionError('');
      const res = await auctionApi.confirmHandover(id);
      if (res.success) {
        setAuction(res.auction);
        setShowHandoverModal(false);
        setActionSuccess('🤝 Campus handover confirmed! Item marked as Sold.');
      }
    } catch (err) {
      setActionError(err.customMessage || err.message || 'Failed to confirm handover.');
    } finally {
      setActionLoading(false);
    }
  };

  const openFailedPickupModal = () => {
    setActionError('');
    setFailedPickupReason('');
    setShowFailedPickupModal(true);
  };

  const handleExecuteFailedPickup = async () => {
    try {
      setActionLoading(true);
      setActionError('');
      const res = await auctionApi.recordFailedPickup(id, failedPickupReason);
      if (res.success) {
        setAuction(res.auction);
        setShowFailedPickupModal(false);
        setActionSuccess('Failed pickup outcome recorded.');
      }
    } catch (err) {
      setActionError(err.customMessage || err.message || 'Failed to record pickup status.');
    } finally {
      setActionLoading(false);
    }
  };

  const openCancelModal = () => {
    setActionError('');
    setCancelReason('');
    setShowCancelModal(true);
  };

  const handleExecuteCancel = async () => {
    try {
      setActionLoading(true);
      setActionError('');
      const res = await auctionApi.cancelAuction(id, cancelReason);
      if (res.success) {
        setAuction(res.auction);
        setShowCancelModal(false);
        setActionSuccess('Auction listing has been cancelled.');
      }
    } catch (err) {
      setActionError(err.customMessage || err.message || 'Failed to cancel auction.');
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
                    e.target.src = '/placeholder.svg';
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
            <BidHistory
              bids={bids}
              currentWinningBidderId={auction.currentLeadingBidder}
              canManageBids={isSeller && (auction.status === 'Active' || auction.status === 'Pending Approval')}
              onAcceptBid={openApproveModal}
              onRejectBid={openRejectModal}
              actionLoading={actionLoading}
            />
          </div>

          {/* RIGHT COLUMN: Bidding Box, Live Timer & Seller Actions */}
          <div className="lg:col-span-5 space-y-6">
            {/* Live Timer Card */}
            {auction.status === 'Active' && (
              <div className="space-y-2">
                <CountdownTimer
                  targetDate={auction.closingAt}
                  variant="full"
                  extensionCount={auction.extensionCount || 0}
                />
                {extensionNotice && (
                  <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold flex items-center gap-2 animate-pulse">
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>{extensionNotice}</span>
                  </div>
                )}
              </div>
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

                  {/* Dynamic Increment Buttons based on item's minimum increment */}
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase">
                      Quick Add:
                    </span>
                    <button
                      type="button"
                      onClick={() => addQuickIncrement(Math.max(1, Math.round(auction.minimumIncrement / 100)))}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all"
                    >
                      +₹{Math.max(1, Math.round(auction.minimumIncrement / 100))}
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuickIncrement(Math.max(1, Math.round(auction.minimumIncrement / 100) * 2))}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all"
                    >
                      +₹{Math.max(1, Math.round(auction.minimumIncrement / 100) * 2)}
                    </button>
                    <button
                      type="button"
                      onClick={() => addQuickIncrement(Math.max(1, Math.round(auction.minimumIncrement / 100) * 5))}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition-all"
                    >
                      +₹{Math.max(1, Math.round(auction.minimumIncrement / 100) * 5)}
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

              {/* PHASE 2: AUTOMATIC PROXY BIDDING CONTROLS */}
              {!isSeller && isAuthenticated && auction.status === 'Active' && (
                <div className="pt-4 border-t border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        Automatic Bidding (Proxy)
                      </h4>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                      Server Managed
                    </span>
                  </div>

                  {autoBidError && (
                    <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{autoBidError}</span>
                    </div>
                  )}
                  {autoBidSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                      <span>{autoBidSuccess}</span>
                    </div>
                  )}

                  {myAutoBid ? (
                    <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Your Current Maximum:</span>
                        <span className="font-mono font-extrabold text-amber-900 text-base">
                          ₹{myAutoBid.maxAmountINR.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <p className="text-[11px] text-amber-900/80 leading-relaxed">
                        The system will automatically counter-bid on your behalf up to your max.
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAutoBidForm(!showAutoBidForm)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>Raise Maximum</span>
                        </button>
                        <button
                          type="button"
                          disabled={autoBidLoading}
                          onClick={handleCancelAutoBid}
                          className="px-3 py-1.5 rounded-xl border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-xs transition-all"
                        >
                          Cancel Auto-Bid
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Set a ceiling price. The system bids for you incrementally only when needed to keep you in the lead.
                    </p>
                  )}

                  {(!myAutoBid || showAutoBidForm) && (
                    <form onSubmit={handleSetAutoBid} className="space-y-2 pt-1">
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                            ₹
                          </span>
                          <input
                            type="number"
                            step="any"
                            required
                            value={autoBidMaxInput}
                            onChange={(e) => setAutoBidMaxInput(e.target.value)}
                            placeholder={`Enter max (min ₹${minNextBidINR})`}
                            className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-600"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={autoBidLoading}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 disabled:opacity-50"
                        >
                          {autoBidLoading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5 text-amber-400" />
                              <span>{myAutoBid ? 'Raise Max' : 'Set Auto-Bid'}</span>
                            </>
                          )}
                        </button>
                      </div>
                      <span className="text-[10px] text-slate-400 block">
                        Rule: Maximums can be raised, but never lowered. Maximums are public.
                      </span>
                    </form>
                  )}
                </div>
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

            {/* Public Automatic Bidders Panel */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                    Active Auto-Bidders ({autoBidders.length})
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                  Public Maximums
                </span>
              </div>

              <p className="text-xs text-slate-500 italic">
                Maximums are public on this platform. The proxy system automatically outbids up to each bidder's limit.
              </p>

              {autoBidders.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  No automatic proxy bidders registered for this item yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {autoBidders.map((ab, idx) => {
                    const isMe = user && String(ab.user?._id) === String(user._id);
                    return (
                      <div
                        key={ab._id || idx}
                        className={`p-3 rounded-2xl border flex items-center justify-between text-xs transition-all ${
                          isMe
                            ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                            : 'bg-slate-50 border-slate-100 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-xl bg-amber-100 text-amber-700 font-bold flex items-center justify-center text-xs">
                            {idx + 1}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 flex items-center gap-1.5">
                              {ab.user?.name || 'Student Bidder'}
                              {isMe && (
                                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-1.5 py-0.5 rounded-md">
                                  You
                                </span>
                              )}
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Registered {new Date(ab.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] font-semibold text-slate-400 block uppercase">
                            Ceiling Max
                          </span>
                          <span className="font-mono font-bold text-sm text-slate-900">
                            ₹{ab.maxAmountINR?.toLocaleString('en-IN') || (ab.maxAmount / 100).toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Success Feedback Banner */}
            {actionSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between gap-3 shadow-sm animate-fadeIn">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                  <span className="font-bold">{actionSuccess}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setActionSuccess('')}
                  className="text-emerald-700 hover:text-emerald-900 font-bold"
                >
                  ✕
                </button>
              </div>
            )}

            {/* SELLER CONTROL PANEL (Only visible to the seller of this listing) */}
            {isSeller && (
              <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <span>Seller Control Panel</span>
                  </h3>
                  <StatusBadge status={auction.status} size="sm" />
                </div>

                {/* 1. ACTIVE AUCTION WITH BIDS OR ZERO BIDS */}
                {auction.status === 'Active' && (
                  <div className="space-y-3">
                    {auction.currentLeadingBid ? (
                      <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200/80 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wider">
                            Current Highest Bid
                          </span>
                          <span className="font-mono font-bold text-base text-blue-900">
                            {formatINR(auction.currentLeadingBid)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 leading-snug">
                          You can accept and reserve this bid now to close the auction early, or reject it to fall back to the previous bid.
                        </p>
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => openApproveModal()}
                            disabled={actionLoading}
                            className="w-full py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Accept Bid</span>
                          </button>

                          <button
                            type="button"
                            onClick={openRejectModal}
                            disabled={actionLoading}
                            className="w-full py-2.5 px-3 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Bid</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                        No bids placed yet. You can cancel this listing if needed.
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={openCancelModal}
                      className="w-full py-2 px-3 rounded-xl border border-slate-200 hover:border-rose-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-semibold transition-all text-center"
                    >
                      Cancel Listing
                    </button>
                  </div>
                )}

                {/* 2. PENDING APPROVAL (Auction countdown ended with bids) */}
                {auction.status === 'Pending Approval' && (
                  <div className="space-y-2">
                    <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs space-y-1">
                      <p className="font-bold text-amber-900">
                        Auction Countdown Completed — Final Review
                      </p>
                      <p className="text-amber-800">
                        Provisional Winner:{' '}
                        <span className="font-semibold">{auction.provisionalWinner?.name || 'Student'}</span> • Final
                        Price:{' '}
                        <span className="font-mono font-bold">
                          {formatINR(auction.winningAmount || auction.currentLeadingBid)}
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => openApproveModal()}
                      disabled={actionLoading}
                      className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>✓ Approve Winning Bid (Reserve Item)</span>
                    </button>
                    <button
                      type="button"
                      onClick={openRejectModal}
                      disabled={actionLoading}
                      className="w-full py-2.5 px-4 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>✕ Reject Winning Bid</span>
                    </button>
                  </div>
                )}

                {/* 3. RESERVED (Handover Arranged -> Confirm Handover Done) */}
                {auction.status === 'Reserved' && (
                  <div className="space-y-2">
                    <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-xs space-y-1">
                      <p className="font-bold text-purple-900">Item Reserved for Campus Handover</p>
                      <p className="text-purple-800">
                        Buyer:{' '}
                        <span className="font-semibold">{auction.provisionalWinner?.name || 'Student'}</span> • Agreed
                        Amount:{' '}
                        <span className="font-mono font-bold">
                          {formatINR(auction.winningAmount || auction.currentLeadingBid)}
                        </span>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={openHandoverModal}
                      disabled={actionLoading}
                      className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 disabled:opacity-50"
                    >
                      <Handshake className="w-4 h-4" />
                      <span>🤝 Confirm Handover Completed (Mark as Sold)</span>
                    </button>
                    <button
                      type="button"
                      onClick={openFailedPickupModal}
                      disabled={actionLoading}
                      className="w-full py-2 px-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
                    >
                      <span>⚠️ Record Failed Pickup</span>
                    </button>
                  </div>
                )}

                {/* 4. SOLD */}
                {auction.status === 'Sold' && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs space-y-1 text-emerald-900">
                    <div className="font-bold text-sm flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Sale Completed & Confirmed!</span>
                    </div>
                    <p>
                      Sold Amount:{' '}
                      <span className="font-mono font-bold">
                        {formatINR(auction.winningAmount || auction.currentLeadingBid)}
                      </span>
                    </p>
                    {auction.soldAt && (
                      <p className="text-[11px] text-emerald-700">
                        Completed on {new Date(auction.soldAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* CUSTOM MODAL: 0. Bidder Confirm Bid Modal (Zero native browser prompts) */}
      {showBidConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Gavel className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Confirm Your Bid
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Review your binding bid before placing it on the campus network.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBidConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Auction Item</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">
                  {auction.title}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Condition</span>
                <span className="font-semibold text-slate-800">{auction.condition}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Current Highest Bid</span>
                <span className="font-semibold text-slate-800">
                  {formatINR(auction.currentLeadingBid || auction.startingPrice)}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Your Verified Bid
                </span>
                <span className="font-mono font-extrabold text-2xl text-blue-700">
                  ₹{pendingBidAmount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>
                Campus bids are binding. If your bid wins at auction close or the seller accepts early, you commit to in-person campus handover.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={biddingLoading}
                onClick={() => setShowBidConfirmModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={biddingLoading}
                onClick={handleExecuteBid}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {biddingLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Gavel className="w-3.5 h-3.5" />
                    <span>Confirm & Place Bid</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: 1. Approve / Accept Bid */}
      {showApproveModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Accept Winning Bid
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reserve this item for the buyer and arrange campus handover.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Item</span>
                <span className="font-bold text-slate-900 truncate max-w-[180px]">{auction.title}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Winning Buyer</span>
                <span className="font-semibold text-slate-900">
                  {targetBidToApprove?.bidder?.name || auction.provisionalWinner?.name || 'Leading Student Bidder'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Accepted Price</span>
                <span className="font-mono font-extrabold text-xl text-emerald-700">
                  {formatINR(targetBidToApprove?.amount || auction.currentLeadingBid || auction.winningAmount)}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                <span>Handover Meeting Location (Optional)</span>
              </label>
              <input
                type="text"
                value={handoverMeetingNote}
                onChange={(e) => setHandoverMeetingNote(e.target.value)}
                placeholder="e.g. Central Library Front Gate, 4 PM"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                The buyer will receive an in-app alert with this pickup location.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowApproveModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteApprove}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Confirm & Accept Bid</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: 2. Confirm Campus Handover (Mark as Sold) */}
      {showHandoverModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0">
                <Handshake className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Confirm Campus Handover
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Complete transaction and mark item as permanently Sold.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Item</span>
                <span className="font-bold text-slate-900 truncate max-w-[180px]">{auction.title}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Buyer</span>
                <span className="font-semibold text-slate-900">
                  {auction.provisionalWinner?.name || 'Student Buyer'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Amount Paid</span>
                <span className="font-mono font-extrabold text-xl text-blue-700">
                  {formatINR(auction.winningAmount || auction.currentLeadingBid)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100 text-[11px] text-blue-800 flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <span>
                By confirming, you verify that the in-person meeting took place and payment was received. Both accounts will be credited.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowHandoverModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Not Yet
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteHandover}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Handshake className="w-3.5 h-3.5" />
                    <span>Confirm Handover Done</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: 3. Reject Bid */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Reject Leading Bid
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Decline this bid and update the auction's leading price.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
              <span className="text-slate-500">Bid Amount to Reject:</span>
              <span className="font-mono font-bold text-rose-600 text-base">
                {formatINR(auction.currentLeadingBid || auction.winningAmount)}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Reason for Declining (Optional)
              </label>
              <textarea
                rows="3"
                placeholder="e.g. Bid amount was below expectations or bidder was unresponsive"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                This reason will be sent to the bidder so they know why their bid was declined.
              </span>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={actionLoading}
                onClick={() => setShowRejectModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteReject}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Confirm Rejection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: 4. Cancel Auction */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Cancel Auction Listing
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Are you sure? Any active bidders will be notified.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Cancellation Reason
              </label>
              <textarea
                rows="3"
                required
                placeholder="e.g. Decided to keep item, or item was damaged"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Go Back
              </button>
              <button
                type="button"
                disabled={actionLoading || !cancelReason.trim()}
                onClick={handleExecuteCancel}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Confirm Cancellation</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: 5. Failed Pickup */}
      {showFailedPickupModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  Record Failed Pickup
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  State why the campus handover could not be completed.
                </p>
              </div>
            </div>

            {actionError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Outcome Reason
              </label>
              <textarea
                rows="3"
                placeholder="e.g. Buyer did not show up or respond to messages"
                value={failedPickupReason}
                onChange={(e) => setFailedPickupReason(e.target.value)}
                className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowFailedPickupModal(false)}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleExecuteFailedPickup}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {actionLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span>Save Outcome</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuctionDetails;
