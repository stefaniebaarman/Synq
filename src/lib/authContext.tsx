import type { User } from "firebase/auth";
import { createContext, useContext } from "react";

export type AuthContextValue = {
  refreshAuth: () => void;
  user: User | null;
  authReady: boolean;
  markCommunityTermsOk: () => void;
};

export const AuthContext = createContext<AuthContextValue>({
  refreshAuth: () => {},
  user: null,
  authReady: false,
  markCommunityTermsOk: () => {},
});

export const useAuthRefresh = () => useContext(AuthContext);
