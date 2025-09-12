import { proxyWithAutoRefresh } from "../../_utils/authProxy";

export async function POST(request: Request) {
  const backendUrl = `http://localhost:8003/api/alarms/warm-cache`;
  return proxyWithAutoRefresh(request, backendUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
  });
}
