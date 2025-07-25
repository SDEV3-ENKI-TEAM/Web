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

interface AuthContextType {
  currentUser: string | null;
  token: string | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  register: (userData: SignupRequest) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage on initial load
    const storedUser = localStorage.getItem("user");
    const storedToken = localStorage.getItem("token");

    // 토큰과 사용자 정보가 모두 존재하고 유효한 경우에만 로그인 상태로 설정
    if (
      storedUser &&
      storedToken &&
      storedToken !== "undefined" &&
      storedToken !== "null" &&
      storedUser !== "undefined" &&
      storedUser !== "null"
    ) {
      setCurrentUser(storedUser);
      setToken(storedToken);
      setIsLoggedIn(true);
    } else {
      // 유효하지 않은 경우 저장소 정리
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      const response: JwtResponse = await apiLogin(credentials);
      if (!response.token) {
        throw new Error("로그인 응답에 토큰이 없습니다.");
      }
      setCurrentUser(response.username);
      setToken(response.token);
      setIsLoggedIn(true);
      localStorage.setItem("user", response.username);
      localStorage.setItem("token", response.token);
    } catch (error) {
      // 로그인 실패 시 상태 초기화
      setCurrentUser(null);
      setToken(null);
      setIsLoggedIn(false);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      throw error;
    }
  };

  const register = async (userData: SignupRequest) => {
    await apiRegister(userData);
  };

  const logout = () => {
    setCurrentUser(null);
    setToken(null);
    setIsLoggedIn(false);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
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
