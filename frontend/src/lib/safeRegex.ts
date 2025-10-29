"use strict";

export function safeReplace(
  input: string,
  pattern: string,
  replacement: string
): string {
  if (!input || typeof input !== "string") {
    return input;
  }

  return input.replace(new RegExp(escapeRegExp(pattern), "g"), replacement);
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function safeReplaceOpacity(input: string): string {
  if (!input || typeof input !== "string") {
    return input;
  }
  return input.replace("0.", "1");
}

export function safeRemoveMarkdownBlocks(input: string): string {
  if (!input || typeof input !== "string") {
    return input;
  }

  let result = input;

  if (result.includes("```markdown")) {
    result = result.replace("```markdown", "");
  }
  if (result.includes("```")) {
    result = result.replace("```", "");
  }

  return result.trim();
}

export function safeSplitLines(input: string): string[] {
  if (!input || typeof input !== "string") {
    return [];
  }

  return input.split("\n").map((line) => line.replace("\r", ""));
}

export function safeRemoveMarkdownHeader(input: string): string {
  if (!input || typeof input !== "string") {
    return input;
  }

  if (input.startsWith("## ")) {
    return input.substring(3).trim();
  }

  return input.trim();
}

export function isValidColor(color: string): boolean {
  if (!color || typeof color !== "string") {
    return false;
  }

  const validColorPatterns = [
    /^#[0-9A-Fa-f]{3}$/,
    /^#[0-9A-Fa-f]{6}$/,
    /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/,
    /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*[\d.]+\s*\)$/,
  ];

  return validColorPatterns.some((pattern) => pattern.test(color));
}

export function normalizeColor(color: string): string {
  if (!isValidColor(color)) {
    return "rgba(255, 255, 255, 1)";
  }

  if (color.includes("0.")) {
    return safeReplaceOpacity(color);
  }

  return color;
}
