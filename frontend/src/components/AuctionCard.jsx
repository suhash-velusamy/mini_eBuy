import React from 'react';
import { Link } from 'react-router-dom';
import { Gavel, Tag } from 'lucide-react';
import StatusBadge from './StatusBadge';
import CountdownTimer from './CountdownTimer';

const formatINR = (paise) => {
  if (!paise) return '₹0';
  return '₹' + (paise / 100).toLocaleString('en-IN');
};

const AuctionCard = ({ auction }) => {
  const currentPrice = auction.currentLeadingBid || auction.startingPrice;
  const isStarted = !!auction.currentLeadingBid;
  const mainPhoto = auction.photos?.[0] || '/placeholder.svg';

  return (
    <Link
      to={`/auctions/${auction._id}`}
      className="group bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between hover:-translate-y-1"
    >
      <div>
        {/* Image & Badges */}
        <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
          <img
            src={mainPhoto}
            alt={auction.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            onError={(e) => {
              e.target.src =
                'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600&auto=format&fit=crop&q=60';
            }}
          />

          {/* Condition tag */}
          <div className="absolute top-3 left-3 flex flex-wrap gap-1.5">
            <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-white/95 text-slate-800 shadow-sm backdrop-blur-sm">
              {auction.condition}
            </span>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-900/80 text-white shadow-sm backdrop-blur-sm">
              {auction.category.split('&')[0].trim()}
            </span>
          </div>

          {/* Status Badge */}
          <div className="absolute top-3 right-3">
            <StatusBadge status={auction.status} size="sm" />
          </div>

          {/* Countdown Overlay (for active auctions) */}
          {auction.status === 'Active' && (
            <div className="absolute bottom-2.5 right-2.5">
              <CountdownTimer targetDate={auction.closingAt} variant="compact" />
            </div>
          )}
        </div>

        {/* Card Body */}
        <div className="p-4 sm:p-5">
          <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
            {auction.title}
          </h3>

          <p className="mt-1.5 text-xs text-slate-500 line-clamp-2">
            {auction.description}
          </p>
        </div>
      </div>

      {/* Pricing & Footer */}
      <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-0">
        <div className="pt-3 border-t border-slate-100 flex items-end justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-600 block">
              {isStarted ? 'Current Leading Bid' : 'Starting Bid'}
            </span>
            <span className="text-xl font-extrabold text-slate-900 font-mono">
              {formatINR(currentPrice)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
            <Gavel className="w-3.5 h-3.5 text-blue-600" />
            <span>{auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default AuctionCard;
