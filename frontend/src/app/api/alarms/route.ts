import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = searchParams.get("offset") || "0";
  const limit = searchParams.get("limit") || "50";

  const backendUrl = `http://localhost:8003/api/alarms?offset=${offset}&limit=${limit}`;

  try {
    const response = await fetch(backendUrl);
    if (!response.ok) throw new Error("백엔드 요청 실패");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/alarms 백엔드 연동 실패:", error);
    return NextResponse.json({
      alarms: [],
      total: 0,
      offset: parseInt(offset),
      limit: parseInt(limit),
      hasMore: false,
    });
  }
}
