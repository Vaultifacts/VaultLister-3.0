// Authentication Store using Zustand
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authApi } from '../services/api';
import { wsService } from '../services/websocket';

export const useAuthStore = create((set, get) => ({
  // State
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  // Check auth on app start
  checkAuth: async () => {
    try {
      const [token, refreshToken, userJson] = await AsyncStorage.multiGet([
        'authToken',
        'refreshToken',
        'user',
      ]);

      if (token[1] && userJson[1]) {
        const user = JSON.parse(userJson[1]);
        set({
          token: token[1],
          refreshToken: refreshToken[1],
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch (error) {
      console.error('Auth check error:', error);
      set({ isLoading: false });
    }
  },

  // Login
  login: async (email, password) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.login(email, password);
      const { user, token, refreshToken } = response.data;

      // Store tokens
      await AsyncStorage.multiSet([
        ['authToken', token],
        ['refreshToken', refreshToken],
        ['user', JSON.stringify(user)],
      ]);

      set({
        user,
        token,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Login failed';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  // Register
  register: async (userData) => {
    set({ isLoading: true, error: null });

    try {
      const response = await authApi.register(userData);
      const { user, token, refreshToken } = response.data;

      await AsyncStorage.multiSet([
        ['authToken', token],
        ['refreshToken', refreshToken],
        ['user', JSON.stringify(user)],
      ]);

      set({
        user,
        token,
        refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      return { success: true };
    } catch (error) {
      const message = error.response?.data?.error || 'Registration failed';
      set({ isLoading: false, error: message });
      return { success: false, error: message };
    }
  },

  // Logout
  logout: async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // Continue with local logout even if API call fails
    }

    // Disconnect WebSocket
    wsService.disconnect();

    // Clear storage
    await AsyncStorage.multiRemove(['authToken', 'refreshToken', 'user']);

    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      error: null,
    });
  },

  // Update user profile
  updateUser: async (updates) => {
    const { user } = get();
    const updatedUser = { ...user, ...updates };

    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
  },

  // Clear error
  clearError: () => set({ error: null }),

  // Set tokens (for refresh)
  setTokens: async (token, refreshToken) => {
    await AsyncStorage.multiSet([
      ['authToken', token],
      ['refreshToken', refreshToken],
    ]);
    set({ token, refreshToken });
  },
}));

export default useAuthStore;
