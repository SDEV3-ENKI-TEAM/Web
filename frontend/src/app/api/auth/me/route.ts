"use strict";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const backendUrl = "http://localhost:8003/api/auth/me";
    const resp = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await resp.json();
    return NextResponse.json(data, { status: resp.status });
  } catch {
    return NextResponse.json({ error: "me failed" }, { status: 500 });
  }
}
