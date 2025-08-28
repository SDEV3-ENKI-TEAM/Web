import { NextRequest } from "next/server";
import { proxyWithAutoRefresh } from "../../_utils/authProxy";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = searchParams.get("limit") || "20";

  const backendUrl = cursor
    ? `http://localhost:8003/api/alarms/infinite?limit=${limit}&cursor=${encodeURIComponent(
        cursor
      )}`
    : `http://localhost:8003/api/alarms/infinite?limit=${limit}`;

  return proxyWithAutoRefresh(request, backendUrl, {
    headers: { "Content-Type": "application/json" },
  });
}
