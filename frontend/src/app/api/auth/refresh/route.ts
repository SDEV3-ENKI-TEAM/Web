"use strict";

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST(_request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) {
      return NextResponse.json(
        { error: "Refresh token cookie not found" },
        { status: 401 }
      );
    }

    const backendUrl = "http://localhost:8003/api/auth/refresh";
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Backend refresh failed" },
        { status: response.status }
      );
    }

    const data = await response.json();

    const res = NextResponse.json(data);
    if (data.refresh_token) {
      res.cookies.set("refresh_token", data.refresh_token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 12 * 60 * 60,
        path: "/",
      });
    }
    if (data.access_token) {
      res.cookies.set("access_token", data.access_token, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 60 * 60,
        path: "/",
      });
    }
    return res;
  } catch {
    return NextResponse.json(
      { error: "refresh handler error" },
      { status: 500 }
    );
  }
}
