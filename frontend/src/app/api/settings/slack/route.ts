import { NextRequest } from "next/server";
import { proxyWithAutoRefresh } from "../../_utils/authProxy";

export async function GET(req: NextRequest) {
  const backendUrl = "http://localhost:8003/api/settings/slack";
  return proxyWithAutoRefresh(req, backendUrl);
}

export async function PUT(req: NextRequest) {
  const backendUrl = "http://localhost:8003/api/settings/slack";
  return proxyWithAutoRefresh(req, backendUrl, {
    method: "PUT",
    body: await req.text(),
    headers: { "Content-Type": "application/json" },
  });
}
