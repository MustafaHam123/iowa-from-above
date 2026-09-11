import { randomUUID } from "node:crypto";
import {
  mkdir,
  open,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type GoogleRequestKind = "root" | "render";
export type GoogleQuotaScope =
  | "google"
  | "monthly"
  | "visitor-daily";

type RequestCounts = Record<GoogleRequestKind, number>;

export type GoogleVisitor = {
  id: string;
  isNew: boolean;
};

type QuotaLedger = {
  version: 2;
  day: string;
  month: string;
  monthCounts: RequestCounts;
  visitorDailyRootCounts: Record<string, number>;
  visitorDailyRenderCounts: Record<string, number>;
};

const IOWA_TIME_ZONE = "America/Chicago";
const VISITOR_COOKIE_NAME = "iowa-map-visitor";
const VISITOR_COOKIE_MAX_AGE_SECONDS = 365 * 24 * 60 * 60;
const LIMITS = {
  monthly: { root: 1_000, render: 100_000 },
  visitorDaily: { root: 5, render: 2_000 },
} as const;
// Starting totals supplied for September. The proxy adds requests made after
// this baseline and automatically drops it when the Iowa calendar month rolls
// over.
const USAGE_BASELINE = {
  month: "2026-09",
  counts: { root: 500, render: 60_000 },
} as const;
// WARNING: TESTING ONLY. Set both flags back to true before release so each
// visitor is limited per America/Chicago calendar day to 5 Google root
// requests and 2,000 Google render requests.
const ENFORCE_VISITOR_DAILY_ROOT_LIMIT = false;
const ENFORCE_VISITOR_DAILY_RENDER_LIMIT = false;
const quotaFile =
  process.env.GOOGLE_API_QUOTA_FILE ??
  (process.env.VERCEL
    ? path.join(tmpdir(), "iowa-from-above", "google-api-quota.json")
    : path.join(process.cwd(), ".data", "google-api-quota.json"));
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: IOWA_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

let quotaGate = Promise.resolve();

export function getGoogleVisitor(request: Request): GoogleVisitor {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieValue = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${VISITOR_COOKIE_NAME}=`))
    ?.slice(VISITOR_COOKIE_NAME.length + 1);

  if (cookieValue && /^[0-9a-f-]{36}$/i.test(cookieValue)) {
    return { id: cookieValue, isNew: false };
  }

  return { id: randomUUID(), isNew: true };
}

export function addGoogleVisitorCookie(
  headers: Headers,
  request: Request,
  visitor: GoogleVisitor,
) {
  if (!visitor.isNew) {
    return headers;
  }

  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  headers.append(
    "Set-Cookie",
    `${VISITOR_COOKIE_NAME}=${visitor.id}; Path=/; Max-Age=${VISITOR_COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  );

  return headers;
}

export class GoogleQuotaLimitError extends Error {
  readonly scope: GoogleQuotaScope;
  readonly resetsAt: Date;

  constructor(scope: GoogleQuotaScope, resetsAt: Date) {
    super(`Google API ${scope} quota reached`);
    this.name = "GoogleQuotaLimitError";
    this.scope = scope;
    this.resetsAt = resetsAt;
  }
}

function chicagoDateKey(date = new Date()) {
  const parts = dateFormatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return { day: `${year}-${month}-${day}`, month: `${year}-${month}` };
}

function nextPeriodBoundary(period: "day" | "month", now = new Date()) {
  const initialKey = chicagoDateKey(now)[period];
  let low = now.getTime();
  let high = low + (period === "day" ? 36 : 35 * 24) * 60 * 60 * 1_000;

  while (high - low > 1_000) {
    const midpoint = Math.floor((low + high) / 2);

    if (chicagoDateKey(new Date(midpoint))[period] === initialKey) {
      low = midpoint;
    } else {
      high = midpoint;
    }
  }

  return new Date(high);
}

export function getNextGoogleDayBoundary(now = new Date()) {
  return nextPeriodBoundary("day", now);
}

function emptyLedger(now = new Date()): QuotaLedger {
  const keys = chicagoDateKey(now);

  return {
    version: 2,
    day: keys.day,
    month: keys.month,
    monthCounts: { root: 0, render: 0 },
    visitorDailyRootCounts: {},
    visitorDailyRenderCounts: {},
  };
}

function usageBaseline(month: string): RequestCounts {
  return month === USAGE_BASELINE.month
    ? { ...USAGE_BASELINE.counts }
    : { root: 0, render: 0 };
}

function normalizeLedger(value: unknown, now = new Date()): QuotaLedger {
  const fallback = emptyLedger(now);

  if (!value || typeof value !== "object") {
    return fallback;
  }

  const candidate = value as Partial<QuotaLedger>;
  const visitorDailyRootCounts: Record<string, number> = {};
  const visitorDailyRenderCounts: Record<string, number> = {};

  if (
    candidate.visitorDailyRootCounts &&
    typeof candidate.visitorDailyRootCounts === "object"
  ) {
    for (const [visitorId, count] of Object.entries(
      candidate.visitorDailyRootCounts,
    )) {
      visitorDailyRootCounts[visitorId] = Number(count) || 0;
    }
  }

  if (
    candidate.visitorDailyRenderCounts &&
    typeof candidate.visitorDailyRenderCounts === "object"
  ) {
    for (const [visitorId, count] of Object.entries(
      candidate.visitorDailyRenderCounts,
    )) {
      visitorDailyRenderCounts[visitorId] = Number(count) || 0;
    }
  }

  const isCurrentLedger = candidate.version === 2;
  const ledger: QuotaLedger = {
    version: 2,
    day: typeof candidate.day === "string" ? candidate.day : fallback.day,
    month:
      typeof candidate.month === "string" ? candidate.month : fallback.month,
    monthCounts: {
      root: isCurrentLedger ? Number(candidate.monthCounts?.root) || 0 : 0,
      render: isCurrentLedger ? Number(candidate.monthCounts?.render) || 0 : 0,
    },
    visitorDailyRootCounts,
    visitorDailyRenderCounts,
  };
  const keys = chicagoDateKey(now);

  if (ledger.month !== keys.month) {
    ledger.month = keys.month;
    ledger.monthCounts = { root: 0, render: 0 };
    ledger.visitorDailyRootCounts = {};
    ledger.visitorDailyRenderCounts = {};
  }

  if (ledger.day !== keys.day) {
    ledger.day = keys.day;
    ledger.visitorDailyRootCounts = {};
    ledger.visitorDailyRenderCounts = {};
  }

  return ledger;
}

async function readLedger() {
  try {
    return normalizeLedger(JSON.parse(await readFile(quotaFile, "utf8")));
  } catch {
    return emptyLedger();
  }
}

export async function getGoogleQuotaSnapshot() {
  const ledger = await readLedger();
  const baseline = usageBaseline(ledger.month);

  return {
    month: ledger.month,
    counts: {
      root: baseline.root + ledger.monthCounts.root,
      render: baseline.render + ledger.monthCounts.render,
    },
    limits: LIMITS.monthly,
  };
}

async function writeLedger(ledger: QuotaLedger) {
  const directory = path.dirname(quotaFile);
  const temporaryFile = `${quotaFile}.${process.pid}.tmp`;

  await mkdir(directory, { recursive: true });
  await writeFile(temporaryFile, JSON.stringify(ledger), "utf8");
  await rename(temporaryFile, quotaFile);
}

async function acquireFileLock() {
  const lockFile = `${quotaFile}.lock`;

  await mkdir(path.dirname(quotaFile), { recursive: true });

  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      const handle = await open(lockFile, "wx");

      return async () => {
        await handle.close();
        await unlink(lockFile).catch(() => undefined);
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }

      try {
        const lockStats = await stat(lockFile);

        if (Date.now() - lockStats.mtimeMs > 30_000) {
          await unlink(lockFile);
          continue;
        }
      } catch {
        continue;
      }

      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  throw new Error("Google API quota ledger is busy");
}

async function withQuotaGate<T>(task: () => Promise<T>) {
  const previousTask = quotaGate;
  let releaseTask: () => void = () => undefined;

  quotaGate = new Promise<void>((resolve) => {
    releaseTask = resolve;
  });
  await previousTask;
  let releaseFileLock: (() => Promise<void>) | undefined;

  try {
    releaseFileLock = await acquireFileLock();
    return await task();
  } finally {
    await releaseFileLock?.();
    releaseTask();
  }
}

export async function consumeGoogleRequestQuota(
  kind: GoogleRequestKind,
  visitorId: string,
) {
  return withQuotaGate(async () => {
    const now = new Date();
    const ledger = normalizeLedger(await readLedger(), now);
    const baseline = usageBaseline(ledger.month);

    if (
      baseline[kind] + ledger.monthCounts[kind] >=
      LIMITS.monthly[kind]
    ) {
      throw new GoogleQuotaLimitError(
        "monthly",
        nextPeriodBoundary("month", now),
      );
    }

    if (kind === "root" && ENFORCE_VISITOR_DAILY_ROOT_LIMIT) {
      const visitorDailyRootCount =
        ledger.visitorDailyRootCounts[visitorId] ?? 0;

      if (visitorDailyRootCount >= LIMITS.visitorDaily.root) {
        throw new GoogleQuotaLimitError(
          "visitor-daily",
          nextPeriodBoundary("day", now),
        );
      }

      ledger.visitorDailyRootCounts[visitorId] = visitorDailyRootCount + 1;
    } else if (kind === "render" && ENFORCE_VISITOR_DAILY_RENDER_LIMIT) {
      const visitorDailyRenderCount =
        ledger.visitorDailyRenderCounts[visitorId] ?? 0;

      if (visitorDailyRenderCount >= LIMITS.visitorDaily.render) {
        throw new GoogleQuotaLimitError(
          "visitor-daily",
          nextPeriodBoundary("day", now),
        );
      }

      ledger.visitorDailyRenderCounts[visitorId] =
        visitorDailyRenderCount + 1;
    }

    ledger.monthCounts[kind] += 1;

    await writeLedger(ledger);
  });
}

export function quotaResponseHeaders(error: GoogleQuotaLimitError) {
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((error.resetsAt.getTime() - Date.now()) / 1_000),
  );
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Retry-After": String(retryAfterSeconds),
    "X-Iowa-Quota-Limit": error.scope,
  });

  return headers;
}
