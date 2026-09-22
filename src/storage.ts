// 存储层：只负责台账信封的持久化与恢复，与判定、界面解耦

import { createSeedLedger } from "./data";
import type { LedgerEnvelope, SettlementRecord } from "./types";

const STORAGE_KEY = "hxwl-01.hearing-aid-settlement.v1";

function isEnvelope(value: unknown): value is LedgerEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const env = value as Partial<LedgerEnvelope>;
  if (env.schema !== 1) return false;
  if (typeof env.savedAt !== "string") return false;
  if (typeof env.nextSeq !== "number") return false;
  if (!Array.isArray(env.records)) return false;
  return env.records.every((record: unknown) => {
    const r = record as Partial<SettlementRecord>;
    return (
      typeof r.id === "string" &&
      typeof r.customer === "string" &&
      typeof r.serial === "string" &&
      typeof r.project === "string" &&
      (typeof r.receivable === "number" || r.receivable === null) &&
      (typeof r.received === "number" || r.received === null) &&
      (typeof r.subsidy === "number" || r.subsidy === null) &&
      typeof r.version === "number" &&
      Array.isArray(r.revisions) &&
      typeof r.draft === "object" &&
      r.draft !== null
    );
  });
}

/** 读取台账：无缓存或缓存损坏时回落到演示数据 */
export function loadLedger(): LedgerEnvelope {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isEnvelope(parsed)) return parsed;
    }
  } catch {
    // 隐私模式或序列化失败时使用演示数据，不影响页面功能
  }
  return createSeedLedger();
}

export function saveLedger(envelope: LedgerEnvelope): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    // 存储失败仅放弃持久化，内存中的台账与界面仍保持一致
  }
}

export function resetLedger(): LedgerEnvelope {
  const seed = createSeedLedger();
  saveLedger(seed);
  return seed;
}
