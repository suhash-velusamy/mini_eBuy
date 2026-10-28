import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  PlusCircle,
  ExternalLink,
  Clock,
  Gavel,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { userApi } from '../api/userApi';
import { auctionApi } from '../api/auctionApi';
import StatusBadge from '../components/StatusBadge';
import CountdownTimer from '../components/CountdownTimer';

const formatINR = (paise) => {
  if (!paise) return '₹0';
  return '₹' + (paise / 100).toLocaleString('en-IN');
};

const MyListings = () => {
  const [listings, setListings] = useState([]);
  const [stats, setStats] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const res = await userApi.getMyListings(activeTab);
      if (res.success) {
        setListings(res.listings);
        setStats(res.stats);
      }
    } catch (err) {
      console.error('Error fetching my listings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchListings();
  }, [activeTab]);

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this winning bid and reserve item for handover?')) return;
    try {
      await auctionApi.approveBid(id, 'Seller approved winning bid');
      fetchListings();
    } catch (err) {
      alert(err.customMessage || err.message);
    }
  };

  const handleConfirmHandover = async (id) => {
    if (!window.confirm('Confirm that the in-person campus handover has taken place?')) return;
    try {
      await auctionApi.confirmHandover(id);
      fetchListings();
    } catch (err) {
      alert(err.customMessage || err.message);
    }
  };

  const tabs = [
    { id: 'all', label: 'All Listings' },
    { id: 'Active', label: 'Active' },
    { id: 'Pending Approval', label: 'Pending Approval' },
    { id: 'Reserved', label: 'Reserved' },
    { id: 'Sold', label: 'Sold' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Page Title & Create CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            My Auction Listings
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage your listings, review provisional winners, and confirm campus handovers.
          </p>
        </div>

        <Link
          to="/create-listing"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 hover:shadow-lg transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Listing</span>
        </Link>
      </div>

      {/* Seller Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Active Listings
            </span>
            <span className="text-2xl font-extrabold text-blue-600 font-mono mt-1 block">
              {stats.active}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Needs Approval
            </span>
            <span className="text-2xl font-extrabold text-amber-600 font-mono mt-1 block">
              {stats.pendingApproval}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Reserved Handovers
            </span>
            <span className="text-2xl font-extrabold text-purple-600 font-mono mt-1 block">
              {stats.reserved}
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
              Total Sales Volume
            </span>
            <span className="text-2xl font-extrabold text-emerald-600 font-mono mt-1 block">
              ₹{stats.totalRevenueINR.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Listings Table / Cards */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading your listings...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Listings Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You don't have any listings in this category right now.
          </p>
          <Link
            to="/create-listing"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create First Listing</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {listings.map((item) => {
            const currentPrice = item.currentLeadingBid || item.startingPrice;
            const mainPhoto = item.photos?.[0] || '/placeholder.svg';

            return (
              <div
                key={item._id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-all"
              >
                {/* Item Thumbnail & Details */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <img
                    src={mainPhoto}
                    alt={item.title}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                    onError={(e) => {
                      e.target.src =
                        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=60';
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusBadge status={item.status} size="sm" />
                      <span className="text-[11px] text-slate-400 font-medium">
                        {item.category.split('&')[0].trim()}
                      </span>
                    </div>

                    <Link
                      to={`/auctions/${item._id}`}
                      className="font-bold text-sm sm:text-base text-slate-900 hover:text-blue-600 transition-colors line-clamp-1 block"
                    >
                      {item.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span className="flex items-center gap-1">
                        <Gavel className="w-3.5 h-3.5 text-slate-400" />
                        <span>{item.bidCount} bids</span>
                      </span>

                      {item.status === 'Active' && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <CountdownTimer targetDate={item.closingAt} variant="compact" />
                        </div>
                      )}

                      {item.provisionalWinner && (
                        <span className="text-blue-600 font-medium">
                          Winner: {item.provisionalWinner.name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pricing & Actions */}
                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      {item.winningAmount
                        ? 'Final Sold Price'
                        : item.currentLeadingBid
                        ? 'Leading Bid'
                        : 'Starting Price'}
                    </span>
                    <span className="font-extrabold text-base sm:text-lg font-mono text-slate-900">
                      {formatINR(item.winningAmount || currentPrice)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Pending Approval: Quick Approve Button */}
                    {item.status === 'Pending Approval' && (
                      <button
                        onClick={() => handleApprove(item._id)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                      >
                        Approve Bid
                      </button>
                    )}

                    {/* Reserved: Quick Handover Button */}
                    {item.status === 'Reserved' && (
                      <button
                        onClick={() => handleConfirmHandover(item._id)}
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-sm transition-all"
                      >
                        Confirm Handover
                      </button>
                    )}

                    <Link
                      to={`/auctions/${item._id}`}
                      className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors"
                      title="View Details"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyListings;
