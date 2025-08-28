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
      if (token) {
        currentToken = token;
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
    const response = await fetch("/api/auth/refresh", {
      method: "POST",
    });

    if (!response.ok) {
      throw new Error("Token refresh failed");
    }

    const data = await response.json();
    const newToken = data.access_token as string;

    setAuthToken(newToken);

    processQueue(null, newToken);
    notifyCrossTabDone(newToken, data.refresh_token);
    return newToken;
  } catch (err) {
    processQueue(err, null);
    setAuthToken(null);
    notifyCrossTabError((err as Error)?.message || "Token refresh failed");
    throw err;
  } finally {
    isRefreshing = false;
  }
}

const axiosInstance = axios.create({
  baseURL: "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

axiosInstance.interceptors.request.use(
  (config) => {
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
            return axiosInstance.request(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;

      try {
        await refreshAccessToken();
        return axiosInstance.request(originalRequest);
      } catch (refreshError) {
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
