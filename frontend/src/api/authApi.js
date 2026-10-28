import api from './axios';

export const authApi = {
  login: async (credentials) => {
    const res = await api.post('/api/auth/login', credentials);
    return res.data;
  },

  register: async (userData) => {
    const res = await api.post('/api/auth/register', userData);
    return res.data;
  },

  logout: async () => {
    const res = await api.post('/api/auth/logout');
    return res.data;
  },

  getMe: async () => {
    const res = await api.get('/api/auth/me');
    return res.data;
  },

  switchRole: async (role) => {
    const res = await api.patch('/api/auth/switch-role', { role });
    return res.data;
  },

  getDemoAccounts: async () => {
    const res = await api.get('/api/auth/demo-accounts');
    return res.data;
  },
};
