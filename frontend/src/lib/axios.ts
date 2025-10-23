import axios from "axios";

let isRefreshing = false;
let failedQueue: any[] = [];
let refreshPromise: Promise<string> | null = null;
let pendingRequests = new Set<string>();

const processQueue = (error: any) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve(null);
    }
  });
  failedQueue = [];
};

export const setAuthToken = (token: string | null) => {};

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

const notifyCrossTabDone = () => {
  if (authChannel) {
    authChannel.postMessage({ type: "refresh:done" });
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
      crossTabWaiters.forEach((w) => w.resolve(""));
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
    setTimeout(() => {
      reject(new Error("Cross-tab refresh timeout"));
    }, 5000);
  });
};

export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

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

  refreshPromise = (async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) {
        throw new Error("No refresh token available");
      }

      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${refreshToken}`,
          "Content-Type": "application/json",
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Token refresh failed");
      }

      const data = await response.json();

      processQueue(null);
      notifyCrossTabDone();
      return "";
    } catch (err) {
      processQueue(err);
      notifyCrossTabError((err as Error)?.message || "Token refresh failed");
      throw err;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

const axiosInstance = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

axiosInstance.interceptors.request.use(
  (config) => {
    const requestKey = `${config.method}:${config.url}`;

    if (pendingRequests.has(requestKey)) {
      console.log(`🚫 Duplicate request blocked: ${requestKey}`);
      return Promise.reject(new Error("Duplicate request blocked"));
    }

    pendingRequests.add(requestKey);
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

axiosInstance.interceptors.response.use(
  (response) => {
    const requestKey = `${response.config.method}:${response.config.url}`;
    pendingRequests.delete(requestKey);
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestKey = `${originalRequest.method}:${originalRequest.url}`;
    pendingRequests.delete(requestKey);

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing || crossTabRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(async () => {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return axiosInstance.request(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;

      try {
        await refreshAccessToken();
        await new Promise((resolve) => setTimeout(resolve, 200));
        return axiosInstance.request(originalRequest);
      } catch (refreshError) {
        originalRequest._retry = false;
        if (
          typeof window !== "undefined" &&
          !window.location.pathname.includes("/login")
        ) {
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
