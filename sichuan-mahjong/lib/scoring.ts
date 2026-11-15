// 房间、每把记录与筹码结算

import { totalFan, type FanSpec } from "./fans.ts";

export interface Settings {
  base: number; // 底分（1 番 = 底分×2）
  cap: number; // 封顶番数
  zimo: "addBase" | "addFan"; // 自摸加底 / 自摸加番
  menqingZhongzhang: boolean; // 门清、中张是否加番
}

export const DEFAULT_SETTINGS: Settings = { base: 1, cap: 4, zimo: "addBase", menqingZhongzhang: false };

export interface Player {
  id: string;
  name: string;
}

export type HandEvent =
  | {
      kind: "hu";
      winner: string;
      from: string | null; // null = 自摸
      payers: string[]; // 自摸时付钱的人（点炮时为 [from]）
      spec: FanSpec;
    }
  | {
      kind: "gang";
      gangType: "zhi" | "ba" | "an"; // 直杠(点杠) / 巴杠(补杠) / 暗杠
      who: string;
      from: string | null; // 直杠时点杠的人
      payers: string[];
    }
  | {
      kind: "adjust"; // 查叫、查花猪、退税或其他转账
      from: string;
      to: string;
      amount: number;
      reason: string;
    };

export interface Hand {
  id: string;
  createdAt: number;
  createdBy: string;
  events: HandEvent[];
  settings: Settings; // 记这把时的规则快照，之后改规则不影响已记的
  note?: string;
}

export interface Room {
  code: string;
  name: string;
  createdAt: number;
  settings: Settings;
  players: Player[];
  hands: Hand[]; // 已删除的不包含
}

export type Deltas = Record<string, number>;

export function huFan(e: Extract<HandEvent, { kind: "hu" }>, s: Settings): number {
  let fan = totalFan(e.spec);
  if (e.from === null && s.zimo === "addFan") fan += 1;
  return fan;
}

/** 胡牌时每个付钱的人要付多少 */
export function huPerPayer(e: Extract<HandEvent, { kind: "hu" }>, s: Settings): number {
  const fan = Math.min(huFan(e, s), s.cap);
  let amt = s.base * Math.pow(2, fan);
  if (e.from === null && s.zimo === "addBase") amt += s.base;
  return amt;
}

export function gangPerPayer(e: Extract<HandEvent, { kind: "gang" }>, s: Settings): number {
  // 刮风下雨：直杠 2 底（点杠者付），巴杠 每家 1 底，暗杠 每家 2 底
  return e.gangType === "ba" ? s.base : 2 * s.base;
}

export function eventDeltas(e: HandEvent, s: Settings): Deltas {
  const d: Deltas = {};
  const add = (id: string, v: number) => (d[id] = (d[id] ?? 0) + v);
  if (e.kind === "hu") {
    const per = huPerPayer(e, s);
    const payers = e.from ? [e.from] : e.payers;
    for (const p of payers) {
      if (p === e.winner) continue;
      add(p, -per);
      add(e.winner, per);
    }
  } else if (e.kind === "gang") {
    const per = gangPerPayer(e, s);
    const payers = e.gangType === "zhi" ? (e.from ? [e.from] : []) : e.payers;
    for (const p of payers) {
      if (p === e.who) continue;
      add(p, -per);
      add(e.who, per);
    }
  } else {
    add(e.from, -e.amount);
    add(e.to, e.amount);
  }
  return d;
}

export function handDeltas(h: Hand, s: Settings): Deltas {
  const d: Deltas = {};
  for (const e of h.events) for (const [k, v] of Object.entries(eventDeltas(e, s))) d[k] = (d[k] ?? 0) + v;
  return d;
}

export function totals(room: Room): Deltas {
  const t: Deltas = Object.fromEntries(room.players.map((p) => [p.id, 0]));
  for (const h of room.hands) for (const [k, v] of Object.entries(handDeltas(h, h.settings ?? room.settings))) t[k] = (t[k] ?? 0) + v;
  return t;
}

/** 最少转账次数的结算方案（贪心） */
export function settle(t: Deltas): { from: string; to: string; amount: number }[] {
  const debtors = Object.entries(t)
    .filter(([, v]) => v < 0)
    .map(([k, v]) => ({ k, v: -v }))
    .sort((a, b) => b.v - a.v);
  const creditors = Object.entries(t)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ k, v }))
    .sort((a, b) => b.v - a.v);
  const out: { from: string; to: string; amount: number }[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amt = Math.min(debtors[i].v, creditors[j].v);
    if (amt > 0) out.push({ from: debtors[i].k, to: creditors[j].k, amount: Math.round(amt * 100) / 100 });
    debtors[i].v -= amt;
    creditors[j].v -= amt;
    if (debtors[i].v <= 1e-9) i++;
    if (creditors[j].v <= 1e-9) j++;
  }
  return out;
}

export function validateEvent(e: HandEvent, players: Player[]): string | null {
  const ids = new Set(players.map((p) => p.id));
  const ok = (id: string | null) => id === null || ids.has(id);
  if (e.kind === "hu") {
    if (!ids.has(e.winner)) return "胡牌的人不在房间里";
    if (!ok(e.from) || e.from === e.winner) return "点炮的人不对";
    if (!e.payers.every((p) => ids.has(p))) return "付钱的人不对";
    if (e.from === null && e.payers.filter((p) => p !== e.winner).length === 0) return "自摸至少要有一家付钱";
    if (!Number.isInteger(e.spec?.gen) || e.spec.gen < 0 || e.spec.gen > 4) return "根数不对";
  } else if (e.kind === "gang") {
    if (!ids.has(e.who)) return "杠的人不在房间里";
    if (e.gangType === "zhi" && (!e.from || !ids.has(e.from) || e.from === e.who)) return "直杠要选点杠的人";
    if (!e.payers.every((p) => ids.has(p))) return "付钱的人不对";
  } else if (e.kind === "adjust") {
    if (!ids.has(e.from) || !ids.has(e.to) || e.from === e.to) return "转账双方不对";
    if (!(e.amount > 0) || e.amount > 1e7) return "金额不对";
  } else return "未知事件";
  return null;
}
