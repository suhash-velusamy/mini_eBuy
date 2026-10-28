import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  GraduationCap,
  Gavel,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
} from 'lucide-react';
import { auctionApi } from '../api/auctionApi';
import AuctionCard from '../components/AuctionCard';
import SearchFilters from '../components/SearchFilters';
import { useSocket } from '../context/SocketContext';

const QUICK_CATEGORIES = [
  { label: 'All Items', value: 'All', emoji: '🏷️' },
  { label: 'Bicycles', value: 'Bicycles & Mobility', emoji: '🚲' },
  { label: 'Textbooks', value: 'Textbooks & Study Material', emoji: '📚' },
  { label: 'Electronics', value: 'Electronics & Gadgets', emoji: '💻' },
  { label: 'Lab Kits', value: 'Lab Equipment', emoji: '🥼' },
  { label: 'Hostel Essentials', value: 'Hostel Essentials', emoji: '🫖' },
  { label: 'Sports', value: 'Sports & Fitness', emoji: '🏸' },
];

const Home = () => {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [filters, setFilters] = useState({
    search: '',
    category: 'All',
    condition: 'All',
    status: 'Active',
    minPrice: '',
    maxPrice: '',
    closingSoon: 'false',
    sort: 'newest',
    page: 1,
  });

  const { socket } = useSocket();

  const fetchAuctions = async () => {
    try {
      setLoading(true);
      const res = await auctionApi.getAuctions(filters);
      if (res.success) {
        setAuctions(res.items);
        setPagination({
          page: res.page,
          totalPages: res.totalPages,
          total: res.total,
        });
      }
    } catch (err) {
      console.error('Error loading auctions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuctions();
  }, [filters]);

  // Listen for socket bid updates or status changes to update live card prices
  useEffect(() => {
    if (!socket) return;

    const handleBidPlaced = (data) => {
      setAuctions((prev) =>
        prev.map((item) => {
          if (item._id === data.auctionId) {
            return {
              ...item,
              currentLeadingBid: data.currentLeadingBid,
              bidCount: data.bidCount,
            };
          }
          return item;
        })
      );
    };

    const handleStatusChanged = (data) => {
      setAuctions((prev) =>
        prev.map((item) => {
          if (item._id === data.auctionId) {
            return {
              ...item,
              status: data.status,
            };
          }
          return item;
        })
      );
    };

    socket.on('bid:placed', handleBidPlaced);
    socket.on('auction:status_changed', handleStatusChanged);

    return () => {
      socket.off('bid:placed', handleBidPlaced);
      socket.off('auction:status_changed', handleStatusChanged);
    };
  }, [socket]);

  const handleResetFilters = () => {
    setFilters({
      search: '',
      category: 'All',
      condition: 'All',
      status: 'Active',
      minPrice: '',
      maxPrice: '',
      closingSoon: 'false',
      sort: 'newest',
      page: 1,
    });
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-blue-900 via-indigo-900 to-slate-900 text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(59,130,246,0.2),transparent_50%)]" />

        <div className="relative max-w-5xl mx-auto text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-400/20 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>The Official Campus Bidding & Auction Platform</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
            Buy & Sell Pre-Loved Campus Items Through{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-sky-300 to-indigo-300">
              Fair Timed Auctions
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Seniors graduate, juniors gear up. Find verified engineering calculators, textbooks,
            cycles, and hostel gear with real-time bidding and safe campus handovers.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <Link
              to="/create-listing"
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm shadow-lg shadow-blue-600/30 transition-all hover:-translate-y-0.5"
            >
              List an Item for Auction
            </Link>
            <a
              href="#browse-section"
              className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-sm backdrop-blur-sm border border-white/10 transition-all"
            >
              Explore Active Listings
            </a>
          </div>

          {/* Highlights */}
          <div className="pt-8 grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-3xl mx-auto border-t border-white/10 text-left">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 flex-shrink-0">
                <Gavel className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Live Bidding</p>
                <p className="text-[11px] text-slate-400">Server-verified price locks</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 flex-shrink-0">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Seller Approval</p>
                <p className="text-[11px] text-slate-400">Guaranteed reserve control</p>
              </div>
            </div>

            <div className="col-span-2 sm:col-span-1 flex items-center gap-3 justify-center sm:justify-start">
              <div className="w-9 h-9 rounded-lg bg-blue-500/20 flex items-center justify-center text-blue-300 flex-shrink-0">
                <GraduationCap className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-white">Campus Handover</p>
                <p className="text-[11px] text-slate-400">In-person safety</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main Browse Section */}
      <section id="browse-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Quick Category Navigation Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 scrollbar-none">
          {QUICK_CATEGORIES.map((cat) => {
            const isSelected = filters.category === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setFilters({ ...filters, category: cat.value, page: 1 })}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                    : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search, Filter, Sort Controls */}
        <SearchFilters
          filters={filters}
          onFilterChange={setFilters}
          onReset={handleResetFilters}
        />

        {/* Listings Header info */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {filters.category === 'All' ? 'All Campus Auctions' : filters.category}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {auctions.length} of {pagination.total} listings found
            </p>
          </div>
        </div>

        {/* Listings Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden p-4 space-y-4 animate-pulse"
              >
                <div className="aspect-[4/3] bg-slate-200 rounded-xl" />
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-3/4" />
                  <div className="h-3 bg-slate-200 rounded w-1/2" />
                </div>
                <div className="pt-3 border-t border-slate-100 flex justify-between">
                  <div className="h-6 bg-slate-200 rounded w-20" />
                  <div className="h-6 bg-slate-200 rounded w-14" />
                </div>
              </div>
            ))}
          </div>
        ) : auctions.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <Gavel className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">No Auctions Found</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 leading-relaxed">
              We couldn't find any listings matching your search or filters. Try adjusting your
              keywords, category, or price range.
            </p>
            <button
              onClick={handleResetFilters}
              className="mt-5 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-sm transition-all"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {auctions.map((item) => (
              <AuctionCard key={item._id} auction={item} />
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {pagination.totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => setFilters({ ...filters, page: pagination.page - 1 })}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-semibold text-slate-700 px-4 py-2 bg-white rounded-xl border border-slate-200">
              Page {pagination.page} of {pagination.totalPages}
            </span>

            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => setFilters({ ...filters, page: pagination.page + 1 })}
              className="p-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              aria-label="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default Home;
