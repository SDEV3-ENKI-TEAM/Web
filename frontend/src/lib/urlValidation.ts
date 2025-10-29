"use strict";

export function isValidURL(url: string): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  try {
    // 상대 경로는 허용 (내부 라우팅)
    if (url.startsWith("/")) {
      return true;
    }

    // 절대 URL인 경우 프로토콜 검증
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

export function sanitizeURL(url: string): string {
  if (!isValidURL(url)) {
    return "";
  }
  return url;
}

export function isNotJavaScriptURL(url: string): boolean {
  if (!url || typeof url !== "string") {
    return true;
  }

  const lowerUrl = url.toLowerCase().trim();
  return (
    !lowerUrl.startsWith("javascript:") &&
    !lowerUrl.startsWith("data:") &&
    !lowerUrl.startsWith("vbscript:")
  );
}

export function isSafeURL(url: string): boolean {
  return isValidURL(url) && isNotJavaScriptURL(url);
}

export function getSafeURL(url: string, fallback: string = ""): string {
  return isSafeURL(url) ? url : fallback;
}
