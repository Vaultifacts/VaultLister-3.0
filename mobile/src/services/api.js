// API Service for VaultLister Mobile
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from 'react-native-config';

const API_URL = Config.API_URL || 'http://localhost:3000';

// Create axios instance
export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 - try to refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(`${API_URL}/api/auth/refresh`, {
            refreshToken,
          });

          const { token, refreshToken: newRefreshToken } = response.data;

          await AsyncStorage.setItem('authToken', token);
          await AsyncStorage.setItem('refreshToken', newRefreshToken);

          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - logout user
        await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user']);
        // Navigate to login (handled by auth store)
      }
    }

    return Promise.reject(error);
  }
);

// API methods
export const authApi = {
  login: (email, password) => api.post('/api/auth/login', { email, password }),
  register: (data) => api.post('/api/auth/register', data),
  logout: () => api.post('/api/auth/logout'),
  refreshToken: (refreshToken) => api.post('/api/auth/refresh', { refreshToken }),
  me: () => api.get('/api/auth/me'),
};

export const inventoryApi = {
  getAll: (params) => api.get('/api/inventory', { params }),
  getById: (id) => api.get(`/api/inventory/${id}`),
  create: (data) => api.post('/api/inventory', data),
  update: (id, data) => api.put(`/api/inventory/${id}`, data),
  delete: (id) => api.delete(`/api/inventory/${id}`),
  search: (query) => api.get('/api/inventory', { params: { search: query } }),
};

export const listingsApi = {
  getAll: (params) => api.get('/api/listings', { params }),
  getById: (id) => api.get(`/api/listings/${id}`),
  create: (data) => api.post('/api/listings', data),
  update: (id, data) => api.put(`/api/listings/${id}`, data),
  delete: (id) => api.delete(`/api/listings/${id}`),
  crosslist: (data) => api.post('/api/crosslist', data),
};

export const salesApi = {
  getAll: (params) => api.get('/api/sales', { params }),
  getById: (id) => api.get(`/api/sales/${id}`),
  create: (data) => api.post('/api/sales', data),
  update: (id, data) => api.put(`/api/sales/${id}`, data),
  markShipped: (id, trackingData) => api.post(`/api/sales/${id}/ship`, trackingData),
};

export const analyticsApi = {
  getOverview: () => api.get('/api/analytics/overview'),
  getSalesReport: (params) => api.get('/api/analytics/sales', { params }),
  getInventoryReport: () => api.get('/api/analytics/inventory'),
};

export const imageApi = {
  upload: (formData) => api.post('/api/images/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  delete: (id) => api.delete(`/api/images/${id}`),
};

export const barcodeApi = {
  lookup: (barcode) => api.get(`/api/barcode/lookup/${barcode}`),
};

export default api;
