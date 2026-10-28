import api from './axios';

export const assistantApi = {
  chat: async (message) => {
    const res = await api.post('/api/assistant/chat', { message });
    return res.data;
  },

  getHistory: async () => {
    const res = await api.get('/api/assistant/history');
    return res.data;
  },

  confirmAction: async (actionId) => {
    const res = await api.post(`/api/assistant/actions/${actionId}/confirm`);
    return res.data;
  },

  cancelAction: async (actionId) => {
    const res = await api.post(`/api/assistant/actions/${actionId}/cancel`);
    return res.data;
  },
};

