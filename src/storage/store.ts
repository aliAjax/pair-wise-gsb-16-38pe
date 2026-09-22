// 存储层：localStorage 持久化，刷新后记录、凭据、金额与版本保持一致
import { seedRecords } from "../domain/seed";
import type { SettlementRecord } from "../domain/types";

const STORAGE_KEY = "hxwl-01:settlement:v1";

export function loadRecords(): SettlementRecord[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedRecords();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedRecords();
    return parsed as SettlementRecord[];
  } catch {
    return seedRecords();
  }
}

export function saveRecords(records: SettlementRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 存储不可用时保留内存态，不阻断操作
  }
}
