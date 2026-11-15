import { cleanSettings, createRoom, joinRoom } from "@/lib/store";
import { bad, cleanName, json } from "@/lib/http";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const playerName = cleanName(body.playerName);
  if (!playerName) return bad("请输入你的名字");
  const code = await createRoom(cleanName(body.name), cleanSettings(body.settings));
  const player = await joinRoom(code, playerName);
  return json({ code, player });
}
