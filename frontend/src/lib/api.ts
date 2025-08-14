import { Stats } from "@/types/event";
import { refreshAccessToken } from "@/lib/axios";

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  retryCount = 0
) {
  let token = localStorage.getItem("token");

  if (!token) {
    try {
      token = await refreshAccessToken();
    } catch {}
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if ((response.status === 401 || response.status === 403) && retryCount < 1) {
    try {
      const newToken = await refreshAccessToken();

      const newHeaders = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };

      return fetch(url, {
        ...options,
        headers: newHeaders,
      });
    } catch (refreshError) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("refreshToken");
      sessionStorage.removeItem("refreshToken");
      window.location.href = "/login";
      throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
    }
  }

  if (!response.ok) {
    throw new Error(`API 요청 실패: ${response.status} ${response.statusText}`);
  }

  return response;
}

export async function fetchStats(): Promise<Stats> {
  const response = await fetchWithAuth("/api/dashboard-stats");
  return await response.json();
}

export async function fetchTimeseries(): Promise<any[]> {
  const response = await fetchWithAuth("/api/metrics/timeseries");
  return await response.json();
}

export async function fetchDonutStats(): Promise<any> {
  const response = await fetchWithAuth("/api/metrics/donut-stats");
  return await response.json();
}

export async function fetchBarChart(): Promise<any[]> {
  const response = await fetchWithAuth("/api/metrics/bar-chart");
  return await response.json();
}

export async function fetchHeatMap(): Promise<any[]> {
  const response = await fetchWithAuth("/api/metrics/heatmap");
  return await response.json();
}

export async function fetchInfiniteAlarms(
  limit: number = 20,
  cursor?: string
): Promise<any> {
  const url = cursor
    ? `/api/alarms/infinite?limit=${limit}&cursor=${encodeURIComponent(cursor)}`
    : `/api/alarms/infinite?limit=${limit}`;

  const response = await fetchWithAuth(url);
  return await response.json();
}

export async function fetchTraceStats(): Promise<any> {
  const response = await fetchWithAuth("/api/metrics/trace-stats");
  return await response.json();
}

export async function fetchAlarmsSeverity(): Promise<any> {
  const response = await fetchWithAuth("/api/alarms/severity");
  return await response.json();
}

export async function fetchTraceSeverity(traceId: string): Promise<any> {
  const response = await fetchWithAuth(`/api/alarms/${traceId}/severity`);
  return await response.json();
}

export async function fetchSigmaRule(sigmaId: string): Promise<any> {
  const response = await fetchWithAuth(`/api/sigma-rule/${sigmaId}`);
  return await response.json();
}

export async function testOpenSearchConnection(): Promise<any> {
  const response = await fetchWithAuth("/api/opensearch/test");
  return await response.json();
}

export async function getOpenSearchInfo(): Promise<any> {
  const response = await fetchWithAuth("/api/opensearch/info");
  return await response.json();
}
