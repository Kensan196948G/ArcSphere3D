import { create } from "zustand";
import { getCurrentUser, login as apiLogin } from "@/lib/api";

const TOKEN_KEY = "arc_token";

interface AuthState {
  token: string | null;
  userId: string | null;
  userEmail: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  userId: null,
  userEmail: null,
  login: async (email, password) => {
    const token = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    set({ token });
    try {
      const me = await getCurrentUser(token);
      set({ userId: me.id, userEmail: me.email });
    } catch {
      // non-critical — user info will be unavailable
    }
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null, userId: null, userEmail: null });
  },
}));
