import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const backendUrl = "http://localhost:8003/api/timeseries";
  try {
    // Authorization 헤더 추출
    const authHeader = request.headers.get("authorization");

    const response = await fetch(backendUrl, {
      headers: {
        Authorization: authHeader || "",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) throw new Error("백엔드 요청 실패");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/timeseries 백엔드 연동 실패:", error);
    return NextResponse.json({}, { status: 500 });
  }
}
