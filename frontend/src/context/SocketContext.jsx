import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { notificationApi } from '../api/notificationApi';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState(null);
  const [browserNotifEnabled, setBrowserNotifEnabled] = useState(
    typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
  );

  const toastTimerRef = useRef(null);

  // Fetch initial unread notifications count when user logs in
  const refreshUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const res = await notificationApi.getNotifications(true);
      if (res.success) {
        setUnreadCount(res.unreadCount);
      }
    } catch (err) {
      // Ignore initial fetch errors
    }
  };

  useEffect(() => {
    refreshUnreadCount();
  }, [user]);

  // Connect/Reconnect socket when user authentication changes
  useEffect(() => {
    const token = localStorage.getItem('token');
    const socketServerUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

    const newSocket = io(socketServerUrl, {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });

    setSocket(newSocket);

    newSocket.on('connect', () => {
      // connected
    });

    // Listen for new private notifications
    newSocket.on('notification:new', (notif) => {
      setUnreadCount((prev) => prev + 1);

      // Trigger in-app toast
      showToast({
        title: getNotifTitle(notif.type),
        message: notif.message,
        type: notif.type,
      });

      // Optional browser notification
      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification('Campus Auction', {
          body: notif.message,
          icon: '/favicon.ico',
        });
      }
    });

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  const showToast = ({ title, message, type }) => {
    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }
    setActiveToast({ title, message, type });
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 6000);
  };

  const requestBrowserPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await Notification.requestPermission();
      setBrowserNotifEnabled(permission === 'granted');
      return permission === 'granted';
    }
    return false;
  };

  const getNotifTitle = (type) => {
    switch (type) {
      case 'OUTBID':
        return 'Outbid Alert!';
      case 'PROVISIONAL_WIN':
        return 'You are the Winning Bidder!';
      case 'SELLER_APPROVAL_REQUIRED':
        return 'Seller Action Needed';
      case 'SELLER_APPROVED':
        return 'Winning Bid Approved!';
      case 'SELLER_REJECTED':
        return 'Bid Rejected by Seller';
      case 'ITEM_RESERVED':
        return 'Item Reserved for Handover';
      case 'SALE_COMPLETED':
        return 'Sale Completed!';
      case 'LISTING_CANCELLED':
        return 'Listing Cancelled';
      case 'FAILED_PICKUP':
        return 'Handover Failed Pickup';
      default:
        return 'Campus Auction Notification';
    }
  };

  return (
    <SocketContext.Provider
      value={{
        socket,
        unreadCount,
        setUnreadCount,
        refreshUnreadCount,
        browserNotifEnabled,
        requestBrowserPermission,
      }}
    >
      {children}

      {/* Floating In-App Live Alert Toast */}
      {activeToast && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm w-full bg-slate-900 text-white rounded-xl shadow-2xl p-4 border border-slate-700 animate-bounce-short">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
                <h4 className="font-bold text-sm text-blue-300">{activeToast.title}</h4>
              </div>
              <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                {activeToast.message}
              </p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-white text-xs p-1 ml-2"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};
