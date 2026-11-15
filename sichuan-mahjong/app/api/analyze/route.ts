// 拍照识牌：让 Claude 只负责“看牌”，番数由 lib/mahjong.ts 确定性计算，用户可在界面上改正识别结果。
import Anthropic from "@anthropic-ai/sdk";
import { ALL_TILES } from "@/lib/mahjong";
import { bad, json } from "@/lib/http";

export const maxDuration = 60;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["is_mahjong", "concealed", "melds", "notes"],
  properties: {
    is_mahjong: { type: "boolean", description: "照片里是否能看到麻将手牌" },
    concealed: {
      type: "array",
      description: "立着/没碰出去的手牌（包括刚摸到或胡的那张），从左到右",
      items: { type: "string", enum: ALL_TILES },
    },
    melds: {
      type: "array",
      description: "放倒在一边的碰、杠",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "tile"],
        properties: {
          type: { type: "string", enum: ["peng", "gang", "angang"] },
          tile: { type: "string", enum: ALL_TILES },
        },
      },
    },
    notes: { type: "string", description: "用简短中文说明看不清或不确定的牌，没有就留空" },
  },
} as const;

const PROMPT = `这是一张四川麻将（血战到底）的照片。四川麻将只有万、条、筒三种花色，每种 1-9，没有字牌和花牌。
请识别这一个玩家的牌：
- 牌的编码：万 = m（如 "3m" 是三万），条/索 = s（"1s" 是一条，常画成一只鸟），筒/饼 = p（"5p" 是五筒）。
- concealed：手里立着的牌，加上刚摸到/胡的那张，从左到右列出。
- melds：放倒在一边的碰（3 张相同 → peng）、明杠（4 张相同 → gang）、暗杠（4 张中有扣着的 → angang），每组只写一次牌。
- 不要把桌面上打出去的牌（牌河）算进来。如果照片里有多个人的牌，只识别离镜头最近、最完整的那一手。
- 数清楚张数：碰杠按 3 张算，胡牌时一般共 14 张，听牌时 13 张。看不清的牌在 notes 里说明，尽量给出最可能的牌。`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return bad("服务器没有配置 ANTHROPIC_API_KEY，暂时不能拍照识牌", 503);
  const body = await req.json().catch(() => ({}));
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(String(body.image ?? ""));
  if (!m) return bad("图片格式不对");
  if (m[2].length > 6_000_000) return bad("图片太大了");

  const client = new Anthropic();
  try {
    const res = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
    if (res.stop_reason === "refusal") return bad("这张照片无法识别，请换一张试试", 422);
    const text = res.content.find((b) => b.type === "text");
    if (!text || text.type !== "text") return bad("识别失败，请重试", 502);
    return json(JSON.parse(text.text));
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return bad("识别请求太多了，稍等一下再试", 429);
    if (e instanceof Anthropic.AuthenticationError) return bad("ANTHROPIC_API_KEY 无效", 500);
    if (e instanceof Anthropic.APIError) return bad(`识别失败：${e.message}`, 502);
    throw e;
  }
}
