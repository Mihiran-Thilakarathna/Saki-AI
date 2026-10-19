import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { authApi } from '@/api/sakiApi';
import { configureApiClient } from '@/lib/apiClient';
import type { AuthResponse, GoogleLoginRequest, LoginRequest, RegisterRequest, UserProfile } from '@/types/api';

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  expiresAt: number | null;
  login: (request: LoginRequest) => Promise<void>;
  register: (request: RegisterRequest) => Promise<void>;
  loginWithGoogle: (request: GoogleLoginRequest) => Promise<void>;
  logout: () => void;
}

const fromResponse = (response: AuthResponse) => ({
  token: response.accessToken,
  user: response.user,
  expiresAt: Date.now() + response.expiresIn * 1000,
});

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      expiresAt: null,
      login: async (request) => {
        set(fromResponse(await authApi.login(request)));
      },
      register: async (request) => {
        set(fromResponse(await authApi.register(request)));
      },
      loginWithGoogle: async (request) => {
        set(fromResponse(await authApi.google(request)));
      },
      logout: () => set({ token: null, user: null, expiresAt: null }),
    }),
    {
      name: 'saki-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ token, user, expiresAt }) => ({ token, user, expiresAt }),
      onRehydrateStorage: () => (state) => {
        // Drop tokens that expired while the tab was closed.
        if (state?.expiresAt && state.expiresAt <= Date.now()) state.logout();
      },
    },
  ),
);

/** Valid token or null (also treats an expired token as logged out). */
export function currentToken(): string | null {
  const { token, expiresAt } = useAuthStore.getState();
  if (!token || (expiresAt !== null && expiresAt <= Date.now())) return null;
  return token;
}

configureApiClient(currentToken, () => useAuthStore.getState().logout());
