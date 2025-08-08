import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cursor = searchParams.get("cursor");
  const limit = searchParams.get("limit") || "20";

  const backendUrl = cursor
    ? `http://localhost:8003/api/alarms/infinite?limit=${limit}&cursor=${encodeURIComponent(
        cursor
      )}`
    : `http://localhost:8003/api/alarms/infinite?limit=${limit}`;

  try {
    // 쿠키에서 토큰 가져오기
    const cookieStore = await cookies();
    const token = cookieStore.get("access_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "인증 토큰이 없습니다." },
        { status: 401 }
      );
    }

    const response = await fetch(backendUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) throw new Error("백엔드 요청 실패");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/alarms/infinite 백엔드 연동 실패:", error);
    return NextResponse.json({
      alarms: [],
      hasMore: false,
      nextCursor: null,
    });
  }
}
