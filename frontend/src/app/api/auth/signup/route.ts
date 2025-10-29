"use strict";

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendUrl = "http://localhost:8003/api/auth/signup";

    const resp = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return NextResponse.json(data, { status: resp.status });
    }

    const res = NextResponse.json(data, { status: resp.status });

    const accessToken = data.accessToken || data.access_token || data.token;
    const refreshToken = data.refresh_token;

    if (refreshToken) {
      res.cookies.set("refresh_token", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 12 * 60 * 60,
        path: "/",
      });
    }
    if (accessToken) {
      res.cookies.set("access_token", accessToken, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 60 * 60,
        path: "/",
      });
    }

    return res;
  } catch (error) {
    // console.error("Signup error:", error);
    return NextResponse.json({ error: "signup failed" }, { status: 500 });
  }
}
