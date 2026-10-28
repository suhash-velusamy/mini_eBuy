import { useState, useEffect } from 'react';
import api from '../api/axios';

let globalServerOffset = 0;
let isSyncing = false;
let hasSynced = false;

// Synchronize with server clock to eliminate device clock skew
const syncServerClock = async () => {
  if (isSyncing || hasSynced) return;
  isSyncing = true;
  try {
    const t0 = Date.now();
    const res = await api.get('/api/time');
    const t1 = Date.now();
    const roundTrip = t1 - t0;
    if (res.data && res.data.timestamp) {
      // Estimate server time at t1: serverTimestamp + roundTrip / 2
      const estimatedServerNow = res.data.timestamp + Math.floor(roundTrip / 2);
      globalServerOffset = estimatedServerNow - t1;
      hasSynced = true;
    }
  } catch {
    // If offline or request fails, gracefully fallback to local device time
  } finally {
    isSyncing = false;
  }
};

export const useCountdown = (targetDate) => {
  const [timeLeft, setTimeLeft] = useState(() => calculateTimeLeft(targetDate));

  useEffect(() => {
    // Trigger background clock synchronization once
    if (!hasSynced) {
      syncServerClock().then(() => {
        setTimeLeft(calculateTimeLeft(targetDate));
      });
    }

    // Initial calculate
    setTimeLeft(calculateTimeLeft(targetDate));

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft(targetDate);
      setTimeLeft(remaining);
      if (remaining.isEnded) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate]);

  return timeLeft;
};

const calculateTimeLeft = (targetDate) => {
  if (!targetDate) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isEnded: true,
      totalSeconds: 0,
      formatted: '00:00:00',
    };
  }

  const target = new Date(targetDate).getTime();
  const now = Date.now() + globalServerOffset;
  const difference = target - now;

  if (difference <= 0) {
    return {
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
      isEnded: true,
      totalSeconds: 0,
      formatted: 'Ended',
    };
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);
  const totalSeconds = Math.floor(difference / 1000);

  const pad = (n) => String(n).padStart(2, '0');

  let formatted = '';
  if (days > 0) {
    formatted = `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  } else if (hours > 0) {
    formatted = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  } else {
    formatted = `${pad(minutes)}m ${pad(seconds)}s`;
  }

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isEnded: false,
    formatted,
  };
};
