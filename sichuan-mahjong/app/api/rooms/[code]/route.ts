import { cleanSettings, getRoom, normCode, updateSettings } from "@/lib/store";
import { bad, cleanName, json } from "@/lib/http";

type Ctx = { params: Promise<{ code: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const room = await getRoom(normCode((await params).code));
  if (!room) return bad("房间不存在", 404);
  return json(room);
}

export async function PATCH(req: Request, { params }: Ctx) {
  const code = normCode((await params).code);
  const room = await getRoom(code);
  if (!room) return bad("房间不存在", 404);
  const body = await req.json().catch(() => ({}));
  await updateSettings(code, cleanSettings({ ...room.settings, ...body.settings }), cleanName(body.name));
  return json(await getRoom(code));
}
