"use client";

import { useMemo, useState } from "react";
import { COMBOS, EXTRAS, comboFan, comboName, fullName, emptySpec, totalFan, type ExtraKey, type FanSpec } from "@/lib/fans";
import { eventDeltas, gangPerPayer, huFan, huPerPayer, validateEvent, type HandEvent, type Player, type Room } from "@/lib/scoring";
import { HandAnalyzer } from "./HandAnalyzer";
import { api, type Me } from "./api";

type Hu = Extract<HandEvent, { kind: "hu" }>;
type Gang = Extract<HandEvent, { kind: "gang" }>;
type Adj = Extract<HandEvent, { kind: "adjust" }>;

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));

function PlayerChips({
  players, value, onChange, exclude = [], red,
}: { players: Player[]; value: string | null; onChange: (id: string) => void; exclude?: (string | null)[]; red?: boolean }) {
  return (
    <div className="chips">
      {players.filter((p) => !exclude.includes(p.id)).map((p) => (
        <button key={p.id} className={`chip${value === p.id ? " on" : ""}${red ? " red" : ""}`} onClick={() => onChange(p.id)}>
          {p.name}
        </button>
      ))}
    </div>
  );
}

function MultiPlayerChips({
  players, value, onChange, exclude = [],
}: { players: Player[]; value: string[]; onChange: (ids: string[]) => void; exclude?: (string | null)[] }) {
  return (
    <div className="chips">
      {players.filter((p) => !exclude.includes(p.id)).map((p) => {
        const on = value.includes(p.id);
        return (
          <button key={p.id} className={`chip${on ? " on red" : ""}`} onClick={() => onChange(on ? value.filter((x) => x !== p.id) : [...value, p.id])}>
            {on ? "✓ " : ""}{p.name}
          </button>
        );
      })}
    </div>
  );
}

