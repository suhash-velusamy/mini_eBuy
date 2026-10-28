import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  ExternalLink,
  ShieldAlert,
  Gavel,
  Clock,
  Sparkles,
  Award,
} from 'lucide-react';
import { notificationApi } from '../api/notificationApi';
import { useSocket } from '../context/SocketContext';

const Notifications = () => {
  const { setUnreadCount, browserNotifEnabled, requestBrowserPermission } = useSocket();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationApi.getNotifications(unreadOnly);
      if (res.success) {
        setNotifications(res.notifications);
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [unreadOnly]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, readAt: new Date().toISOString() } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, readAt: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const getIconForType = (type) => {
    switch (type) {
      case 'OUTBID':
        return <ShieldAlert className="w-5 h-5 text-rose-500" />;
      case 'PROVISIONAL_WIN':
        return <Award className="w-5 h-5 text-amber-500" />;
      case 'SELLER_APPROVAL_REQUIRED':
        return <Clock className="w-5 h-5 text-blue-500" />;
      case 'ITEM_RESERVED':
      case 'SALE_COMPLETED':
        return <Sparkles className="w-5 h-5 text-emerald-500" />;
      default:
        return <Gavel className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Notification Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Stay informed on bids, outbid alerts, closing reminders, and seller decisions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 transition-all"
          >
            <CheckCheck className="w-4 h-4 text-blue-600" />
            <span>Mark All as Read</span>
          </button>
        </div>
      </div>

      {/* Browser Notification Opt-In Banner */}
      {!browserNotifEnabled && (
        <div className="mb-6 p-4 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-blue-900">Enable Desktop Notifications?</span>
            <p className="text-blue-700 mt-0.5">
              Receive immediate pop-up notifications when someone outbids you or when an auction closes.
            </p>
          </div>
          <button
            onClick={requestBrowserPermission}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold whitespace-nowrap transition-all shadow-sm"
          >
            Enable Notifications
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setUnreadOnly(false)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            !unreadOnly ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Notifications
        </button>
        <button
          onClick={() => setUnreadOnly(true)}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            unreadOnly ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Unread Only
        </button>
      </div>

      {/* List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-xs text-slate-500">Loading notifications...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center p-8">
            <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">No Notifications</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {unreadOnly
                ? 'You have read all of your notifications.'
                : 'No auction activity notifications recorded yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const isUnread = !n.readAt;
              const auctionId = n.auction?._id || n.auction;

              return (
                <div
                  key={n._id}
                  className={`p-4 sm:p-5 flex items-start justify-between gap-4 transition-colors ${
                    isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start gap-3.5 flex-1">
                    <div className="p-2.5 rounded-xl bg-white shadow-sm border border-slate-200 flex-shrink-0">
                      {getIconForType(n.type)}
                    </div>

                    <div className="space-y-1">
                      <p
                        className={`text-sm text-slate-900 leading-snug ${
                          isUnread ? 'font-bold' : 'font-normal'
                        }`}
                      >
                        {n.message}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-slate-400">
                        <span>
                          {new Date(n.createdAt).toLocaleDateString()} at{' '}
                          {new Date(n.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>

                        {isUnread && (
                          <span className="font-bold text-blue-600">● Unread</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isUnread && (
                      <button
                        onClick={() => handleMarkAsRead(n._id)}
                        className="text-xs text-slate-500 hover:text-slate-800 font-semibold px-2 py-1"
                      >
                        Mark read
                      </button>
                    )}

                    {auctionId && (
                      <Link
                        to={`/auctions/${auctionId}`}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
                        title="Go to auction"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
