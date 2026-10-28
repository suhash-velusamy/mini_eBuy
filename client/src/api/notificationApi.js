import api from './axios';

export const notificationApi = {
  getNotifications: async (unreadOnly = false) => {
    const res = await api.get('/api/notifications', {
      params: { unreadOnly },
    });
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await api.patch(`/api/notifications/${id}/read`);
    return res.data;
  },

  markAllAsRead: async () => {
    const res = await api.patch('/api/notifications/read-all');
    return res.data;
  },
};