function FanEditor({ spec, onChange, room }: { spec: FanSpec; onChange: (s: FanSpec) => void; room: Room }) {
  const [scan, setScan] = useState(false);
  const toggle = (k: ExtraKey) =>
    onChange({ ...spec, extras: spec.extras.includes(k) ? spec.extras.filter((x) => x !== k) : [...spec.extras, k] });
  const current = comboName(spec);
  // 选了龙七对/十八罗汉，根至少 1/4；其余牌型根从 0 开始，用下面的 ± 加
  const baseGen = COMBOS.find((c) => c.name === current)?.gen ?? 0;
  const extraGen = Math.max(0, spec.gen - baseGen);
  return (
    <div>
      <h3>牌型</h3>
      <div className="combo-grid">
        {COMBOS.map((c) => (
          <button
            key={c.name}
            className={`chip${current === c.name ? " on" : ""}`}
            onClick={() => onChange({ ...spec, pattern: c.pattern, qing: c.qing, gen: c.gen + extraGen })}
          >
            {c.name}<small>{comboFan(c)}番</small>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <span>根（杠或 4 张一样）</span>
        <span className="grow" />
        <button className="btn small" onClick={() => onChange({ ...spec, gen: Math.max(baseGen, spec.gen - 1) })}>−</button>
        <b style={{ minWidth: 20, textAlign: "center" }}>{extraGen}</b>
        <button className="btn small" onClick={() => onChange({ ...spec, gen: Math.min(4, spec.gen + 1) })}>＋</button>
      </div>
      <h3>加番</h3>
      <div className="chips">
        {EXTRAS.filter((e) => room.settings.menqingZhongzhang || (e.key !== "menqing" && e.key !== "zhongzhang")).map((e) => (
          <button key={e.key} className={`chip${spec.extras.includes(e.key) ? " on" : ""}`} title={e.desc} onClick={() => toggle(e.key)}>
            {e.name}<small>+{e.fan}</small>
          </button>
        ))}
      </div>
      <button className="btn small" style={{ marginTop: 12, border: "none", padding: 0, color: "var(--muted)", textDecoration: "underline" }} onClick={() => setScan(true)}>
        不确定几番？点牌自动算
      </button>
      {scan && (
        <div className="sheet-bg" onClick={() => setScan(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>点牌算番</h2>
              <button className="btn small" onClick={() => setScan(false)}>关闭</button>
            </div>
            <HandAnalyzer
              menqingZhongzhang={room.settings.menqingZhongzhang}
              onApply={(s) => {
                // 保留手动勾的情景番（杠上花等）
                const situational = spec.extras.filter((x) => x !== "menqing" && x !== "zhongzhang");
                onChange({ ...s, extras: Array.from(new Set([...s.extras, ...situational])) });
                setScan(false);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const GANG_NAME = { an: "暗杠", ba: "巴杠", zhi: "直杠" } as const;

/** 杠：每人一行，点一下记一个 */
function GangPanel({
  players, events, setEvents, base,
}: { players: Player[]; events: HandEvent[]; setEvents: (f: (es: HandEvent[]) => HandEvent[]) => void; base: number }) {
  const [picking, setPicking] = useState<string | null>(null); // 正在选“谁点的杠”的人
  const gangs = events.map((e, i) => [e, i] as const).filter((x): x is readonly [Gang, number] => x[0].kind === "gang");
  const count = (who: string, t: Gang["gangType"]) => gangs.filter(([g]) => g.who === who && g.gangType === t).length;
  const others = (w: string) => players.map((p) => p.id).filter((id) => id !== w);
  const addGang = (who: string, gangType: Gang["gangType"], from: string | null = null) =>
    setEvents((es) => [...es, { kind: "gang", gangType, who, from, payers: gangType === "zhi" ? [] : others(who) }]);
  const removeLast = (who: string, t: Gang["gangType"]) => {
    const last = [...gangs].reverse().find(([g]) => g.who === who && g.gangType === t);
    if (last) setEvents((es) => es.filter((_, j) => j !== last[1]));
  };
  const nm = (id: string | null) => players.find((p) => p.id === id)?.name ?? "?";

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b>杠</b>
        <span className="muted">暗杠每家 {2 * base} · 巴杠每家 {base} · 直杠点杠者付 {2 * base}</span>
      </div>
      {players.map((p) => (
        <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
          <div className="row">
            <span className="grow">{p.name}</span>
            {(["an", "ba", "zhi"] as const).map((t) => {
              const n = count(p.id, t);
              return (
                <span key={t} className="gang-btn">
                  <button
                    className={`chip${n ? " on" : ""}`}
                    onClick={() => (t === "zhi" ? setPicking(picking === p.id ? null : p.id) : addGang(p.id, t))}
                  >
                    {GANG_NAME[t]}{n ? ` ×${n}` : ""}
                  </button>
                  {n > 0 && <button className="chip minus" onClick={() => removeLast(p.id, t)} aria-label="减一个">−</button>}
                </span>
              );
            })}
          </div>
          {picking === p.id && (
            <div className="chips" style={{ marginTop: 6 }}>
              <span className="muted">谁点的杠：</span>
              {players.filter((o) => o.id !== p.id).map((o) => (
                <button key={o.id} className="chip" onClick={() => { addGang(p.id, "zhi", o.id); setPicking(null); }}>{o.name}</button>
              ))}
            </div>
          )}
          {gangs.some(([g]) => g.who === p.id && g.gangType === "zhi") && (
            <div className="muted" style={{ marginTop: 2 }}>
              直杠：{gangs.filter(([g]) => g.who === p.id && g.gangType === "zhi").map(([g]) => `${nm(g.from)}点`).join("、")}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function HandEntry({ room, me, onClose, onSaved }: { room: Room; me: Me; onClose: () => void; onSaved: (r: Room) => void }) {
  const players = room.players;
  const s = room.settings;
  const [events, setEvents] = useState<HandEvent[]>(() => {
    const w = players.some((p) => p.id === me.id) ? me.id : players[0].id;
    return [{ kind: "hu", winner: w, from: null, payers: players.map((p) => p.id).filter((id) => id !== w), spec: emptySpec() }];
  });
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const name = (id: string | null) => players.find((p) => p.id === id)?.name ?? "?";

  // 这把里已经胡了的人（血战到底：胡了的人不再付钱）
  const huedBefore = (idx: number) => events.slice(0, idx).filter((e): e is Hu => e.kind === "hu").map((e) => e.winner);

  function update(i: number, e: HandEvent) {
    setEvents((es) => es.map((x, j) => (j === i ? e : x)));
  }
  function add(kind: HandEvent["kind"]) {
    const done = huedBefore(events.length);
    const winner = !done.includes(me.id) && players.some((p) => p.id === me.id)
      ? me.id
      : players.find((p) => !done.includes(p.id))?.id ?? players[0].id;
    const others = (w: string) => players.map((p) => p.id).filter((id) => id !== w && !done.includes(id));
    if (kind === "hu") setEvents((es) => [...es, { kind: "hu", winner, from: null, payers: others(winner), spec: emptySpec() }]);
    if (kind === "gang") setEvents((es) => [...es, { kind: "gang", gangType: "an", who: winner, from: null, payers: others(winner) }]);
    if (kind === "adjust")
      setEvents((es) => [...es, { kind: "adjust", from: players[0].id, to: players[1]?.id ?? players[0].id, amount: s.base, reason: "查叫" }]);
  }

  const totalD = useMemo(() => {
    const d: Record<string, number> = {};
    for (const e of events) for (const [k, v] of Object.entries(eventDeltas(e, s))) d[k] = (d[k] ?? 0) + v;
    return d;
  }, [events, s]);

  async function save() {
    for (const e of events) {
      const m = validateEvent(e, players);
      if (m) return setErr(m);
    }
    setBusy(true);
    setErr("");
    try {
      const r = await api<Room>(`/api/rooms/${room.code}/hands`, { method: "POST", body: { playerId: me.id, events, note } });
      onSaved(r);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>记第 {room.hands.length + 1} 把</h2>
          <button className="btn small" onClick={onClose}>取消</button>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          底分 {s.base}，{s.cap} 番封顶，{s.zimo === "addBase" ? "自摸加底" : "自摸加番"}。
        </p>

        {events.map((e, i) => {
          if (e.kind === "gang") return null;
          const done = huedBefore(i);
          return (
            <div key={i} className={`card evt ${e.kind}`}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{e.kind === "hu" ? "胡牌" : "查叫 / 其他"}</b>
                <button className="btn small danger" onClick={() => setEvents((es) => es.filter((_, j) => j !== i))}>删除</button>
              </div>

              {e.kind === "hu" && (() => {
                const h = e;
                const setWinner = (w: string) =>
                  update(i, { ...h, winner: w, from: h.from === w ? null : h.from, payers: players.map((p) => p.id).filter((id) => id !== w && !done.includes(id)) });
                return (
                  <>
                    <h3>谁胡了</h3>
                    <PlayerChips players={players} value={h.winner} onChange={setWinner} exclude={done} />
                    <h3>怎么胡的</h3>
                    <div className="chips">
                      <button className={`chip${h.from === null ? " on" : ""}`} onClick={() => update(i, { ...h, from: null })}>自摸</button>
                      {players.filter((p) => p.id !== h.winner && !done.includes(p.id)).map((p) => (
                        <button key={p.id} className={`chip${h.from === p.id ? " on red" : ""}`} onClick={() => update(i, { ...h, from: p.id })}>
                          {p.name} 点炮
                        </button>
                      ))}
                    </div>
                    {h.from === null && (
                      <>
                        <h3>谁付钱（还没胡的）</h3>
                        <MultiPlayerChips players={players} value={h.payers} onChange={(v) => update(i, { ...h, payers: v })} exclude={[h.winner]} />
                      </>
                    )}
                    <FanEditor spec={h.spec} room={room} onChange={(sp) => update(i, { ...h, spec: sp })} />
                    <div className="ok" style={{ marginTop: 12 }}>
                      <b>{fullName(h.spec)}</b> · {totalFan(h.spec)} 番
                      {h.from === null && s.zimo === "addFan" ? " +1(自摸)" : ""}
                      {huFan(h, s) > s.cap ? `（封顶 ${s.cap} 番）` : ""} → 每家付 <b>{fmt(huPerPayer(h, s))}</b>
                      {h.from === null && s.zimo === "addBase" ? "（含自摸加底）" : ""}
                    </div>
                  </>
                );
              })()}

              {e.kind === "adjust" && (() => {
                const a = e as Adj;
                return (
                  <>
                    <div className="chips" style={{ marginTop: 8 }}>
                      {["查叫", "查花猪", "退税", "其他"].map((r) => (
                        <button key={r} className={`chip${a.reason === r ? " on" : ""}`} onClick={() => update(i, { ...a, reason: r })}>{r}</button>
                      ))}
                    </div>
                    <h3>谁付</h3>
                    <PlayerChips players={players} value={a.from} onChange={(f) => update(i, { ...a, from: f })} red />
                    <h3>付给谁</h3>
                    <PlayerChips players={players} value={a.to} onChange={(t) => update(i, { ...a, to: t })} exclude={[a.from]} />
                    <label className="field">
                      <span>金额（筹码）</span>
                      <input type="number" inputMode="decimal" min={0} value={a.amount || ""} onChange={(ev) => update(i, { ...a, amount: Number(ev.target.value) })} />
                    </label>
                    <div className="chips">
                      {[0, 1, 2, 3, 4].map((f) => (
                        <button key={f} className="chip" onClick={() => update(i, { ...a, amount: s.base * 2 ** Math.min(f, s.cap) })}>
                          {f} 番 = {fmt(s.base * 2 ** Math.min(f, s.cap))}
                        </button>
                      ))}
                    </div>
                  </>
                );
              })()}
            </div>
          );
        })}

        <GangPanel players={players} events={events} setEvents={setEvents} base={s.base} />

        <div className="row" style={{ margin: "12px 0" }}>
          <button className="btn small" onClick={() => add("hu")}>+ 又有人胡</button>
          <button className="btn small" onClick={() => add("adjust")}>+ 查叫/花猪</button>
        </div>
        {events.length > 0 && (
          <div className="card">
            <b>这把结果</b>
            <div className="board" style={{ marginTop: 8 }}>
              {players.map((p) => {
                const v = totalD[p.id] ?? 0;
                return (
                  <div key={p.id} className="row" style={{ justifyContent: "space-between" }}>
                    <span>{p.name}</span>
                    <b className={v > 0 ? "pos" : v < 0 ? "neg" : "muted"}>{signed(v)}</b>
                  </div>
                );
              })}
            </div>
            <label className="field">
              <span>备注（可选）</span>
              <input type="text" value={note} maxLength={60} onChange={(e) => setNote(e.target.value)} placeholder="比如：东风局" />
            </label>
          </div>
        )}
        {err && <div className="err">{err}</div>}
        <button className="btn primary block big" disabled={busy || events.length === 0} onClick={save}>
          {busy ? "保存中…" : "保存这把"}
        </button>
      </div>
    </div>
  );
}

export function describeEvent(e: HandEvent, room: Room, settings = room.settings): string {
  const n = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? "?";
  if (e.kind === "hu") {
    const how = e.from ? `${n(e.from)} 点炮` : "自摸";
    const fan = huFan(e, settings);
    return `${n(e.winner)} ${how} · ${fullName(e.spec)} ${fan} 番${fan > settings.cap ? "(封顶)" : ""}`;
  }
  if (e.kind === "gang") {
    const t = e.gangType === "zhi" ? `直杠（${n(e.from)} 点）` : e.gangType === "ba" ? "巴杠" : "暗杠";
    return `${n(e.who)} ${t}`;
  }
  return `${e.reason}：${n(e.from)} → ${n(e.to)} ${fmt(e.amount)}`;
}
