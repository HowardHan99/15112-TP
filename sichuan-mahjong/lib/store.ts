// 房间存储：部署到 Vercel 时用 Upstash Redis（Vercel Marketplace 一键添加），本地开发没有配置时用内存。
// 每把记录用 RPUSH 追加、删除用 SADD 标记，多人同时记账也不会互相覆盖。

import { Redis } from "@upstash/redis";
import { DEFAULT_SETTINGS, type Hand, type Player, type Room, type Settings } from "./scoring.ts";

const TTL = 60 * 60 * 24 * 90; // 90 天无操作自动过期

interface Meta {
  code: string;
  name: string;
  createdAt: number;
  settings: Settings;
}

interface Backend {
  get(key: string): Promise<string | null>;
  set(key: string, v: string): Promise<void>;
  hsetnx(key: string, field: string, v: string): Promise<boolean>;
  hgetall(key: string): Promise<Record<string, string>>;
  rpush(key: string, v: string): Promise<void>;
  lrange(key: string): Promise<string[]>;
  sadd(key: string, v: string): Promise<void>;
  smembers(key: string): Promise<string[]>;
  touch(keys: string[]): Promise<void>;
}

function redisBackend(url: string, token: string): Backend {
  // 关掉自动反序列化，统一存字符串
  const r = new Redis({ url, token, automaticDeserialization: false });
  return {
    get: async (k) => (await r.get<string>(k)) ?? null,
    set: async (k, v) => void (await r.set(k, v, { ex: TTL })),
    hsetnx: async (k, f, v) => (await r.hsetnx(k, f, v)) === 1,
    hgetall: async (k) => ((await r.hgetall<Record<string, string>>(k)) ?? {}) as Record<string, string>,
    rpush: async (k, v) => void (await r.rpush(k, v)),
    lrange: async (k) => (await r.lrange<string>(k, 0, -1)) ?? [],
    sadd: async (k, v) => void (await r.sadd(k, v)),
    smembers: async (k) => (await r.smembers<string[]>(k)) ?? [],
    touch: async (keys) => {
      const p = r.pipeline();
      for (const k of keys) p.expire(k, TTL);
      await p.exec();
    },
  };
}

function memoryBackend(): Backend {
  const g = globalThis as unknown as { __mjmem?: Map<string, unknown> };
  const m = (g.__mjmem ??= new Map());
  const hash = (k: string) => (m.get(k) as Record<string, string>) ?? (m.set(k, {}), m.get(k) as Record<string, string>);
  const list = (k: string) => (m.get(k) as string[]) ?? (m.set(k, []), m.get(k) as string[]);
  return {
    get: async (k) => (m.get(k) as string) ?? null,
    set: async (k, v) => void m.set(k, v),
    hsetnx: async (k, f, v) => {
      const h = hash(k);
      if (f in h) return false;
      h[f] = v;
      return true;
    },
    hgetall: async (k) => ({ ...hash(k) }),
    rpush: async (k, v) => void list(k).push(v),
    lrange: async (k) => [...list(k)],
    sadd: async (k, v) => {
      const l = list(k);
      if (!l.includes(v)) l.push(v);
    },
    smembers: async (k) => [...list(k)],
    touch: async () => {},
  };
}

let backend: Backend | null = null;
function db(): Backend {
  if (backend) return backend;
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) backend = redisBackend(url, token);
  else {
    if (process.env.VERCEL) console.warn("没有配置 Redis，房间数据只存在内存里，会丢失！");
    backend = memoryBackend();
  }
  return backend;
}

const K = {
  meta: (c: string) => `mj:${c}:meta`,
  players: (c: string) => `mj:${c}:players`, // name -> id
  hands: (c: string) => `mj:${c}:hands`,
  deleted: (c: string) => `mj:${c}:deleted`,
};
const allKeys = (c: string) => [K.meta(c), K.players(c), K.hands(c), K.deleted(c)];

function rid(n = 10): string {
  const a = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(n));
  for (const b of bytes) s += a[b % a.length];
  return s;
}

