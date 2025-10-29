"use strict";

import { cookies } from "next/headers";

export async function verifyCsrf(request: Request) {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get("csrf_token")?.value || "";
  const csrfHeader = request.headers.get("x-csrf-token") || "";
  return csrfCookie && csrfHeader && csrfCookie === csrfHeader;
}
