import api from './axios';

export const watchApi = {
  getWatches: async () => {
    const res = await api.get('/api/watches');
    return res.data;
  },

  createWatch: async (watchData) => {
    const res = await api.post('/api/watches', watchData);
    return res.data;
  },

  updateWatch: async (id, data) => {
    const res = await api.put(`/api/watches/${id}`, data);
    return res.data;
  },

  deleteWatch: async (id) => {
    const res = await api.delete(`/api/watches/${id}`);
    return res.data;
  },
};

