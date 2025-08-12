import axios from "axios";

let currentToken: string | null = null;
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(token);
    }
  });
  failedQueue = [];
};

export const setAuthToken = (token: string | null) => {
  currentToken = token;
};

const axiosInstance = axios.create({
  baseURL: "http://localhost:8003/api",
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
    const isInternalAPI =
      config.url?.includes("localhost:8003") ||
      config.url?.includes("shitftx.com") ||
      config.url?.startsWith("/api");

    if (isInternalAPI) {
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
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance.request(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = sessionStorage.getItem("refreshToken");
        if (!refreshToken) {
          throw new Error("Refresh token not found");
        }

        if ((window as any).showToast) {
          (window as any).showToast(
            "토큰을 갱신하고 있습니다...",
            "info",
            2000
          );
        }

        const response = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });

        if (!response.ok) {
          throw new Error("Token refresh failed");
        }

        const data = await response.json();
        const newToken = data.access_token;

        setAuthToken(newToken);
        localStorage.setItem("token", newToken);

        if ((window as any).showToast) {
          (window as any).showToast("토큰이 갱신되었습니다.", "success", 2000);
        }

        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance.request(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);

        if ((window as any).showToast) {
          (window as any).showToast(
            "세션이 만료되었습니다. 다시 로그인해주세요.",
            "error",
            5000
          );
        }

        setAuthToken(null);
        localStorage.removeItem("user");
        localStorage.removeItem("token");
        sessionStorage.removeItem("refreshToken");

        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
