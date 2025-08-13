import { Stats } from "@/types/event";

// 토큰 갱신 함수 추가
async function refreshAuthToken() {
  try {
    // sessionStorage에서 먼저 확인
    let refreshToken = sessionStorage.getItem("refreshToken");

    // sessionStorage에 없고 localStorage에 있으면 복사
    if (!refreshToken) {
      refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        console.log(
          "API: refreshToken을 localStorage에서 sessionStorage로 복사합니다."
        );
        sessionStorage.setItem("refreshToken", refreshToken);
      } else {
        throw new Error("Refresh token not found");
      }
    }

    const response = await fetch("/api/auth/refresh", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const newToken = data.access_token;

    // 새 토큰 저장
    localStorage.setItem("token", newToken);
    localStorage.setItem("refreshToken", data.refresh_token);
    sessionStorage.setItem("refreshToken", data.refresh_token);

    return newToken;
  } catch (error) {
    console.error("토큰 갱신 실패:", error);
    throw error;
  }
}

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {},
  retryCount = 0
) {
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

  if (response.status === 401 && retryCount < 1) {
    try {
      console.log("401 에러 발생, 토큰 갱신 시도...");
      const newToken = await refreshAuthToken();

      // 새 헤더로 재시도
      const newHeaders = {
        ...headers,
        Authorization: `Bearer ${newToken}`,
      };

      // 재요청
      return fetch(url, {
        ...options,
        headers: newHeaders,
      });
    } catch (refreshError) {
      console.error("토큰 갱신 실패, 로그아웃 처리:", refreshError);
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
