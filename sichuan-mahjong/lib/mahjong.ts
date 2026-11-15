// 川麻牌型判断：只有万/条/筒 108 张，必须缺一门。
// 牌用字符串表示："1m"-"9m" 万，"1s"-"9s" 条，"1p"-"9p" 筒。

import { comboName, fanLines, totalFan, type ExtraKey, type FanLine, type FanSpec, type PatternKey } from "./fans.ts";

export type Suit = "m" | "s" | "p";
export const SUITS: Suit[] = ["m", "s", "p"];
export const SUIT_NAME: Record<Suit, string> = { m: "万", s: "条", p: "筒" };
export const ALL_TILES: string[] = SUITS.flatMap((s) => [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `${n}${s}`));

export type MeldType = "peng" | "gang" | "angang";
export interface Meld {
  type: MeldType;
  tile: string;
}
export interface HandInput {
  concealed: string[]; // 手里的牌（胡牌时包括胡的那张）
  melds: Meld[];
}

export function isTile(t: string): boolean {
  return /^[1-9][msp]$/.test(t);
}
export function tileIndex(t: string): number {
  return SUITS.indexOf(t[1] as Suit) * 9 + (Number(t[0]) - 1);
}
export function indexTile(i: number): string {
  return `${(i % 9) + 1}${SUITS[Math.floor(i / 9)]}`;
}
export function tileName(t: string): string {
  const cn = ["一", "二", "三", "四", "五", "六", "七", "八", "九"];
  return cn[Number(t[0]) - 1] + SUIT_NAME[t[1] as Suit];
}
export function sortTiles(ts: string[]): string[] {
  return [...ts].sort((a, b) => tileIndex(a) - tileIndex(b));
}

function counts(ts: string[]): number[] {
  const c = new Array(27).fill(0);
  for (const t of ts) c[tileIndex(t)]++;
  return c;
}

type Group = { kind: "pung" | "chow"; i: number };
interface Decomp {
  pair: number;
  sets: Group[];
}

function decomposeSets(c: number[], out: Group[][], acc: Group[], limit: number): void {
  if (out.length >= limit) return;
  const i = c.findIndex((x) => x > 0);
  if (i === -1) {
    out.push([...acc]);
    return;
  }
  if (c[i] >= 3) {
    c[i] -= 3;
    acc.push({ kind: "pung", i });
    decomposeSets(c, out, acc, limit);
    acc.pop();
    c[i] += 3;
  }
  const rank = i % 9;
  if (rank <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
    c[i]--;
    c[i + 1]--;
    c[i + 2]--;
    acc.push({ kind: "chow", i });
    decomposeSets(c, out, acc, limit);
    acc.pop();
    c[i]++;
    c[i + 1]++;
    c[i + 2]++;
  }
}

function decompose(concealed: string[]): Decomp[] {
  const c = counts(concealed);
  const res: Decomp[] = [];
  for (let p = 0; p < 27; p++) {
    if (c[p] < 2) continue;
    c[p] -= 2;
    const sets: Group[][] = [];
    decomposeSets(c, sets, [], 64);
    for (const s of sets) res.push({ pair: p, sets: s });
    c[p] += 2;
  }
  return res;
}

export interface WinResult {
  spec: FanSpec;
  fan: number;
  combo: string;
  lines: FanLine[];
}

export interface EvalResult {
  status: "win" | "tenpai" | "notwin" | "invalid";
  message: string;
  best?: WinResult;
  waits?: { tile: string; result: WinResult }[];
}

export interface EvalOptions {
  /** 门清、中张是否加番（各地规则不同） */
  menqingZhongzhang?: boolean;
}

function rankOf(i: number) {
  return (i % 9) + 1;
}

function allTileCounts(hand: HandInput): number[] {
  const c = counts(hand.concealed);
  for (const m of hand.melds) c[tileIndex(m.tile)] += m.type === "peng" ? 3 : 4;
  return c;
}

function suitsUsed(hand: HandInput): Set<Suit> {
  const s = new Set<Suit>();
  for (const t of hand.concealed) s.add(t[1] as Suit);
  for (const m of hand.melds) s.add(m.tile[1] as Suit);
  return s;
}

