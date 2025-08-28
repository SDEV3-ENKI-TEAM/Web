import { proxyWithAutoRefresh } from "../_utils/authProxy";

export async function GET(request: Request) {
  const backendUrl = "http://localhost:8003/api/metrics/trace-stats";
  const resp = await proxyWithAutoRefresh(request, backendUrl, {
    headers: { "Content-Type": "application/json" },
  });
  try {
    const data = await resp.json();
    const mapped = {
      totalEvents: data.totalTraces ?? 0,
      anomalies: data.sigmaMatchedTraces ?? 0,
      avgAnomaly: 0,
      highestScore: 0,
    };
    return new Response(JSON.stringify(mapped), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return resp;
  }
}
