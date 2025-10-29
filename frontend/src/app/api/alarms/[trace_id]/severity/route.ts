"use strict";

import { NextRequest } from "next/server";
import { proxyWithAutoRefresh } from "../../../_utils/authProxy";

export async function GET(
  request: NextRequest,
  { params }: { params: { trace_id: string } }
) {
  const backendUrl = `http://localhost:8003/api/alarms/${encodeURIComponent(
    params.trace_id
  )}/severity`;
  return proxyWithAutoRefresh(request, backendUrl);
}
