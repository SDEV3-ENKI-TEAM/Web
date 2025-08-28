import { NextRequest } from "next/server";
import { proxyWithAutoRefresh } from "../../_utils/authProxy";

export async function GET(
  req: NextRequest,
  { params }: { params: { trace_id: string } }
) {
  const { trace_id } = params;
  const backendUrl = `http://localhost:8003/api/traces/search/${trace_id}`;
  return proxyWithAutoRefresh(req, backendUrl, {
    headers: { "Content-Type": "application/json" },
  });
}