function roomCode(): string {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (const b of crypto.getRandomValues(new Uint8Array(5))) s += a[b % a.length];
  return s;
}

export function normCode(c: string): string {
  return c.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function cleanSettings(s: Partial<Settings> | undefined): Settings {
  const base = Number(s?.base);
  const cap = Number(s?.cap);
  return {
    base: Number.isFinite(base) && base > 0 && base <= 100000 ? base : DEFAULT_SETTINGS.base,
    cap: Number.isInteger(cap) && cap >= 1 && cap <= 13 ? cap : DEFAULT_SETTINGS.cap,
    zimo: s?.zimo === "addFan" ? "addFan" : "addBase",
    menqingZhongzhang: !!s?.menqingZhongzhang,
  };
}

export async function createRoom(name: string, settings: Settings): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const code = roomCode();
    if (await db().get(K.meta(code))) continue;
    const meta: Meta = { code, name: name || `${code} 号桌`, createdAt: Date.now(), settings };
    await db().set(K.meta(code), JSON.stringify(meta));
    return code;
  }
  throw new Error("创建房间失败，请重试");
}

async function getMeta(code: string): Promise<Meta | null> {
  const raw = await db().get(K.meta(code));
  return raw ? (JSON.parse(raw) as Meta) : null;
}

export const DEFAULT_ROOM = "MAIN";

export async function getRoom(code: string): Promise<Room | null> {
  let meta = await getMeta(code);
  if (!meta && code === DEFAULT_ROOM) {
    // 默认房间：第一次访问时自动创建
    meta = { code, name: "川麻记分", createdAt: Date.now(), settings: DEFAULT_SETTINGS };
    await db().set(K.meta(code), JSON.stringify(meta));
  }
  if (!meta) return null;
  const [players, hands, deleted] = await Promise.all([
    db().hgetall(K.players(code)),
    db().lrange(K.hands(code)),
    db().smembers(K.deleted(code)),
  ]);
  const del = new Set(deleted);
  const plist: Player[] = Object.entries(players).map(([name, v]) => {
    const p = JSON.parse(v) as { id: string; joinedAt: number };
    return { id: p.id, name, joinedAt: p.joinedAt } as Player & { joinedAt: number };
  });
  plist.sort((a, b) => (a as Player & { joinedAt: number }).joinedAt - (b as Player & { joinedAt: number }).joinedAt);
  return {
    ...meta,
    players: plist.map(({ id, name }) => ({ id, name })),
    hands: hands.map((h) => JSON.parse(h) as Hand).filter((h) => !del.has(h.id)),
  };
}

/** 加入房间；同名玩家视为同一个人（换手机也能接着记） */
export async function joinRoom(code: string, name: string): Promise<Player | null> {
  if (!(await getMeta(code))) return null;
  const id = rid();
  await db().hsetnx(K.players(code), name, JSON.stringify({ id, joinedAt: Date.now() }));
  const all = await db().hgetall(K.players(code));
  const p = JSON.parse(all[name]) as { id: string };
  await db().touch(allKeys(code));
  return { id: p.id, name };
}

export async function addHand(code: string, hand: Omit<Hand, "id" | "createdAt">): Promise<Hand> {
  const h: Hand = { ...hand, id: rid(), createdAt: Date.now() };
  await db().rpush(K.hands(code), JSON.stringify(h));
  await db().touch(allKeys(code));
  return h;
}

export async function deleteHand(code: string, id: string): Promise<void> {
  await db().sadd(K.deleted(code), id);
  await db().touch(allKeys(code));
}

/** 新一局：清空所有记录（玩家保留） */
export async function clearHands(code: string): Promise<void> {
  const room = await getRoom(code);
  for (const h of room?.hands ?? []) await db().sadd(K.deleted(code), h.id);
  await db().touch(allKeys(code));
}

export async function updateSettings(code: string, settings: Settings, name?: string): Promise<void> {
  const meta = await getMeta(code);
  if (!meta) return;
  await db().set(K.meta(code), JSON.stringify({ ...meta, settings, name: name?.trim() || meta.name }));
}
