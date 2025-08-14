import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const backendUrl = "http://localhost:8003/api/metrics/trace-stats";

  try {
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

    if (!response.ok) {
      throw new Error(
        `백엔드 요청 실패: ${response.status} ${response.statusText}`
      );
    }
    const data = await response.json();

    const mapped = {
      totalEvents: data.totalTraces ?? 0,
      anomalies: data.sigmaMatchedTraces ?? 0,
      avgAnomaly: 0,
      highestScore: 0,
    };

    return NextResponse.json(mapped);
  } catch (error) {
    console.error("/api/dashboard-stats 백엔드 연동 실패:", error);
    return NextResponse.json({}, { status: 500 });
  }
}
