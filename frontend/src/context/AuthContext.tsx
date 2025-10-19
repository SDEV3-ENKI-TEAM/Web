"use client";

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { login as apiLogin, register as apiRegister } from "@/lib/auth";
import { LoginRequest, SignupRequest, JwtResponse } from "@/types/auth";
import { setAuthToken } from "@/lib/axios";

interface AuthContextType {
  currentUser: string | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const setTokenAndUpdateAxios = (newToken: string | null) => {
    setToken(newToken);
    setAuthToken(newToken);
  };

  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp * 1000;
      return Date.now() >= exp;
    } catch {
      return true;
    }
  };

  const refreshToken = async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Token refresh failed: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();
      setTokenAndUpdateAxios(data.access_token);
      return data.access_token;
    } catch (error) {
      logout();
      throw error;
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      setIsLoading(true);
      try {
        let res = await fetch("/api/auth/me", {
          method: "GET",
          credentials: "include",
        });
        if (res.status === 401) {
          await fetch("/api/auth/refresh", {
            method: "POST",
            credentials: "include",
          });
          res = await fetch("/api/auth/me", {
            method: "GET",
            credentials: "include",
          });
        }
        if (res.ok) {
          const u = await res.json();
          setCurrentUser(u.username || null);
          setIsLoggedIn(true);
        } else {
          setCurrentUser(null);
          setIsLoggedIn(false);
        }
      } catch {
        setCurrentUser(null);
        setIsLoggedIn(false);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    const response: JwtResponse = await apiLogin(credentials);
    if (!response.token) {
      throw new Error("로그인 응답에 토큰이 없습니다.");
    }
    setCurrentUser(response.username);
    setTokenAndUpdateAxios(response.token);
    setIsLoggedIn(true);
    try {
      window.dispatchEvent(new Event("auth:login"));
    } catch {}
  };

  const register = async (userData: SignupRequest) => {
    await apiRegister(userData);
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout API error:", error);
    } finally {
      setCurrentUser(null);
      setTokenAndUpdateAxios(null);
      setIsLoggedIn(false);
      try {
        window.dispatchEvent(new Event("auth:logout"));
      } catch {}
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        token,
        isLoggedIn,
        isLoading,
        login,
        register,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
