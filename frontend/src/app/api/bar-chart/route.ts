import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const backendUrl = "http://localhost:8003/api/bar-chart";
  try {
    const response = await fetch(backendUrl);
    if (!response.ok) throw new Error("백엔드 요청 실패");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/bar-chart 백엔드 연동 실패:", error);
    return NextResponse.json([
      {
        user: "user1",
        anomalyCount: 5,
        normalCount: 12,
      },
      {
        user: "user2",
        anomalyCount: 3,
        normalCount: 8,
      },
      {
        user: "user3",
        anomalyCount: 7,
        normalCount: 15,
      },
    ]);
  }
}
