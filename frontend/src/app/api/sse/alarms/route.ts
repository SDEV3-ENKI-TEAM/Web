"use strict";

import { NextRequest } from "next/server";
import { cookies } from "next/headers";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit") || "100";

  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;
  if (!token) return new Response("unauthorized", { status: 401 });

  const backendUrl = `${
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8004"
  }/sse/alarms?limit=${encodeURIComponent(limit)}`;

  const doFetch = async (authToken: string | null) => {
    // console.log(`🔗 Next.js API 라우트에서 백엔드로 요청: ${backendUrl}`);
    // console.log(`🔑 인증 토큰: ${authToken ? "있음" : "없음"}`);
    try {
      const response = await fetch(backendUrl, {
        headers: {
          Accept: "text/event-stream",
          Connection: "keep-alive",
          "Cache-Control": "no-cache",
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        signal: request.signal,
      });
      // console.log(`📡 백엔드 응답 상태: ${response.status}`);
      // console.log(
      //   `📡 백엔드 응답 헤더: ${JSON.stringify(
      //     Object.fromEntries(response.headers.entries()),
      //     (key, value) =>
      //       typeof value === "string" ? value.replace(/[<>]/g, "") : value
      //   )}`
      // );
      return response;
    } catch (error) {
      // console.error(`❌ 백엔드 연결 실패: ${error}`);
      throw error;
    }
  };

  let resp = await doFetch(token);

  if (resp.status === 401) {
    try {
      const host = request.headers.get("host") || "localhost:3000";
      const origin = `${
        request.headers.get("x-forwarded-proto") || "http"
      }://${host}`;
      const refreshResp = await fetch(`${origin}/api/auth/refresh`, {
        method: "POST",
        headers: {
          Cookie: request.headers.get("cookie") || "",
        },
        signal: request.signal,
      });
      if (refreshResp.ok) {
        let newAccess: string | null = null;
        try {
          const data = await refreshResp.json();
          newAccess = data?.access_token || null;
        } catch (jsonError) {
          // console.warn(
          //   "Failed to parse refresh token response in SSE route:",
          //   jsonError
          // );
          // Continue without new access token
        }
        if (newAccess) {
          resp = await doFetch(newAccess);
        }
      }
    } catch (refreshError) {
      // console.warn("Failed to refresh token in SSE route:", refreshError);
      // Continue with original response
    }
  }

  if (!resp.ok || !resp.body) {
    return new Response("upstream error", { status: resp.status || 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");

  return new Response(resp.body, { headers });
}
