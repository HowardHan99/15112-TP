"use client";

import { useMemo, useRef, useState } from "react";
import { Tile } from "./Tile";
import { ALL_TILES, evaluateHand, sortTiles, tileIndex, tileName, type Meld, type MeldType } from "@/lib/mahjong";
import type { FanSpec } from "@/lib/fans";

const MELD_LABEL: Record<MeldType, string> = { peng: "碰", gang: "明杠", angang: "暗杠" };

async function resizeImage(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error("读取图片失败"));
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function HandAnalyzer({
  menqingZhongzhang = false,
  onApply,
}: {
  menqingZhongzhang?: boolean;
  onApply?: (spec: FanSpec) => void;
}) {
  const [concealed, setConcealed] = useState<string[]>([]);
  const [melds, setMelds] = useState<Meld[]>([]);
  const [mode, setMode] = useState<"hand" | MeldType>("hand");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [notes, setNotes] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const albumRef = useRef<HTMLInputElement>(null);

  const used = useMemo(() => {
    const c = new Array(27).fill(0);
    for (const t of concealed) c[tileIndex(t)]++;
    for (const m of melds) c[tileIndex(m.tile)] += m.type === "peng" ? 3 : 4;
    return c;
  }, [concealed, melds]);

  const count = concealed.length + melds.length * 3;
  const result = useMemo(
    () => (count >= 13 ? evaluateHand({ concealed, melds }, { menqingZhongzhang }) : null),
    [concealed, melds, count, menqingZhongzhang],
  );

  function tap(t: string) {
    setErr("");
    if (mode === "hand") {
      if (used[tileIndex(t)] >= 4) return setErr(`${tileName(t)} 已经 4 张了`);
      if (count >= 14) return setErr("已经 14 张了，先点上面的牌删掉一张");
      setConcealed((c) => [...c, t]);
    } else {
      const need = mode === "peng" ? 3 : 4;
      if (used[tileIndex(t)] + need > 4) return setErr(`${tileName(t)} 不够 ${need} 张`);
      if (count + 3 > 14) return setErr("牌太多了");
      setMelds((m) => [...m, { type: mode, tile: t }]);
      setMode("hand");
    }
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr("");
    setNotes("");
    setBusy(true);
    try {
      const data = await resizeImage(f);
      setPreview(data);
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error || "识别失败");
      if (!j.is_mahjong) throw new Error("照片里没看到麻将牌，换个角度再拍一张试试");
      setConcealed(sortTiles(j.concealed ?? []));
      setMelds(j.melds ?? []);
      setNotes(j.notes || "");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      if (camRef.current) camRef.current.value = "";
      if (albumRef.current) albumRef.current.value = "";
    }
  }

  return (
    <div>
      <div className="row">
        <button className="btn primary grow" disabled={busy} onClick={() => camRef.current?.click()}>
          {busy ? <><span className="spin" /> 识别中…</> : "拍照识牌"}
        </button>
        <button className="btn" disabled={busy} onClick={() => albumRef.current?.click()}>
          从相册选
        </button>
        <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        <input ref={albumRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      <p className="muted" style={{ margin: "6px 0 0" }}>
        把一家的牌摊开、正面朝上拍清楚（碰杠的牌放在一边）。识别完请核对，点牌可删除，下面可以补牌。
      </p>
      {preview && (
        <img src={preview} alt="照片" style={{ width: "100%", maxHeight: 160, objectFit: "contain", marginTop: 8, borderRadius: 10 }} />
      )}
      {notes && <div className="muted" style={{ marginTop: 6 }}>识别备注：{notes}</div>}
      {err && <div className="err">{err}</div>}

      <div className="card" style={{ minHeight: 72 }}>
        <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
          <b>我的牌 <span className="muted">（{count} 张）</span></b>
          {(concealed.length > 0 || melds.length > 0) && (
            <button className="btn small" onClick={() => { setConcealed([]); setMelds([]); setNotes(""); setPreview(null); }}>
              清空
            </button>
          )}
        </div>
        <div className="tiles" style={{ gap: 10, rowGap: 14 }}>
          {melds.map((m, i) => (
            <span key={`m${i}`} className="meld" onClick={() => setMelds((ms) => ms.filter((_, j) => j !== i))} title="点击删除">
              <span className="tag">{MELD_LABEL[m.type]}</span>
              {Array.from({ length: m.type === "peng" ? 3 : 4 }).map((_, k) => (
                <Tile key={k} t={m.tile} small back={m.type === "angang" && (k === 0 || k === 3)} />
              ))}
            </span>
          ))}
          <span className="tiles">
            {sortTiles(concealed).map((t, i) => (
              <Tile key={`${t}${i}`} t={t} onClick={() => setConcealed((c) => { const j = c.indexOf(t); return c.filter((_, k) => k !== j); })} />
            ))}
          </span>
          {count === 0 && <span className="muted">拍照，或点下面的牌把手牌输进来</span>}
        </div>
      </div>

      <div className="chips" style={{ margin: "8px 0" }}>
        {(["hand", "peng", "gang", "angang"] as const).map((m) => (
          <button key={m} className={`chip${mode === m ? " on" : ""}`} onClick={() => setMode(m)}>
            {m === "hand" ? "加手牌" : `加${MELD_LABEL[m]}`}
          </button>
        ))}
      </div>
      <div className="pad">
        {ALL_TILES.map((t) => (
          <Tile key={t} t={t} dim={used[tileIndex(t)] >= 4} onClick={() => tap(t)} />
        ))}
      </div>

      {result && (
        <div className="card">
          <div className={result.status === "win" || result.status === "tenpai" ? "ok" : "err"} style={{ margin: 0 }}>
            <b>{result.message}</b>
          </div>
          {result.status === "win" && result.best && (
            <>
              <table className="lines" style={{ marginTop: 8 }}>
                <tbody>
                  {result.best.lines.map((l, i) => (
                    <tr key={i}><td>{l.name}</td><td>{l.fan} 番</td></tr>
                  ))}
                </tbody>
              </table>
              <p className="muted" style={{ margin: "6px 0 0" }}>
                杠上花、抢杠胡、海底等看不出来的番，记账时再手动勾选。
              </p>
              {onApply && (
                <button className="btn primary block" style={{ marginTop: 10 }} onClick={() => onApply(result.best!.spec)}>
                  用这个番型记账
                </button>
              )}
            </>
          )}
          {result.status === "tenpai" && result.waits && (
            <table className="lines" style={{ marginTop: 8 }}>
              <tbody>
                {result.waits.map((w) => (
                  <tr key={w.tile}>
                    <td><span className="row" style={{ gap: 8 }}><Tile t={w.tile} small /> {w.result.combo}</span></td>
                    <td>{w.result.fan} 番</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
