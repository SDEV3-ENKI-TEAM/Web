import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { refresh_token } = body;

    if (!refresh_token) {
      return NextResponse.json(
        { error: "Refresh token이 필요합니다." },
        { status: 400 }
      );
    }

    const backendUrl = "http://localhost:8003/api/auth/refresh";
    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token }),
    });

    if (!response.ok) {
      throw new Error("백엔드 refresh 요청 실패");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/auth/refresh 백엔드 연동 실패:", error);
    return NextResponse.json(
      { error: "토큰 갱신에 실패했습니다." },
      { status: 500 }
    );
  }
}
