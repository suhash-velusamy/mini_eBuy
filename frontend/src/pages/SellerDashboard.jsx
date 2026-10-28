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
} from 'lucide-react';
import { userApi } from '../api/userApi';
import { auctionApi } from '../api/auctionApi';
import StatusBadge from '../components/StatusBadge';

const formatINR = (amount) => {
  if (!amount) return '₹0';
  return '₹' + amount.toLocaleString('en-IN');
};

const SellerDashboard = () => {
  const [stats, setStats] = useState(null);
  const [actionableListings, setActionableListings] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const handleApprove = async (id) => {
    if (!window.confirm('Approve provisional winning bid?')) return;
    try {
      await auctionApi.approveBid(id, 'Seller approved winning bid');
      fetchDashboardData();
    } catch (err) {
      alert(err.customMessage || err.message);
    }
  };

  const handleHandover = async (id) => {
    if (!window.confirm('Confirm that in-person campus handover is completed?')) return;
    try {
      await auctionApi.confirmHandover(id);
      fetchDashboardData();
    } catch (err) {
      alert(err.customMessage || err.message);
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
                      ₹{((item.winningAmount || item.currentLeadingBid) / 100).toLocaleString('en-IN')}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {item.status === 'Active' && item.currentLeadingBid && (
                    <button
                      onClick={() => handleApprove(item._id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      Accept Bid
                    </button>
                  )}

                  {item.status === 'Pending Approval' && (
                    <button
                      onClick={() => handleApprove(item._id)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      Approve Price
                    </button>
                  )}

                  {item.status === 'Reserved' && (
                    <button
                      onClick={() => handleHandover(item._id)}
                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all shadow-sm"
                    >
                      Confirm Handover
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
    </div>
  );
};

export default SellerDashboard;
