import { Stats } from "@/types/event";

// 인증 토큰을 포함한 API 호출 함수
async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem("token");

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

  if (response.status === 401) {
    // 토큰이 만료되었거나 유효하지 않은 경우
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("refreshToken");
    window.location.href = "/login";
    throw new Error("인증이 만료되었습니다. 다시 로그인해주세요.");
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
  const response = await fetchWithAuth("/api/timeseries");
  return await response.json();
}

export async function fetchDonutStats(): Promise<any> {
  const response = await fetchWithAuth("/api/donut-stats");
  return await response.json();
}

export async function fetchBarChart(): Promise<any[]> {
  const response = await fetchWithAuth("/api/bar-chart");
  return await response.json();
}

export async function fetchHeatMap(): Promise<any[]> {
  const response = await fetchWithAuth("/api/heatmap");
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
  const response = await fetchWithAuth("/api/trace-stats");
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
