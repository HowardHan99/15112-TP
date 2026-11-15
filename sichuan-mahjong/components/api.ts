"use client";
import type { Room } from "@/lib/scoring";

export async function api<T = unknown>(path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(path, {
    method: init?.method ?? "GET",
    headers: { "Content-Type": "application/json" },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败（${res.status}）`);
  return data as T;
}

export type Me = { id: string; name: string };
export function loadMe(code: string): Me | null {
  try {
    return JSON.parse(localStorage.getItem(`mj:me:${code}`) || "null");
  } catch {
    return null;
  }
}
export function saveMe(code: string, me: Me, roomName?: string) {
  try {
    localStorage.setItem(`mj:me:${code}`, JSON.stringify(me));
    const recent: { code: string; name: string; at: number }[] = JSON.parse(localStorage.getItem("mj:recent") || "[]");
    const next = [{ code, name: roomName || code, at: Date.now() }, ...recent.filter((r) => r.code !== code)].slice(0, 6);
    localStorage.setItem("mj:recent", JSON.stringify(next));
  } catch {}
}
export function loadRecent(): { code: string; name: string; at: number }[] {
  try {
    return JSON.parse(localStorage.getItem("mj:recent") || "[]");
  } catch {
    return [];
  }
}
export type { Room };
