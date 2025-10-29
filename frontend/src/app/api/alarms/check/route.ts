"use strict";

import { NextRequest } from "next/server";
import { proxyWithAutoRefresh } from "../../_utils/authProxy";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const backendUrl = `http://localhost:8003/api/alarms/check`;
  return proxyWithAutoRefresh(request, backendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}
