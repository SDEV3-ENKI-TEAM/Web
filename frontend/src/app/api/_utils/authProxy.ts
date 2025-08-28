import { NextResponse } from "next/server";
import { cookies } from "next/headers";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";

let inFlightRefresh: Promise<{
  ok: boolean;
  token: string | null;
  refresh: string | null;
}> | null = null;

export async function proxyWithAutoRefresh(
  request: Request,
  backendUrl: string,
  init: RequestInit = {},
  requireAuth: boolean = true
) {
  const originalCookie = request.headers.get("cookie") || "";
  const cookieStore = await cookies();
  let token = cookieStore.get("access_token")?.value || null;

  const buildHeaders = (overrideAuth?: string) => {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string>),
    };
    const authValue = overrideAuth || (token ? `Bearer ${token}` : "");
    if (authValue) headers["Authorization"] = authValue;
    return headers;
  };

  const doFetch = async (overrideAuth?: string) => {
    const resp = await fetch(backendUrl, {
      ...init,
      headers: buildHeaders(overrideAuth),
    });
    return resp;
  };

  const host = request.headers.get("host") || "localhost:3000";
  const origin = `${
    request.headers.get("x-forwarded-proto") || "http"
  }://${host}`;

  const startRefresh = async () => {
    const refreshResp = await fetch(`${origin}/api/auth/refresh`, {
      method: "POST",
      headers: {
        Cookie: originalCookie,
      },
    });
    if (!refreshResp.ok) return { ok: false, token: null, refresh: null };
    let access: string | null = null;
    let refresh: string | null = null;
    try {
      const data = await refreshResp.json();
      access = data?.access_token || null;
      refresh = data?.refresh_token || null;
    } catch {}
    return { ok: true, token: access, refresh };
  };

  const tryRefresh = async () => {
    if (!inFlightRefresh) inFlightRefresh = startRefresh();
    try {
      const res = await inFlightRefresh;
      return res;
    } finally {
      inFlightRefresh = null;
    }
  };

  let resp = await doFetch();

  if (resp.status === 401 && requireAuth) {
    const r = await tryRefresh();
    if (r.ok) {
      const retried = await doFetch(r.token ? `Bearer ${r.token}` : undefined);
      const accessCookie = r.token
        ? `access_token=${r.token}; Path=/; Max-Age=3600; HttpOnly; Secure; SameSite=Strict`
        : null;
      const refreshCookie = r.refresh
        ? `refresh_token=${r.refresh}; Path=/; Max-Age=43200; HttpOnly; Secure; SameSite=Strict`
        : null;
      const contentType = retried.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await retried.json();
        const out = NextResponse.json(data, { status: retried.status });
        if (accessCookie) out.headers.append("set-cookie", accessCookie);
        if (refreshCookie) out.headers.append("set-cookie", refreshCookie);
        return out;
      }
      const text = await retried.text();
      const out = new NextResponse(text, { status: retried.status });
      if (accessCookie) out.headers.append("set-cookie", accessCookie);
      if (refreshCookie) out.headers.append("set-cookie", refreshCookie);
      return out;
    }
  }

  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  }

  const text = await resp.text();
  return new NextResponse(text, { status: resp.status });
}
