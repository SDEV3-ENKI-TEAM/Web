import { NextRequest } from "next/server";
import { proxyWithAutoRefresh } from "../../../_utils/authProxy";

export async function POST(req: NextRequest) {
  const backendUrl = "http://localhost:8003/api/settings/slack/test";
  return proxyWithAutoRefresh(req, backendUrl, { method: "POST" });
}
