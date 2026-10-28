import React from 'react';
import { Gavel, Award, Clock, CheckCircle2, XCircle } from 'lucide-react';

const formatINR = (paise) => {
  if (!paise) return '₹0';
  return '₹' + (paise / 100).toLocaleString('en-IN');
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const BidHistory = ({
  bids = [],
  currentWinningBidderId,
  canManageBids = false,
  onAcceptBid,
  onRejectBid,
  actionLoading = false,
}) => {
  if (!bids || bids.length === 0) {
    return (
      <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        <Gavel className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <h4 className="text-sm font-semibold text-slate-700">No Bids Placed Yet</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
          Be the first student to place a bid and set the leading price!
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
          Public Bid History ({bids.length})
        </span>
        <span className="text-[11px] text-slate-500">Live verified by server</span>
      </div>

      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
        {bids.map((bid, index) => {
          const isLeading = index === 0;

          return (
            <div
              key={bid._id || index}
              className={`px-4 py-3 flex items-center justify-between text-sm transition-colors ${
                isLeading ? 'bg-blue-50/50' : 'hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                    isLeading
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isLeading ? <Award className="w-4 h-4" /> : `#${bids.length - index}`}
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">
                      {bid.bidder?.name || 'Anonymous Student'}
                    </span>
                    {isLeading && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200">
                        Leading Bid
                      </span>
                    )}
                    {bid.extendedClosing && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                        Extended +60s
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-slate-600 mt-0.5">
                    <Clock className="w-3 h-3 text-slate-500" />
                    <span>{formatDate(bid.createdAt)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span
                    className={`font-mono font-bold text-base ${
                      isLeading ? 'text-blue-700' : 'text-slate-800'
                    }`}
                  >
                    {formatINR(bid.amount)}
                  </span>
                </div>

                {canManageBids && isLeading && (
                  <div className="flex items-center gap-1.5 ml-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => onAcceptBid && onAcceptBid(bid)}
                      className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs hover:shadow-sm transition-all flex items-center gap-1"
                      title="Accept this bid & reserve item"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Accept</span>
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => onRejectBid && onRejectBid(bid)}
                      className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all flex items-center gap-1"
                      title="Reject this bid"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BidHistory;
