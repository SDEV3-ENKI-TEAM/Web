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

// Cross-tab coordination via BroadcastChannel
const AUTH_CHANNEL_NAME = "auth";
const authChannel: BroadcastChannel | null =
  typeof window !== "undefined" && "BroadcastChannel" in window
    ? new BroadcastChannel(AUTH_CHANNEL_NAME)
    : null;
let crossTabRefreshing = false;
let crossTabWaiters: Array<{
  resolve: (t: string) => void;
  reject: (e: any) => void;
}> = [];

const notifyCrossTabDone = (token: string, refreshToken?: string) => {
  if (authChannel) {
    authChannel.postMessage({ type: "refresh:done", token, refreshToken });
  }
};
const notifyCrossTabStart = () => {
  if (authChannel) {
    authChannel.postMessage({ type: "refresh:start" });
  }
};
const notifyCrossTabError = (message: string) => {
  if (authChannel) {
    authChannel.postMessage({ type: "refresh:error", message });
  }
};

if (authChannel) {
  authChannel.onmessage = (event) => {
    const data = event.data || {};
    if (data.type === "refresh:start") {
      crossTabRefreshing = true;
    } else if (data.type === "refresh:done") {
      crossTabRefreshing = false;
      const token = data.token as string;
      const rtoken = data.refreshToken as string | undefined;
      if (token) {
        currentToken = token;
        localStorage.setItem("token", token);
      }
      if (rtoken) {
        localStorage.setItem("refreshToken", rtoken);
        sessionStorage.setItem("refreshToken", rtoken);
      }
      crossTabWaiters.forEach((w) => w.resolve(token));
      crossTabWaiters = [];
    } else if (data.type === "refresh:error") {
      crossTabRefreshing = false;
      crossTabWaiters.forEach((w) =>
        w.reject(new Error(data.message || "refresh failed"))
      );
      crossTabWaiters = [];
    }
  };
}

const waitForCrossTab = async (): Promise<string> => {
  return new Promise((resolve, reject) => {
    crossTabWaiters.push({ resolve, reject });
    // Fallback timeout
    setTimeout(() => {
      reject(new Error("Cross-tab refresh timeout"));
    }, 15000);
  });
};

export async function refreshAccessToken(): Promise<string> {
  if (isRefreshing) {
    return new Promise((resolve, reject) => {
      failedQueue.push({ resolve, reject });
    });
  }

  if (crossTabRefreshing) {
    return waitForCrossTab();
  }

  isRefreshing = true;
  notifyCrossTabStart();
  try {
    let refreshToken = sessionStorage.getItem("refreshToken");
    if (!refreshToken) {
      const fromLocal = localStorage.getItem("refreshToken");
      if (fromLocal) {
        sessionStorage.setItem("refreshToken", fromLocal);
        refreshToken = fromLocal;
      }
    }
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
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    const newToken = data.access_token as string;

    setAuthToken(newToken);
    localStorage.setItem("token", newToken);
    if (data.refresh_token) {
      localStorage.setItem("refreshToken", data.refresh_token);
      sessionStorage.setItem("refreshToken", data.refresh_token);
    }

    processQueue(null, newToken);
    notifyCrossTabDone(newToken, data.refresh_token);
    return newToken;
  } catch (err) {
    processQueue(err, null);
    setAuthToken(null);
    notifyCrossTabError((err as Error)?.message || "Token refresh failed");
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    sessionStorage.removeItem("refreshToken");
    throw err;
  } finally {
    isRefreshing = false;
  }
}

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
      if (isRefreshing || crossTabRefreshing) {
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

      try {
        const newToken = await refreshAccessToken();
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance.request(originalRequest);
      } catch (refreshError) {
        if (!window.location.pathname.includes("/login")) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
