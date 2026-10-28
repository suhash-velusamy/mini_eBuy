import api from './axios';

export const userApi = {
  getMyListings: async (status = 'all') => {
    const res = await api.get('/api/users/me/listings', {
      params: { status },
    });
    return res.data;
  },

  getMyBids: async () => {
    const res = await api.get('/api/users/me/bids');
    return res.data;
  },
};
