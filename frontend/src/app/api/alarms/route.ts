import { proxyWithAutoRefresh } from "../_utils/authProxy";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = searchParams.get("offset") || "0";
  const limit = searchParams.get("limit") || "50";

  const backendUrl = `http://localhost:8003/api/alarms?offset=${offset}&limit=${limit}`;
  return proxyWithAutoRefresh(request, backendUrl, {
    headers: { "Content-Type": "application/json" },
  });
}
