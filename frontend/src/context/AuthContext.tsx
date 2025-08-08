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
  logout: () => void;
  refreshToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // 토큰 설정 함수 (메모리와 axios 모두 업데이트)
  const setTokenAndUpdateAxios = (newToken: string | null) => {
    setToken(newToken);
    setAuthToken(newToken);
  };

  // 토큰 만료 확인 함수
  const isTokenExpired = (token: string): boolean => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      const exp = payload.exp * 1000; // 밀리초로 변환
      return Date.now() >= exp;
    } catch {
      return true;
    }
  };

  // 토큰 갱신 함수
  const refreshToken = async () => {
    try {
      const refreshToken = sessionStorage.getItem("refreshToken");
      if (!refreshToken) {
        throw new Error("Refresh token not found");
      }

      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ 토큰 갱신 응답 오류:", errorText);
        throw new Error(
          `Token refresh failed: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();

      setTokenAndUpdateAxios(data.access_token);
      localStorage.setItem("token", data.access_token); // localStorage 업데이트
      sessionStorage.setItem("refreshToken", data.refresh_token);

      // 쿠키 업데이트
      document.cookie = `access_token=${data.access_token}; path=/; max-age=${
        15 * 60
      }; SameSite=Strict`;
    } catch (error) {
      console.error("❌ 토큰 갱신 실패:", error);
      logout();
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      const storedUser = localStorage.getItem("user");
      const storedToken = localStorage.getItem("token"); // localStorage에서 토큰 확인

      if (
        storedUser &&
        storedToken &&
        storedToken !== "undefined" &&
        storedToken !== "null" &&
        storedUser !== "undefined" &&
        storedUser !== "null"
      ) {
        // 토큰 만료 확인
        if (isTokenExpired(storedToken)) {
          await refreshToken();
        } else {
          setCurrentUser(storedUser);
          setTokenAndUpdateAxios(storedToken);
          setIsLoggedIn(true);
        }
      } else {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        sessionStorage.removeItem("refreshToken");
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []); // 의존성 배열을 비워서 한 번만 실행

  const login = async (credentials: LoginRequest) => {
    try {
      const response: JwtResponse = await apiLogin(credentials);
      if (!response.token) {
        throw new Error("로그인 응답에 토큰이 없습니다.");
      }
      setCurrentUser(response.username);
      setTokenAndUpdateAxios(response.token);
      setIsLoggedIn(true);
      localStorage.setItem("user", response.username);
      localStorage.setItem("token", response.token); // localStorage에도 토큰 저장
      sessionStorage.setItem("refreshToken", response.refresh_token);

      // 쿠키에 토큰 저장 (서버 사이드 API 호출용)
      document.cookie = `access_token=${response.token}; path=/; max-age=${
        15 * 60
      }; SameSite=Strict`;
    } catch (error) {
      setCurrentUser(null);
      setTokenAndUpdateAxios(null);
      setIsLoggedIn(false);
      localStorage.removeItem("user");
      localStorage.removeItem("token");
      sessionStorage.removeItem("refreshToken");
      throw error;
    }
  };

  const register = async (userData: SignupRequest) => {
    await apiRegister(userData);
  };

  const logout = () => {
    setCurrentUser(null);
    setTokenAndUpdateAxios(null);
    setIsLoggedIn(false);
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    sessionStorage.removeItem("refreshToken"); // Refresh Token도 삭제

    // 쿠키 삭제
    document.cookie =
      "access_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
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
