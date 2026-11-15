import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateHand } from "./mahjong.ts";
import { eventDeltas, settle, DEFAULT_SETTINGS, huPerPayer } from "./scoring.ts";

const t = (s: string) => s.trim().split(/\s+/);

test("平胡", () => {
  const r = evaluateHand({ concealed: t("1m 2m 3m 4m 5m 6m 7m 8m 9m 2s 3s 4s 5s 5s"), melds: [] });
  assert.equal(r.status, "win");
  assert.equal(r.best!.combo, "平胡");
  assert.equal(r.best!.fan, 0);
});

test("清一色", () => {
  const r = evaluateHand({ concealed: t("1m 2m 3m 4m 5m 6m 7m 8m 9m 2m 3m 4m 5m 5m"), melds: [] });
  assert.equal(r.best!.combo, "清一色");
  assert.equal(r.best!.fan, 2);
});

test("龙七对", () => {
  const r = evaluateHand({ concealed: t("1m 1m 1m 1m 3m 3m 5s 5s 6s 6s 7s 7s 9s 9s"), melds: [] });
  assert.equal(r.best!.combo, "龙七对");
  assert.equal(r.best!.fan, 3);
});

test("清对 with 碰", () => {
  const r = evaluateHand({
    concealed: t("2p 2p 2p 5p 5p 5p 8p 8p"),
    melds: [{ type: "peng", tile: "1p" }, { type: "peng", tile: "9p" }],
  });
  assert.equal(r.best!.combo, "清对");
  assert.equal(r.best!.fan, 3);
});

test("金钩钓 + 根", () => {
  const r = evaluateHand({
    concealed: t("3s 3s"),
    melds: [
      { type: "peng", tile: "1m" },
      { type: "gang", tile: "4m" },
      { type: "peng", tile: "6s" },
      { type: "angang", tile: "9s" },
    ],
  });
  assert.equal(r.status, "win");
  assert.equal(r.best!.combo, "金钩钓");
  assert.equal(r.best!.fan, 4);
});

test("将对", () => {
  const r = evaluateHand({ concealed: t("2m 2m 2m 5m 5m 5m 8m 8m 8m 2s 2s 2s 5s 5s"), melds: [] });
  assert.equal(r.best!.combo, "将对");
});

test("花猪 不能胡", () => {
  const r = evaluateHand({ concealed: t("1m 2m 3m 4s 5s 6s 7p 8p 9p 2s 3s 4s 5s 5s"), melds: [] });
  assert.equal(r.status, "notwin");
});

test("听牌", () => {
  const r = evaluateHand({ concealed: t("1m 2m 3m 4m 5m 6m 7m 8m 9m 2s 3s 4s 5s"), melds: [] });
  assert.equal(r.status, "tenpai");
  assert.deepEqual(r.waits!.map((w) => w.tile), ["2s", "5s"]);
});

test("计分", () => {
  const s = { ...DEFAULT_SETTINGS, base: 1, cap: 3 };
  const spec = { pattern: "qidui" as const, qing: true, gen: 1, extras: [] };
  // 清龙七对 5 番 封顶 3 → 8，自摸加底 +1 = 9
  assert.equal(huPerPayer({ kind: "hu", winner: "a", from: null, payers: ["b", "c", "d"], spec }, s), 9);
  const d = eventDeltas({ kind: "hu", winner: "a", from: null, payers: ["b", "c", "d"], spec }, s);
  assert.deepEqual(d, { a: 27, b: -9, c: -9, d: -9 });
  assert.deepEqual(settle({ a: 10, b: -4, c: -6 }), [
    { from: "c", to: "a", amount: 6 },
    { from: "b", to: "a", amount: 4 },
  ]);
});
