"use client";

import { useMemo, useState } from "react";
import { EXTRAS, PATTERNS, comboName, emptySpec, totalFan, type ExtraKey, type FanSpec } from "@/lib/fans";
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
  return (
    <div>
      <button className="btn block" style={{ marginBottom: 8 }} onClick={() => setScan(true)}>
        📷 拍照 / 选牌 自动算番
      </button>
      <h3>牌型</h3>
      <div className="chips">
        {PATTERNS.map((p) => (
          <button key={p.key} className={`chip${spec.pattern === p.key ? " on" : ""}`} title={p.desc} onClick={() => onChange({ ...spec, pattern: p.key })}>
            {p.name}<small>{p.fan}番</small>
          </button>
        ))}
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className={`chip${spec.qing ? " on" : ""}`} onClick={() => onChange({ ...spec, qing: !spec.qing })}>
          清一色<small>+2</small>
        </button>
        <span className="muted" style={{ marginLeft: 8 }}>根（4 张一样）</span>
        <button className="btn small" onClick={() => onChange({ ...spec, gen: Math.max(0, spec.gen - 1) })}>−</button>
        <b style={{ minWidth: 18, textAlign: "center" }}>{spec.gen}</b>
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
      {scan && (
        <div className="sheet-bg" onClick={() => setScan(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-head">
              <h2>算番</h2>
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

export function HandEntry({ room, me, onClose, onSaved }: { room: Room; me: Me; onClose: () => void; onSaved: (r: Room) => void }) {
  const players = room.players;
  const s = room.settings;
  const [events, setEvents] = useState<HandEvent[]>([]);
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
    const winner = players.find((p) => !done.includes(p.id))?.id ?? players[0].id;
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
          底分 {s.base}，{s.cap} 番封顶，{s.zimo === "addBase" ? "自摸加底" : "自摸加番"}。一把里按顺序添加：胡牌、刮风下雨、查叫等。
        </p>

        {events.map((e, i) => {
          const done = huedBefore(i);
          return (
            <div key={i} className={`card evt ${e.kind}`}>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <b>{e.kind === "hu" ? "🀄 胡牌" : e.kind === "gang" ? "🀫 杠（刮风下雨）" : "💰 查叫 / 花猪 / 其他"}</b>
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
                      <b>{comboName(h.spec)}</b> · {totalFan(h.spec)} 番
                      {h.from === null && s.zimo === "addFan" ? " +1(自摸)" : ""}
                      {huFan(h, s) > s.cap ? `（封顶 ${s.cap} 番）` : ""} → 每家付 <b>{fmt(huPerPayer(h, s))}</b>
                      {h.from === null && s.zimo === "addBase" ? "（含自摸加底）" : ""}
                    </div>
                  </>
                );
              })()}

              {e.kind === "gang" && (() => {
                const g = e as Gang;
                return (
                  <>
                    <h3>谁杠</h3>
                    <PlayerChips
                      players={players}
                      value={g.who}
                      onChange={(w) => update(i, { ...g, who: w, from: g.from === w ? null : g.from, payers: players.map((p) => p.id).filter((id) => id !== w && !done.includes(id)) })}
                    />
                    <h3>杠的类型</h3>
                    <div className="chips">
                      {([["zhi", "直杠（点杠）", "点杠的人付 2 底"], ["ba", "巴杠（刮风）", "每家 1 底"], ["an", "暗杠（下雨）", "每家 2 底"]] as const).map(([k, n, d]) => (
                        <button key={k} className={`chip${g.gangType === k ? " on" : ""}`} onClick={() => update(i, { ...g, gangType: k })}>
                          {n}<small>{d}</small>
                        </button>
                      ))}
                    </div>
                    {g.gangType === "zhi" ? (
                      <>
                        <h3>谁点的杠</h3>
                        <PlayerChips players={players} value={g.from} onChange={(f) => update(i, { ...g, from: f })} exclude={[g.who]} red />
                      </>
                    ) : (
                      <>
                        <h3>谁付钱</h3>
                        <MultiPlayerChips players={players} value={g.payers} onChange={(v) => update(i, { ...g, payers: v })} exclude={[g.who]} />
                      </>
                    )}
                    <div className="muted" style={{ marginTop: 8 }}>每家付 {fmt(gangPerPayer(g, s))}</div>
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

        <div className="row" style={{ margin: "10px 0" }}>
          <button className="btn grow" onClick={() => add("hu")}>+ 胡牌</button>
          <button className="btn grow" onClick={() => add("gang")}>+ 杠</button>
          <button className="btn grow" onClick={() => add("adjust")}>+ 查叫/其他</button>
        </div>
        {events.length === 0 && <p className="muted">先点「+ 胡牌」。血战到底一把可以有多人胡，依次添加即可；流局可以只记杠和查叫。</p>}

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
    return `${n(e.winner)} ${how} · ${comboName(e.spec)} ${fan} 番${fan > settings.cap ? "(封顶)" : ""}`;
  }
  if (e.kind === "gang") {
    const t = e.gangType === "zhi" ? `直杠（${n(e.from)} 点）` : e.gangType === "ba" ? "巴杠" : "暗杠";
    return `${n(e.who)} ${t}`;
  }
  return `${e.reason}：${n(e.from)} → ${n(e.to)} ${fmt(e.amount)}`;
}
