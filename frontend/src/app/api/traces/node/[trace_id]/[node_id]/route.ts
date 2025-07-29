import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  { params }: { params: { trace_id: string; node_id: string } }
) {
  const { trace_id, node_id } = params;

  try {
    const backendRes = await fetch(
      `http://localhost:8003/api/traces/node/${trace_id}/${node_id}`
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
