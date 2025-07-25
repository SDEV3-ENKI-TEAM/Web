import { NextResponse } from "next/server";

export async function GET() {
  // 외부 백엔드 API 주소
  const backendUrl = "http://localhost:8003/api/dashboard-stats";

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
    console.error("/api/dashboard-stats 백엔드 연동 실패:", error);
    return NextResponse.json({}, { status: 500 });
  }
}
