import { proxyWithAutoRefresh } from "../_utils/authProxy";

export async function GET(request: Request) {
  const backendUrl = `http://localhost:8003/api/metrics/donut-stats`;
  return proxyWithAutoRefresh(request, backendUrl);
}
