import api from './axios';

export const auctionApi = {
  getCategories: async () => {
    const res = await api.get('/api/auctions/categories');
    return res.data;
  },

  getStats: async () => {
    const res = await api.get('/api/auctions/stats');
    return res.data;
  },

  getAuctions: async (params = {}) => {
    const res = await api.get('/api/auctions', { params });
    return res.data;
  },

  getAuctionById: async (id) => {
    const res = await api.get(`/api/auctions/${id}`);
    return res.data;
  },

  createAuction: async (formData) => {
    const res = await api.post('/api/auctions', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  updateAuction: async (id, data) => {
    const res = await api.patch(`/api/auctions/${id}`, data);
    return res.data;
  },

  cancelAuction: async (id, reason) => {
    const res = await api.post(`/api/auctions/${id}/cancel`, { reason });
    return res.data;
  },

  getAuctionBids: async (id) => {
    const res = await api.get(`/api/auctions/${id}/bids`);
    return res.data;
  },

  placeBid: async (id, amount, idempotencyKey) => {
    const res = await api.post(`/api/auctions/${id}/bids`, {
      amount,
      idempotencyKey,
    });
    return res.data;
  },

  approveBid: async (id, reason) => {
    const res = await api.post(`/api/auctions/${id}/approve`, { reason });
    return res.data;
  },

  rejectBid: async (id, reason) => {
    const res = await api.post(`/api/auctions/${id}/reject`, { reason });
    return res.data;
  },

  confirmHandover: async (id) => {
    const res = await api.post(`/api/auctions/${id}/confirm-handover`);
    return res.data;
  },

  recordFailedPickup: async (id, reason) => {
    const res = await api.post(`/api/auctions/${id}/failed-pickup`, { reason });
    return res.data;
  },
};
