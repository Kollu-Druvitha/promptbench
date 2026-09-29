import fs from "fs";
import path from "path";
import { Redis } from "@upstash/redis";

// ---------------------------------------------------------------------------
// Storage adapter — Upstash Redis (serverless-friendly) OR the local JSON-file
// system (dev). Every document in the app goes through the two primitives
// below, so switching backends is a config change, not a code change:
//
//   - Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  -> Redis mode.
//     This is what serverless hosts (Vercel/Netlify) need: their filesystem
//     is read-only and ephemeral, so JSON files can't be written to disk.
//     Redis is a hosted, persistent key/value store with a free tier.
//
//   - Set neither -> filesystem mode, exactly as the project originally
//     worked (local dev, or a persistent Node host like Railway/Render).
//
// Keys used (all values are JSON strings):
//   db:<scope>     the tests array for one scope ("local" or a user id)
//   users          the user registry ({ users: [...] })
//   prefs:<userId> one user's preference weights
// ---------------------------------------------------------------------------

function redisConfigured(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

let redisClient: Redis | null = null;
function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return redisClient;
}

// Ephemeral in-memory cache used when the disk is read-only (e.g. a serverless
// host deployed without the UPSTASH_* env vars). Keeps a single instance's
// writes coherent across requests instead of crashing with EROFS. Data is NOT
// durable across cold starts — the real persistence path is Redis.
const memoryCache = new Map<string, string>(); // filePath -> JSON string

function cacheGet<T>(filePath: string): T | undefined {
  const mem = memoryCache.get(filePath);
  if (mem === undefined) return undefined;
  try {
    return JSON.parse(mem) as T;
  } catch {
    return undefined;
  }
}

function writeFileOrFallback(filePath: string, raw: string, label: string): void {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, raw);
  } catch (err) {
    // Read-only filesystem (serverless host without UPSTASH_* configured).
    // Keep the value in memory so requests don't 500; it just won't persist.
    console.error(
      `[storage] ${label} failed to write "${filePath}" (read-only FS?). ` +
        `Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN for durable storage. ` +
        `Using in-memory fallback: ${err instanceof Error ? err.message : String(err)}`
    );
    memoryCache.set(filePath, raw);
  }
}

function readFileJson<T>(filePath: string, fallback: () => T): T {
  const mem = cacheGet<T>(filePath);
  if (mem !== undefined) return mem;

  if (!fs.existsSync(filePath)) {
    const initial = fallback();
    writeFileOrFallback(filePath, JSON.stringify(initial, null, 2), "init");
    return initial;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or empty — reset rather than crash the app.
    const initial = fallback();
    writeFileOrFallback(filePath, JSON.stringify(initial, null, 2), "reset");
    return initial;
  }
}

/**
 * Read a JSON document from the active backend. If the document doesn't exist,
 * it is created with `fallback()` and that value is returned.
 */
export async function kvGetJson<T>(
  redisKey: string,
  filePath: string,
  fallback: () => T
): Promise<T> {
  if (redisConfigured()) {
    const raw = await getRedis().get<string>(redisKey);
    if (raw == null) {
      const initial = fallback();
      await getRedis().set(redisKey, JSON.stringify(initial));
      return initial;
    }
    try {
      return JSON.parse(raw) as T;
    } catch {
      const initial = fallback();
      await getRedis().set(redisKey, JSON.stringify(initial));
      return initial;
    }
  }
  return readFileJson(filePath, fallback);
}

/** Write a JSON document to the active backend. */
export async function kvSetJson<T>(
  redisKey: string,
  filePath: string,
  data: T
): Promise<void> {
  if (redisConfigured()) {
    await getRedis().set(redisKey, JSON.stringify(data));
    return;
  }
  writeFileOrFallback(filePath, JSON.stringify(data, null, 2), "write");
}