"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { handDeltas, settle, totals, type Room, type Settings } from "@/lib/scoring";
import { api, loadMe, saveMe, type Me } from "./api";
import { HandEntry, describeEvent } from "./HandEntry";

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();
const signed = (n: number) => (n > 0 ? `+${fmt(n)}` : fmt(n));

function SettingsSheet({ room, onClose, onSaved }: { room: Room; onClose: () => void; onSaved: (r: Room) => void }) {
  const [s, setS] = useState<Settings>(room.settings);
  const [name, setName] = useState(room.name);
  const [err, setErr] = useState("");
  async function save() {
    try {
      onSaved(await api<Room>(`/api/rooms/${room.code}`, { method: "PATCH", body: { settings: s, name } }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }
  return (
    <div className="sheet-bg" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>房间规则</h2>
          <button className="btn small" onClick={onClose}>关闭</button>
        </div>
        <SettingsForm s={s} setS={setS} />
        <label className="field">
          <span>房间名</span>
          <input type="text" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} />
        </label>
        <p className="muted">改规则只影响之后记的把数，已经记过的按当时规则算。</p>
        {err && <div className="err">{err}</div>}
        <button className="btn primary block" onClick={save}>保存</button>
      </div>
    </div>
  );
}

export function SettingsForm({ s, setS }: { s: Settings; setS: (s: Settings) => void }) {
  return (
    <>
      <div className="row">
        <label className="field grow">
          <span>底分（每番翻倍）</span>
          <input type="number" inputMode="decimal" min={0.1} value={s.base} onChange={(e) => setS({ ...s, base: Number(e.target.value) })} />
        </label>
        <label className="field grow">
          <span>封顶</span>
          <select value={s.cap} onChange={(e) => setS({ ...s, cap: Number(e.target.value) })}>
            {[2, 3, 4, 5, 6, 8, 13].map((c) => (
              <option key={c} value={c}>{c} 番（{fmt(s.base * 2 ** c)}）</option>
            ))}
          </select>
        </label>
      </div>
      <div className="chips">
        <button className={`chip${s.zimo === "addBase" ? " on" : ""}`} onClick={() => setS({ ...s, zimo: "addBase" })}>自摸加底</button>
        <button className={`chip${s.zimo === "addFan" ? " on" : ""}`} onClick={() => setS({ ...s, zimo: "addFan" })}>自摸加番</button>
        <button className={`chip${s.menqingZhongzhang ? " on" : ""}`} onClick={() => setS({ ...s, menqingZhongzhang: !s.menqingZhongzhang })}>
          门清/中张 加番
        </button>
      </div>
    </>
  );
}

export function RoomView({ code }: { code: string }) {
  const [room, setRoom] = useState<Room | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [joinName, setJoinName] = useState("");
  const [entry, setEntry] = useState(false);
  const [settings, setSettings] = useState(false);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setRoom(await api<Room>(`/api/rooms/${code}`));
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [code]);

  useEffect(() => {
    setMe(loadMe(code));
    setReady(true);
    refresh();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 3000);
    const onVis = () => document.visibilityState === "visible" && refresh();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [code, refresh]);

  // 本地记的身份如果已不在房间（例如房间被重建），清掉
  const meValid = !!(me && room?.players.some((p) => p.id === me.id));

  const tot = useMemo(() => (room ? totals(room) : {}), [room]);
  const plan = useMemo(() => settle(tot), [tot]);

  async function join() {
    try {
      const { player } = await api<{ player: Me }>(`/api/rooms/${code}/join`, { method: "POST", body: { name: joinName } });
      saveMe(code, player, room?.name);
      setMe(player);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function del(id: string) {
    if (!me || !confirm("确定删除这一把？")) return;
    try {
      setRoom(await api<Room>(`/api/rooms/${code}/hands/${id}?playerId=${me.id}`, { method: "DELETE" }));
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function share() {
    const url = `${location.origin}/room/${code}`;
    try {
      if (navigator.share) await navigator.share({ title: `川麻记分 · 房间 ${code}`, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {}
  }

  if (!room) {
    return (
      <div className="wrap">
        <Link href="/">← 首页</Link>
        {err ? <div className="err" style={{ marginTop: 16 }}>{err}</div> : <p className="muted">加载中…</p>}
      </div>
    );
  }

  const name = (id: string) => room.players.find((p) => p.id === id)?.name ?? "?";

  return (
    <div className="wrap">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <Link href="/">← 首页</Link>
        <div className="row">
          <Link className="btn small" href="/calc">算番器</Link>
          <button className="btn small" onClick={() => setSettings(true)}>规则</button>
          <button className="btn small" onClick={share}>{copied ? "已复制" : "邀请"}</button>
        </div>
      </div>
      <h1>{room.name}</h1>
      <div className="muted">
        房间号 <span className="code">{room.code}</span> · 底分 {room.settings.base} · {room.settings.cap} 番封顶 ·{" "}
        {room.settings.zimo === "addBase" ? "自摸加底" : "自摸加番"} · 共 {room.hands.length} 把
      </div>
      {err && <div className="err">{err}</div>}

      {ready && !meValid && (
        <div className="card">
          <b>加入这个房间</b>
          <p className="muted" style={{ margin: "4px 0 8px" }}>输入名字加入。用同一个名字可以在别的手机上接着记。</p>
          <div className="row">
            <input type="text" className="grow" style={{ width: "auto", flex: 1 }} value={joinName} maxLength={16} placeholder="你的名字" onChange={(e) => setJoinName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && join()} />
            <button className="btn primary" onClick={join} disabled={!joinName.trim()}>加入</button>
          </div>
          {room.players.length > 0 && (
            <div className="chips" style={{ marginTop: 8 }}>
              <span className="muted">我是：</span>
              {room.players.map((p) => (
                <button key={p.id} className="chip" onClick={() => setJoinName(p.name)}>{p.name}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <h2>筹码</h2>
      {room.players.length === 0 ? (
        <p className="muted">还没有人加入。</p>
      ) : (
        <div className="board">
          {room.players.map((p) => {
            const v = tot[p.id] ?? 0;
            return (
              <div key={p.id} className={`pcard${me?.id === p.id ? " me" : ""}`}>
                <div className="nm">{p.name}{me?.id === p.id ? "（我）" : ""}</div>
                <div className={`sc ${v > 0 ? "pos" : v < 0 ? "neg" : ""}`}>{signed(v)}</div>
              </div>
            );
          })}
        </div>
      )}
      {room.players.length < 2 && meValid && (
        <p className="muted">把房间号 <span className="code">{room.code}</span> 或邀请链接发给牌友，至少 2 人才能记账。</p>
      )}

      {plan.length > 0 && (
        <>
          <h2>结算方案</h2>
          <div className="card">
            {plan.map((t, i) => (
              <div key={i} className="row" style={{ justifyContent: "space-between", padding: "4px 0" }}>
                <span>{name(t.from)} → {name(t.to)}</span>
                <b>{fmt(t.amount)}</b>
              </div>
            ))}
          </div>
        </>
      )}

      <h2>每把记录</h2>
      {room.hands.length === 0 && <p className="muted">还没有记录。</p>}
      {[...room.hands].reverse().map((h, idx) => {
        const d = handDeltas(h, h.settings ?? room.settings);
        return (
          <div key={h.id} className="card">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>第 {room.hands.length - idx} 把</b>
              <span className="muted">
                {new Date(h.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} · {name(h.createdBy)} 记
              </span>
            </div>
            {h.events.map((e, i) => (
              <div key={i} className={`evt ${e.kind}`}>{describeEvent(e, room, h.settings ?? room.settings)}</div>
            ))}
            {h.note && <div className="muted">备注：{h.note}</div>}
            <div className="row" style={{ justifyContent: "space-between", marginTop: 6 }}>
              <div className="row" style={{ gap: 12 }}>
                {room.players.filter((p) => d[p.id]).map((p) => (
                  <span key={p.id}>
                    {p.name} <b className={d[p.id] > 0 ? "pos" : "neg"}>{signed(d[p.id])}</b>
                  </span>
                ))}
              </div>
              {meValid && <button className="btn small danger" onClick={() => del(h.id)}>删除</button>}
            </div>
          </div>
        );
      })}

      {meValid && room.players.length >= 2 && (
        <div className="fab">
          <div className="inner">
            <button className="btn primary block big" onClick={() => setEntry(true)}>记一把</button>
          </div>
        </div>
      )}
      {entry && me && (
        <HandEntry room={room} me={me} onClose={() => setEntry(false)} onSaved={(r) => { setRoom(r); setEntry(false); }} />
      )}
      {settings && <SettingsSheet room={room} onClose={() => setSettings(false)} onSaved={(r) => { setRoom(r); setSettings(false); }} />}
    </div>
  );
}
