import { NextResponse } from "next/server";
export const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const bad = (error: string, status = 400) => json({ error }, status);
export function cleanName(n: unknown): string {
  return String(n ?? "").trim().replace(/\s+/g, " ").slice(0, 16);
}
