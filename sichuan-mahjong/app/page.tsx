"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/scoring";
import { api, loadRecent, saveMe, type Me } from "@/components/api";
import { SettingsForm } from "@/components/RoomView";

export default function Home() {
  const router = useRouter();
  const [myName, setMyName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [recent, setRecent] = useState<{ code: string; name: string }[]>([]);

  useEffect(() => {
    setRecent(loadRecent());
    try { const n = localStorage.getItem("mj:name"); if (n) setMyName((cur) => cur || n); } catch {}
  }, []);

  async function create() {
    setBusy(true);
    setErr("");
    try {
      try { localStorage.setItem("mj:name", myName.trim()); } catch {}
      const r = await api<{ code: string; player: Me }>("/api/rooms", { method: "POST", body: { name: roomName, playerName: myName, settings: s } });
      saveMe(r.code, r.player, roomName || r.code);
      router.push(`/room/${r.code}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="wrap">
      <h1>川麻记分</h1>
      <p className="muted" style={{ marginTop: 0 }}>血战到底 · 算番 · 记筹码 · 多人房间实时同步 · 拍照识牌</p>

      <div className="card">
        <b>加入房间</b>
        <div className="row" style={{ marginTop: 8 }}>
          <input type="text" className="code" style={{ flex: 1, width: "auto", textTransform: "uppercase" }} placeholder="输入房间号" value={code} maxLength={8} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && code.trim() && router.push(`/room/${code.trim().toUpperCase()}`)} />
          <button className="btn primary" disabled={!code.trim()} onClick={() => router.push(`/room/${code.trim().toUpperCase()}`)}>进入</button>
        </div>
      </div>

      <div className="card">
        <b>开新房间</b>
        <label className="field">
          <span>你的名字</span>
          <input type="text" value={myName} maxLength={16} onChange={(e) => setMyName(e.target.value)} placeholder="比如：老王" />
        </label>
        <label className="field">
          <span>房间名（可选）</span>
          <input type="text" value={roomName} maxLength={16} onChange={(e) => setRoomName(e.target.value)} placeholder="周五牌局" />
        </label>
        <SettingsForm s={s} setS={setS} />
        {err && <div className="err">{err}</div>}
        <button className="btn primary block big" style={{ marginTop: 12 }} disabled={busy || !myName.trim()} onClick={create}>
          {busy ? "创建中…" : "创建房间"}
        </button>
      </div>

      <Link href="/calc" className="card" style={{ display: "block", textDecoration: "none", color: "inherit" }}>
        <b>算番器 ›</b>
        <div className="muted">拍一张牌的照片，看胡没胡、有几番、听什么牌</div>
      </Link>

      {recent.length > 0 && (
        <>
          <h2>最近的房间</h2>
          {recent.map((r) => (
            <Link key={r.code} href={`/room/${r.code}`} className="card row" style={{ justifyContent: "space-between", textDecoration: "none", color: "inherit" }}>
              <span>{r.name}</span>
              <span className="code muted">{r.code}</span>
            </Link>
          ))}
        </>
      )}
    </div>
  );
}
