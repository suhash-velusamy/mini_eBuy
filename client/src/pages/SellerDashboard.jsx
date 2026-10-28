import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  PlusCircle,
  Handshake,
  AlertCircle,
  MapPin,
  X,
} from 'lucide-react';
import { userApi } from '../api/userApi';
import { auctionApi } from '../api/auctionApi';
import StatusBadge from '../components/StatusBadge';

const formatINR = (paise) => {
  if (!paise) return '₹0';
  return '₹' + (paise / 100).toLocaleString('en-IN');
};

const SellerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [actionableListings, setActionableListings] = useState([]);
  const [loading, setLoading] = useState(true);

  // Custom Action Modal State (Replaces native browser window.confirm and alert)
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: 'approve', // 'approve' | 'handover'
    item: null,
    meetingNote: '',
    loading: false,
    error: '',
  });

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await userApi.getMyListings('all');
      if (res.success) {
        setStats(res.stats);
        // Actionable: Active with bids, Pending Approval, and Reserved items
        setActionableListings(
          res.listings.filter(
            (i) =>
              i.status === 'Pending Approval' ||
              i.status === 'Reserved' ||
              (i.status === 'Active' && i.currentLeadingBid)
          )
        );
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const openApproveModal = (item) => {
    setModalState({
      isOpen: true,
      type: 'approve',
      item,
      meetingNote: '',
      loading: false,
      error: '',
    });
  };

  const openHandoverModal = (item) => {
    setModalState({
      isOpen: true,
      type: 'handover',
      item,
      meetingNote: '',
      loading: false,
      error: '',
    });
  };

  const handleModalConfirm = async () => {
    if (!modalState.item) return;
    try {
      setModalState((prev) => ({ ...prev, loading: true, error: '' }));
      if (modalState.type === 'approve') {
        const note = modalState.meetingNote.trim() || 'Seller approved winning bid';
        await auctionApi.approveBid(modalState.item._id, note);
      } else {
        await auctionApi.confirmHandover(modalState.item._id);
      }
      setModalState((prev) => ({ ...prev, isOpen: false, loading: false }));
      fetchDashboardData();
    } catch (err) {
      setModalState((prev) => ({
        ...prev,
        loading: false,
        error: err.customMessage || err.message || 'Operation failed. Please try again.',
      }));
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-slate-500">Loading seller dashboard...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Seller Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Performance analytics, revenue summaries, and pending sales decisions.
          </p>
        </div>

        <Link
          to="/create-listing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Auction Listing</span>
        </Link>
      </div>

      {/* Metrics Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Total Sales</span>
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
              ₹{stats.totalRevenueINR.toLocaleString('en-IN')}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{stats.sold} items successfully sold</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Active Auctions</span>
              <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-blue-600 font-mono">
              {stats.active}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Accepting live student bids</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Pending Decision</span>
              <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-600 font-mono">
              {stats.pendingApproval}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Awaiting your approval</p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Reserved Handovers</span>
              <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-600 font-mono">
              {stats.reserved}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Scheduled campus pickup</p>
          </div>
        </div>
      )}

      {/* Action Required Section */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-bold text-slate-900">
              Actions Required ({actionableListings.length})
            </h2>
          </div>
          <Link
            to="/my-listings"
            className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <span>View all listings</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {actionableListings.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <span className="font-semibold text-slate-700">All caught up!</span>
            <p className="mt-1">No pending bids or unconfirmed handovers right now.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {actionableListings.map((item) => (
              <div
                key={item._id}
                className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={item.status} size="sm" />
                    <span className="font-bold text-sm text-slate-900">{item.title}</span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Provisional Winner:{' '}
                    <span className="font-semibold text-slate-800">
                      {item.provisionalWinner?.name || 'Student'}
                    </span>{' '}
                    • Winning Amount:{' '}
                    <span className="font-bold font-mono text-slate-900">
                      {formatINR(item.winningAmount || item.currentLeadingBid)}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {item.status === 'Active' && item.currentLeadingBid && (
                    <button
                      onClick={() => openApproveModal(item)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept Bid</span>
                    </button>
                  )}

                  {item.status === 'Pending Approval' && (
                    <button
                      onClick={() => openApproveModal(item)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Price</span>
                    </button>
                  )}

                  {item.status === 'Reserved' && (
                    <button
                      onClick={() => openHandoverModal(item)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Handshake className="w-3.5 h-3.5" />
                      <span>Confirm Handover</span>
                    </button>
                  )}

                  <Link
                    to={`/auctions/${item._id}`}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition-all"
                  >
                    View Details
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom Confirmation Modal (Zero native browser alerts or confirm dialogs) */}
      {modalState.isOpen && modalState.item && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-start gap-3.5">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                  modalState.type === 'approve'
                    ? 'bg-emerald-100 text-emerald-600'
                    : 'bg-blue-100 text-blue-600'
                }`}
              >
                {modalState.type === 'approve' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : (
                  <Handshake className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-extrabold text-slate-900 tracking-tight">
                  {modalState.type === 'approve'
                    ? 'Accept & Reserve Winning Bid'
                    : 'Confirm Campus Handover'}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalState.type === 'approve'
                    ? 'Reserve this item for the buyer and arrange campus handover.'
                    : 'Mark item as permanently Sold once in-person exchange is complete.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalState.error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{modalState.error}</span>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Item</span>
                <span className="font-bold text-slate-900 truncate max-w-[200px]">
                  {modalState.item.title}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Buyer</span>
                <span className="font-semibold text-slate-900">
                  {modalState.item.provisionalWinner?.name || 'Student Buyer'}
                </span>
              </div>
              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  {modalState.type === 'approve' ? 'Accepted Bid' : 'Final Sold Price'}
                </span>
                <span
                  className={`font-mono font-extrabold text-xl ${
                    modalState.type === 'approve' ? 'text-emerald-700' : 'text-blue-700'
                  }`}
                >
                  {formatINR(
                    modalState.item.winningAmount ||
                      modalState.item.currentLeadingBid ||
                      modalState.item.startingPrice
                  )}
                </span>
              </div>
            </div>

            {modalState.type === 'approve' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-600" />
                  <span>Handover Meeting Location (Optional)</span>
                </label>
                <input
                  type="text"
                  value={modalState.meetingNote}
                  onChange={(e) =>
                    setModalState((prev) => ({ ...prev, meetingNote: e.target.value }))
                  }
                  placeholder="e.g. Central Library Gate, 4 PM"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">
                  The buyer receives an in-app notification with this pickup location.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={modalState.loading}
                onClick={() => setModalState((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={modalState.loading}
                onClick={handleModalConfirm}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 ${
                  modalState.type === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                }`}
              >
                {modalState.loading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {modalState.type === 'approve' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Handshake className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {modalState.type === 'approve'
                        ? 'Confirm & Accept Bid'
                        : 'Confirm Handover Done'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SellerDashboard;
