import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Gavel,
  Award,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { userApi } from '../api/userApi';
import StatusBadge from '../components/StatusBadge';
import CountdownTimer from '../components/CountdownTimer';

const formatINR = (paise) => {
  if (!paise) return '₹0';
  return '₹' + (paise / 100).toLocaleString('en-IN');
};

const MyBids = () => {
  const [bidsData, setBidsData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchMyBids = async () => {
    try {
      setLoading(true);
      const res = await userApi.getMyBids();
      if (res.success) {
        setBidsData(res.bids);
      }
    } catch (err) {
      console.error('Error fetching bids:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyBids();
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
          My Bids & Auction Activity
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Track auctions where you have placed bids and monitor your leading or outbid status.
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-xs text-slate-500">Loading your bidding history...</p>
        </div>
      ) : bidsData.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
          <Gavel className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Bids Placed Yet</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You haven't participated in any campus auctions yet. Explore active listings and place your first bid!
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs shadow-md shadow-blue-500/20"
          >
            <span>Explore Active Auctions</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {bidsData.map((item) => {
            const auction = item.auction;
            const mainPhoto = auction.photos?.[0] || '/placeholder.svg';

            return (
              <div
                key={auction._id}
                className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-slate-300 transition-all"
              >
                {/* Item Thumbnail & Details */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <img
                    src={mainPhoto}
                    alt={auction.title}
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                    onError={(e) => {
                      e.target.src =
                        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=60';
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {/* Leading or Outbid Status pill */}
                      {item.isLeading ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Winning Bidder</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Outbid</span>
                        </span>
                      )}

                      <StatusBadge status={auction.status} size="sm" />
                    </div>

                    <Link
                      to={`/auctions/${auction._id}`}
                      className="font-bold text-sm sm:text-base text-slate-900 hover:text-blue-600 transition-colors line-clamp-1 block"
                    >
                      {auction.title}
                    </Link>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                      <span>Seller: {auction.seller?.name || 'Verified Student'}</span>
                      {auction.status === 'Active' && (
                        <div className="flex items-center gap-1 text-slate-600">
                          <CountdownTimer targetDate={auction.closingAt} variant="compact" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Pricing & Link */}
                <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Your Highest Bid
                    </span>
                    <span className="font-extrabold text-sm sm:text-base font-mono text-blue-700">
                      ₹{item.highestUserBidINR.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="text-left md:text-right">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Current Price
                    </span>
                    <span className="font-extrabold text-base sm:text-lg font-mono text-slate-900">
                      {formatINR(auction.winningAmount || auction.currentLeadingBid)}
                    </span>
                  </div>

                  <Link
                    to={`/auctions/${auction._id}`}
                    className="flex items-center gap-1 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyBids;
