import { NextResponse } from "next/server";

export async function GET(
  request: Request,
  { params }: { params: { sigma_id: string } }
) {
  const sigmaId = params.sigma_id;
  const backendUrl = `http://localhost:8003/api/sigma-rule/${sigmaId}`;

  try {
    const response = await fetch(backendUrl);
    if (!response.ok) throw new Error("백엔드 요청 실패");
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error(`/api/sigma-rule/${sigmaId} 백엔드 연동 실패:`, error);
    return NextResponse.json({
      sigma_id: sigmaId,
      title: sigmaId,
      level: "medium",
      severity_score: 60,
    });
  }
}
