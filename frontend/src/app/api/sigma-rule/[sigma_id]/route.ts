"use strict";

import { NextRequest } from "next/server";
import { proxyWithAutoRefresh } from "../../_utils/authProxy";

export async function GET(
  request: NextRequest,
  { params }: { params: { sigma_id: string } }
) {
  const sigmaId = params.sigma_id;
  const backendUrl = `http://localhost:8003/api/sigma-rule/${sigmaId}`;
  return proxyWithAutoRefresh(request, backendUrl, {
    headers: { "Content-Type": "application/json" },
  });
}