function makeResult(pattern: PatternKey, hand: HandInput, opts: EvalOptions, extraFlags: { yaojiuFree: boolean }): WinResult {
  const all = allTileCounts(hand);
  const gen = all.filter((x) => x === 4).length;
  const qing = suitsUsed(hand).size === 1;
  const extras: ExtraKey[] = [];
  if (opts.menqingZhongzhang) {
    if (hand.melds.every((m) => m.type === "angang")) extras.push("menqing");
    if (extraFlags.yaojiuFree) extras.push("zhongzhang");
  }
  const spec: FanSpec = { pattern, qing, gen, extras };
  return { spec, fan: totalFan(spec), combo: comboName(spec), lines: fanLines(spec) };
}

/** 判断 14 张（含碰杠）是否胡牌，返回番数最高的解释；不胡返回 null */
export function evaluateWin(hand: HandInput, opts: EvalOptions = {}): WinResult | null {
  if (suitsUsed(hand).size > 2) return null;
  const all = allTileCounts(hand);
  if (all.some((x) => x > 4)) return null;
  const yaojiuFree = all.every((x, i) => x === 0 || (rankOf(i) !== 1 && rankOf(i) !== 9));
  const candidates: WinResult[] = [];

  // 七对
  if (hand.melds.length === 0 && hand.concealed.length === 14) {
    const c = counts(hand.concealed);
    if (c.every((x) => x % 2 === 0)) candidates.push(makeResult("qidui", hand, opts, { yaojiuFree }));
  }

  // 标准胡：1 对 + 4 组
  const meldSets: Group[] = hand.melds.map((m) => ({ kind: "pung", i: tileIndex(m.tile) }));
  for (const d of decompose(hand.concealed)) {
    const sets = [...d.sets, ...meldSets];
    if (sets.length !== 4) continue;
    const pengpeng = sets.every((s) => s.kind === "pung");
    const jingou = hand.melds.length === 4;
    const jiang = all.every((x, i) => x === 0 || [2, 5, 8].includes(rankOf(i)));
    const daiyao =
      [1, 9].includes(rankOf(d.pair)) &&
      sets.every((s) =>
        s.kind === "pung" ? [1, 9].includes(rankOf(s.i)) : rankOf(s.i) === 1 || rankOf(s.i) === 7,
      );
    const options: PatternKey[] = ["pinghu"];
    if (pengpeng) {
      if (jingou) options.push(jiang ? "jiangjingou" : "jingou");
      else options.push(jiang ? "jiangdui" : "duidui");
    }
    if (daiyao) options.push("daiyao");
    for (const p of options) candidates.push(makeResult(p, hand, opts, { yaojiuFree }));
  }
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.fan > a.fan ? b : a));
}

export function evaluateHand(hand: HandInput, opts: EvalOptions = {}): EvalResult {
  for (const t of hand.concealed) if (!isTile(t)) return { status: "invalid", message: `无法识别的牌：${t}` };
  const n = hand.concealed.length + hand.melds.length * 3;
  const all = allTileCounts(hand);
  const over = all.findIndex((x) => x > 4);
  if (over >= 0) return { status: "invalid", message: `${tileName(indexTile(over))} 超过 4 张了` };
  if (suitsUsed(hand).size > 2)
    return { status: "notwin", message: "三门花色都有，没缺一门（花猪），不能胡。" };

  if (n === 14) {
    const best = evaluateWin(hand, opts);
    if (!best) return { status: "notwin", message: "这手牌还没胡。" };
    return { status: "win", message: `胡了！${best.combo}，${best.fan} 番`, best };
  }
  if (n === 13) {
    const waits: { tile: string; result: WinResult }[] = [];
    for (const t of ALL_TILES) {
      if (all[tileIndex(t)] >= 4) continue;
      const r = evaluateWin({ concealed: [...hand.concealed, t], melds: hand.melds }, opts);
      if (r) waits.push({ tile: t, result: r });
    }
    if (waits.length === 0) return { status: "notwin", message: "没听牌。" };
    const best = waits.reduce((a, b) => (b.result.fan > a.result.fan ? b : a)).result;
    return {
      status: "tenpai",
      message: `听牌！叫 ${waits.map((w) => tileName(w.tile)).join("、")}，最大 ${best.fan} 番`,
      waits,
      best,
    };
  }
  return {
    status: "invalid",
    message: `牌数不对：现在是 ${n} 张（碰/杠按 3 张算），胡牌需要 14 张，听牌需要 13 张。`,
  };
}
