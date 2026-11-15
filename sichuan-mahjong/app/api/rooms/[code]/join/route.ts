import { getRoom, joinRoom, normCode } from "@/lib/store";
import { bad, cleanName, json } from "@/lib/http";

export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normCode((await params).code);
  const body = await req.json().catch(() => ({}));
  const name = cleanName(body.name);
  if (!name) return bad("请输入你的名字");
  const room = await getRoom(code);
  if (!room) return bad("房间不存在", 404);
  if (room.players.length >= 8 && !room.players.some((p) => p.name === name)) return bad("房间人满了");
  const player = await joinRoom(code, name);
  return json({ player });
}
