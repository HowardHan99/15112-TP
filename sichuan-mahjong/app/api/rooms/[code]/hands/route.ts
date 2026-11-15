import { addHand, clearHands, getRoom, normCode } from "@/lib/store";
import { bad, json } from "@/lib/http";
import { validateEvent, type HandEvent } from "@/lib/scoring";
import { EXTRAS, PATTERNS, type ExtraKey, type PatternKey } from "@/lib/fans";

const PKEYS = new Set(PATTERNS.map((p) => p.key));
const EKEYS = new Set(EXTRAS.map((e) => e.key));
const ids = (a: unknown) => (Array.isArray(a) ? a.map(String) : []);

// 只保留认识的字段
function clean(e: any): HandEvent | null {
  if (e?.kind === "hu") {
    const pattern = PKEYS.has(e.spec?.pattern) ? (e.spec.pattern as PatternKey) : "pinghu";
    return {
      kind: "hu",
      winner: String(e.winner),
      from: e.from ? String(e.from) : null,
      payers: ids(e.payers),
      spec: {
        pattern,
        qing: !!e.spec?.qing,
        gen: Number(e.spec?.gen) || 0,
        extras: ids(e.spec?.extras).filter((x) => EKEYS.has(x as ExtraKey)) as ExtraKey[],
      },
    };
  }
  if (e?.kind === "gang") {
    const gangType = ["zhi", "ba", "an"].includes(e.gangType) ? e.gangType : "an";
    return { kind: "gang", gangType, who: String(e.who), from: e.from ? String(e.from) : null, payers: ids(e.payers) };
  }
  if (e?.kind === "adjust") {
    return {
      kind: "adjust",
      from: String(e.from),
      to: String(e.to),
      amount: Number(e.amount),
      reason: String(e.reason ?? "").slice(0, 30),
    };
  }
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normCode((await params).code);
  const room = await getRoom(code);
  if (!room) return bad("房间不存在", 404);
  const body = await req.json().catch(() => ({}));
  if (!room.players.some((p) => p.id === body.playerId)) return bad("请先加入房间", 403);
  const raw = Array.isArray(body.events) ? body.events : [];
  if (raw.length === 0) return bad("这把还没有记录任何内容");
  if (raw.length > 30) return bad("事件太多了");
  const events: HandEvent[] = [];
  for (const r of raw) {
    const e = clean(r);
    if (!e) return bad("记录格式不对");
    const err = validateEvent(e, room.players);
    if (err) return bad(err);
    events.push(e);
  }
  await addHand(code, {
    createdBy: body.playerId,
    events,
    settings: room.settings,
    note: String(body.note ?? "").slice(0, 60) || undefined,
  });
  return json(await getRoom(code));
}

export async function DELETE(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normCode((await params).code);
  const room = await getRoom(code);
  if (!room) return bad("房间不存在", 404);
  const playerId = new URL(req.url).searchParams.get("playerId");
  if (!room.players.some((p) => p.id === playerId)) return bad("请先加入", 403);
  await clearHands(code);
  return json(await getRoom(code));
}
