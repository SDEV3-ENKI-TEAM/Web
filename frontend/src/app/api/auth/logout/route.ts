"use strict";

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;
    const backendUrl = "http://localhost:8003/api/auth/logout";

    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    await fetch(backendUrl, {
      method: "POST",
      headers,
    });

    const res = NextResponse.json({ message: "ok" });
    res.cookies.set("access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("refresh_token", "", { maxAge: 0, path: "/" });
    return res;
  } catch {
    const res = NextResponse.json({ message: "error" }, { status: 500 });
    res.cookies.set("access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("refresh_token", "", { maxAge: 0, path: "/" });
    return res;
  }
}
