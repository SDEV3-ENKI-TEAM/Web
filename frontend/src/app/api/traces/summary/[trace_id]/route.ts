import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { trace_id: string } }
) {
  const { trace_id } = params;

  try {
    // Authorization 헤더 추출
    const authHeader = req.headers.get("authorization");

    const backendRes = await fetch(
      `http://localhost:8003/api/traces/summary/${trace_id}`,
      {
        headers: {
          Authorization: authHeader || "",
          "Content-Type": "application/json",
        },
      }
    );
    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (e: any) {
    return NextResponse.json(
      { found: false, data: null, message: e?.message || "Internal Error" },
      { status: 500 }
    );
  }
}
