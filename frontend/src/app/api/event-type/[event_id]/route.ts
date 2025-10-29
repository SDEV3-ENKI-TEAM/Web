"use strict";

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { event_id: string } }
) {
  try {
    const eventId = params.event_id;

    const response = await fetch(
      `${
        process.env.BACKEND_URL || "http://localhost:8080"
      }/api/event-type/${eventId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "이벤트 타입을 가져올 수 없습니다" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // console.error("이벤트 타입 API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
