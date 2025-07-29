import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const backendUrl = "http://localhost:8003/api/donut-stats";
  try {
    const response = await fetch(backendUrl);
    if (!response.ok) throw new Error("백엔드 요청 실패");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/donut-stats 백엔드 연동 실패:", error);
    return NextResponse.json({
      normalCount: 4,
      anomalyCount: 10,
      total: 14,
      normalPercentage: 28.6,
      anomalyPercentage: 71.4,
      processed: 14,
      failed: 0,
    });
  }
}
