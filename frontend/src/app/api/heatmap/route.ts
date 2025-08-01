import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const backendUrl = "http://localhost:8003/api/heatmap";
  try {
    const response = await fetch(backendUrl);
    if (!response.ok) throw new Error("백엔드 요청 실패");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("/api/heatmap 백엔드 연동 실패:", error);
    // 샘플 히트맵 데이터 생성
    const sampleData = [];
    for (let day = 0; day < 7; day++) {
      for (let hour = 0; hour < 24; hour++) {
        sampleData.push({
          day: day,
          hour: hour,
          value: Math.floor(Math.random() * 10),
        });
      }
    }
    return NextResponse.json(sampleData);
  }
}
