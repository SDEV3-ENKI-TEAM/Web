import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // 쿼리 파라미터 추출
  const { searchParams } = new URL(request.url);
  const offset = searchParams.get("offset") || "0";
  const limit = searchParams.get("limit") || "10";

  // 외부 백엔드 API 주소
  const backendUrl = `http://localhost:8003/api/alarms?offset=${offset}&limit=${limit}`;

  try {
    const response = await fetch(backendUrl);
    if (!response.ok) {
      throw new Error(
        `백엔드 요청 실패: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/alarms 백엔드 연동 실패:", error);
    return NextResponse.json(
      { alarms: [], total: 0, offset: 0, limit: 0, hasMore: false },
      { status: 500 }
    );
  }
}
