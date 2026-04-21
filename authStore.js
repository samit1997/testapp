import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authAPI } from '../utils/api';

const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setToken: (token) => {
        localStorage.setItem('accessToken', token || '');
        set({ accessToken: token });
      },

      login: async (email, password, totpToken) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authAPI.login({ email, password, totpToken });
          if (data.requiresTOTP) {
            set({ isLoading: false });
            return { requiresTOTP: true };
          }
          localStorage.setItem('accessToken', data.accessToken);
          set({ user: data.user, accessToken: data.accessToken, isAuthenticated: true, isLoading: false });
          return { success: true, user: data.user };
        } catch (err) {
          const msg = err.response?.data?.error || 'Login failed';
          set({ error: msg, isLoading: false });
          throw new Error(msg);
        }
      },

      logout: async () => {
        try { await authAPI.logout(); } catch (_) {}
        localStorage.removeItem('accessToken');
        set({ user: null, accessToken: null, isAuthenticated: false });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'vaultshare-auth',
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
    }
  )
);

export default useAuthStore;
