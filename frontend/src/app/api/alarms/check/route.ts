import { NextRequest, NextResponse } from "next/server";
import { proxyWithAutoRefresh } from "../../_utils/authProxy";
import { verifyCsrf } from "../../_utils/csrf";

export async function POST(request: NextRequest) {
  const ok = await verifyCsrf(request);
  if (!ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.text();
  const backendUrl = `http://localhost:8003/api/alarms/check`;
  return proxyWithAutoRefresh(request, backendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
