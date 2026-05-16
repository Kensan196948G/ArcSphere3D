import { create } from "zustand";
import { login as apiLogin } from "@/lib/api";

const TOKEN_KEY = "arc_token";

interface AuthState {
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  login: async (email, password) => {
    const token = await apiLogin(email, password);
    localStorage.setItem(TOKEN_KEY, token);
    set({ token });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null });
  },
}));
