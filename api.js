import axios from 'axios';

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  withCredentials: true,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request Interceptor: attach access token ──────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response Interceptor: auto-refresh on 401 ─────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (error.response?.data?.code === 'TOKEN_EXPIRED') {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          }).then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          }).catch((err) => Promise.reject(err));
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true });
          const newToken = data.accessToken;
          localStorage.setItem('accessToken', newToken);
          processQueue(null, newToken);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          localStorage.removeItem('accessToken');
          window.location.href = '/login';
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // Non-expiry 401 — redirect to login
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

// ── Auth API ──────────────────────────────────────────────────
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  logout: () => api.post('/auth/logout'),
  refresh: () => api.post('/auth/refresh'),
  setup2FA: () => api.post('/auth/2fa/setup'),
  verify2FA: (token) => api.post('/auth/2fa/verify', { token }),
};

// ── User API ──────────────────────────────────────────────────
export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  getFolders: () => api.get('/user/folders'),
  getActivity: () => api.get('/user/activity'),
};

// ── File API ──────────────────────────────────────────────────
export const fileAPI = {
  list: (folderId, params) => api.get(`/folders/${folderId}/files`, { params }),
  upload: (folderId, formData, onProgress) =>
    api.post(`/folders/${folderId}/files/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }),
  download: (fileId) => api.get(`/files/${fileId}/download`),
  delete: (fileId) => api.delete(`/files/${fileId}`),
  getUploadUrl: (folderId, filename, mimeType) =>
    api.get(`/folders/${folderId}/presigned-upload`, { params: { filename, mimeType } }),
};

// ── Admin API ─────────────────────────────────────────────────
export const adminAPI = {
  getRequests: (params) => api.get('/admin/requests', { params }),
  approveRequest: (requestId, data) => api.post(`/admin/requests/${requestId}/approve`, data),
  rejectRequest: (requestId, data) => api.post(`/admin/requests/${requestId}/reject`, data),
  getUsers: (params) => api.get('/admin/users', { params }),
  updatePermissions: (userId, data) => api.patch(`/admin/users/${userId}/permissions`, data),
  updateUserStatus: (userId, data) => api.patch(`/admin/users/${userId}/status`, data),
  getFolders: () => api.get('/admin/folders'),
  createFolder: (data) => api.post('/admin/folders', data),
  deleteFolder: (folderId) => api.delete(`/admin/folders/${folderId}`),
  getAuditLog: (params) => api.get('/admin/audit-log', { params }),
  getStorageStats: () => api.get('/admin/storage'),
};

export default api;
