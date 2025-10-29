"use strict";

import { NextRequest } from "next/server";
import { proxyWithAutoRefresh } from "../../../_utils/authProxy";

export async function PATCH(req: NextRequest) {
  const backendUrl = "http://localhost:8003/api/settings/slack/enabled";
  return proxyWithAutoRefresh(req, backendUrl, {
    method: "PATCH",
    body: await req.text(),
    headers: { "Content-Type": "application/json" },
  });
}
