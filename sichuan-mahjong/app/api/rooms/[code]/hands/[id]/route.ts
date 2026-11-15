import { deleteHand, getRoom, normCode } from "@/lib/store";
import { bad, json } from "@/lib/http";

export async function DELETE(req: Request, { params }: { params: Promise<{ code: string; id: string }> }) {
  const p = await params;
  const code = normCode(p.code);
  const room = await getRoom(code);
  if (!room) return bad("房间不存在", 404);
  const playerId = new URL(req.url).searchParams.get("playerId");
  if (!room.players.some((x) => x.id === playerId)) return bad("请先加入房间", 403);
  await deleteHand(code, p.id);
  return json(await getRoom(code));
}
