import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { trace_id, checked } = body;

    if (!trace_id || typeof checked !== "boolean") {
      return NextResponse.json(
        { error: "잘못된 요청입니다." },
        { status: 400 }
      );
    }

    const backendUrl = "http://localhost:8003/api/alarms/check";

    // Authorization 헤더 추출
    const authHeader = request.headers.get("authorization");

    const response = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader || "",
      },
      body: JSON.stringify({ trace_id, checked }),
    });

    if (!response.ok) {
      throw new Error("백엔드 요청 실패");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/alarms/check 백엔드 연동 실패:", error);
    return NextResponse.json(
      { error: "알림 상태 업데이트에 실패했습니다." },
      { status: 500 }
    );
  }
}
