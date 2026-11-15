// 川麻（血战到底）番型定义与番数计算。
// 番数 = 牌型番 + 清一色(2) + 根(每个1) + 附加番；每家支付 = 底分 × 2^min(番, 封顶)

export type PatternKey =
  | "pinghu"
  | "duidui"
  | "qidui"
  | "daiyao"
  | "jingou"
  | "jiangdui"
  | "jiangjingou";

export type ExtraKey =
  | "gangshanghua"
  | "gangshangpao"
  | "qiangganghu"
  | "haidi"
  | "haidipao"
  | "menqing"
  | "zhongzhang"
  | "tianhu"
  | "dihu";

export const PATTERNS: { key: PatternKey; name: string; fan: number; desc: string }[] = [
  { key: "pinghu", name: "平胡", fan: 0, desc: "4 组顺子/刻子 + 1 对将" },
  { key: "duidui", name: "对对胡", fan: 1, desc: "全是刻子/杠（大对子）" },
  { key: "qidui", name: "七对", fan: 2, desc: "7 个对子；手里有 4 张相同算根→龙七对" },
  { key: "daiyao", name: "带幺九", fan: 2, desc: "每组牌和将都带 1 或 9" },
  { key: "jingou", name: "金钩钓", fan: 2, desc: "碰/杠完只剩 1 张单钓（含对对胡）" },
  { key: "jiangdui", name: "将对", fan: 3, desc: "对对胡且全是 2/5/8" },
  { key: "jiangjingou", name: "将金钩钓", fan: 4, desc: "金钩钓且全是 2/5/8" },
];

export const EXTRAS: { key: ExtraKey; name: string; fan: number; desc: string }[] = [
  { key: "gangshanghua", name: "杠上花", fan: 1, desc: "杠后补牌自摸" },
  { key: "gangshangpao", name: "杠上炮", fan: 1, desc: "杠后打出的牌点炮" },
  { key: "qiangganghu", name: "抢杠胡", fan: 1, desc: "胡别人补杠的牌" },
  { key: "haidi", name: "海底捞月", fan: 1, desc: "最后一张自摸" },
  { key: "haidipao", name: "海底炮", fan: 1, desc: "最后一张点炮" },
  { key: "menqing", name: "门清", fan: 1, desc: "没有碰/明杠（可选规则）" },
  { key: "zhongzhang", name: "中张", fan: 1, desc: "没有 1 和 9（断幺九，可选规则）" },
  { key: "tianhu", name: "天胡", fan: 5, desc: "庄家起手即胡" },
  { key: "dihu", name: "地胡", fan: 5, desc: "闲家第一圈即胡" },
];

export const patternByKey = Object.fromEntries(PATTERNS.map((p) => [p.key, p])) as Record<
  PatternKey,
  (typeof PATTERNS)[number]
>;
export const extraByKey = Object.fromEntries(EXTRAS.map((e) => [e.key, e])) as Record<
  ExtraKey,
  (typeof EXTRAS)[number]
>;

export interface FanSpec {
  pattern: PatternKey;
  qing: boolean; // 清一色
  gen: number; // 根数
  extras: ExtraKey[];
}

export interface FanLine {
  name: string;
  fan: number;
}

export function fanLines(spec: FanSpec): FanLine[] {
  const lines: FanLine[] = [];
  const p = patternByKey[spec.pattern] ?? patternByKey.pinghu;
  let pName = p.name;
  if (spec.pattern === "qidui" && spec.gen > 0) pName = "七对（龙七对）";
  lines.push({ name: pName, fan: p.fan });
  if (spec.qing) lines.push({ name: "清一色", fan: 2 });
  if (spec.gen > 0) lines.push({ name: `根 ×${spec.gen}`, fan: spec.gen });
  for (const k of spec.extras) {
    const e = extraByKey[k];
    if (e) lines.push({ name: e.name, fan: e.fan });
  }
  return lines;
}

export function totalFan(spec: FanSpec): number {
  return fanLines(spec).reduce((s, l) => s + l.fan, 0);
}

/** 常见组合的叫法，便于显示 */
export function comboName(spec: FanSpec): string {
  const q = spec.qing;
  const g = spec.gen;
  switch (spec.pattern) {
    case "pinghu":
      return q ? "清一色" : "平胡";
    case "duidui":
      return q ? "清对" : "对对胡";
    case "qidui":
      if (q) return g > 0 ? "清龙七对" : "清七对";
      return g > 0 ? "龙七对" : "七对";
    case "daiyao":
      return q ? "清带幺" : "带幺九";
    case "jingou":
      if (g >= 4) return q ? "清十八罗汉" : "十八罗汉";
      return q ? "清金钩钓" : "金钩钓";
    case "jiangdui":
      return "将对";
    case "jiangjingou":
      return "将金钩钓";
  }
}

export function emptySpec(): FanSpec {
  return { pattern: "pinghu", qing: false, gen: 0, extras: [] };
}

/** 常见牌型（直接点选），番数不含加番 */
export const COMBOS: { name: string; pattern: PatternKey; qing: boolean; gen: number }[] = [
  { name: "平胡", pattern: "pinghu", qing: false, gen: 0 },
  { name: "对对胡", pattern: "duidui", qing: false, gen: 0 },
  { name: "清一色", pattern: "pinghu", qing: true, gen: 0 },
  { name: "七对", pattern: "qidui", qing: false, gen: 0 },
  { name: "带幺九", pattern: "daiyao", qing: false, gen: 0 },
  { name: "金钩钓", pattern: "jingou", qing: false, gen: 0 },
  { name: "清对", pattern: "duidui", qing: true, gen: 0 },
  { name: "龙七对", pattern: "qidui", qing: false, gen: 1 },
  { name: "将对", pattern: "jiangdui", qing: false, gen: 0 },
  { name: "清七对", pattern: "qidui", qing: true, gen: 0 },
  { name: "清金钩钓", pattern: "jingou", qing: true, gen: 0 },
  { name: "清带幺", pattern: "daiyao", qing: true, gen: 0 },
  { name: "将金钩钓", pattern: "jiangjingou", qing: false, gen: 0 },
  { name: "清龙七对", pattern: "qidui", qing: true, gen: 1 },
  { name: "十八罗汉", pattern: "jingou", qing: false, gen: 4 },
  { name: "清十八罗汉", pattern: "jingou", qing: true, gen: 4 },
];

export function comboFan(c: (typeof COMBOS)[number]): number {
  return totalFan({ pattern: c.pattern, qing: c.qing, gen: c.gen, extras: [] });
}


/** 牌型名 + 多出来的根，如“清对 带1根” */
export function fullName(spec: FanSpec): string {
  const n = comboName(spec);
  const base = n.includes("十八罗汉") ? 4 : n.includes("龙七对") ? 1 : 0;
  const extra = spec.gen - base;
  return extra > 0 ? `${n} 带${extra}根` : n;
}
