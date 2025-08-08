import axios from "axios";

// 전역 토큰 저장소 (메모리)
let currentToken: string | null = null;

// 토큰 설정 함수
export const setAuthToken = (token: string | null) => {
  currentToken = token;
};

const axiosInstance = axios.create({
  baseURL: "http://localhost:8003/api", // HTTP로 변경 (개발 환경)
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    // 내 API 도메인에만 토큰 첨부
    const isInternalAPI =
      config.url?.includes("localhost:8003") ||
      config.url?.includes("shitftx.com") ||
      config.url?.startsWith("/api");

    if (isInternalAPI) {
      // 메모리에서 토큰 가져오기
      if (
        currentToken &&
        currentToken !== "undefined" &&
        currentToken !== "null"
      ) {
        config.headers.Authorization = `Bearer ${currentToken}`;
      } else {
        delete config.headers.Authorization;
      }
    } else {
      // 외부 API에는 토큰 첨부하지 않음
      delete config.headers.Authorization;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 토큰 무효화
      setAuthToken(null);
      localStorage.removeItem("user");
      if (!window.location.pathname.includes("/login")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
