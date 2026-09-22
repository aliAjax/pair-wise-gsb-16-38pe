// 判定层：登记校验、序列号唯一绑定、补贴上限与版本迁移，全部为纯函数
import type {
  Conflict,
  SettlementDraft,
  SettlementRecord,
  SettlementVersion,
  SubsidyChannel,
  VoucherDraft,
} from "./types";

export const CHANNELS: SubsidyChannel[] = ["医保", "公益"];

let idCounter = 0;

export function genId(prefix: string): string {
  idCounter += 1;
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}${rand}`;
}

export function emptyDraft(): SettlementDraft {
  return { serialNo: "", customer: "", item: "", receivable: "", vouchers: [] };
}

export function cloneDraft(draft: SettlementDraft): SettlementDraft {
  return { ...draft, vouchers: draft.vouchers.map((voucher) => ({ ...voucher })) };
}

export function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100) / 100;
}

export function fmtMoney(value: number | null): string {
  if (value === null) return "—";
  return `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function subsidyTotal(vouchers: VoucherDraft[]): number {
  return vouchers.reduce((sum, voucher) => sum + (parseAmount(voucher.amount) ?? 0), 0);
}

// 序列号 → 客户：任一在册记录（含挂起）占用即视为已绑定
export function serialBindings(
  records: SettlementRecord[],
  excludeId?: string
): Map<string, string> {
  const bindings = new Map<string, string>();
  for (const record of records) {
    if (record.id === excludeId) continue;
    const serial = record.current.serialNo.trim();
    const customer = record.current.customer.trim();
    if (serial && customer && !bindings.has(serial)) {
      bindings.set(serial, customer);
    }
  }
  return bindings;
}

export function validateDraft(
  draft: SettlementDraft,
  records: SettlementRecord[],
  excludeId?: string,
  options: { requireReason?: boolean; reason?: string } = {}
): Conflict[] {
  const conflicts: Conflict[] = [];
  const customer = draft.customer.trim();
  const item = draft.item.trim();
  const scope = {
    customer: customer || "（未填写）",
    item: item || "（未填写）",
  };
  const push = (field: string, original: string, limit: string) =>
    conflicts.push({ ...scope, field, original, limit });

  const serial = draft.serialNo.trim();
  if (!serial) push("设备序列号", "（未填写）", "必填：每笔登记须登记设备序列号");
  if (!customer) push("客户", "（未填写）", "必填：序列号须绑定到唯一客户");
  if (!item) push("结算项目", "（未填写）", "必填：每笔登记须登记结算项目");

  const receivable = parseAmount(draft.receivable);
  if (receivable === null) {
    push("应收金额", draft.receivable.trim() || "（未填写）", "必填：需为大于 0 的数字");
  } else if (receivable <= 0) {
    push("应收金额", fmtMoney(receivable), "应收金额须大于 0");
  }

  if (serial) {
    const boundCustomer = serialBindings(records, excludeId).get(serial);
    if (boundCustomer && boundCustomer !== customer) {
      push(
        "设备序列号",
        serial,
        `已绑定客户「${boundCustomer}」，序列号只能绑定一位客户`
      );
    }
  }

  draft.vouchers.forEach((voucher, index) => {
    const label = `补贴凭据 ${index + 1}`;
    if (!voucher.channel) push(label, "（未选渠道）", "补贴须凭医保或公益凭据抵扣");
    if (!voucher.voucherNo.trim()) push(label, "（未填写凭据号）", "凭据号必填，核销留痕");
    const amount = parseAmount(voucher.amount);
    if (amount === null || amount <= 0) {
      push(label, voucher.amount.trim() || "（未填写金额）", "凭据金额须为大于 0 的数字");
    }
  });

  if (receivable !== null && receivable > 0) {
    const total = subsidyTotal(draft.vouchers);
    if (total > receivable) {
      push(
        "补贴合计",
        fmtMoney(total),
        `补贴不得超过应收（实收）金额 ${fmtMoney(receivable)}`
      );
    }
  }

  if (options.requireReason && !options.reason?.trim()) {
    push("修订原因", "（未填写）", "已冻结记录补录须带原因新建修订");
  }

  return conflicts;
}

export interface ApplyOutcome {
  records: SettlementRecord[];
  record: SettlementRecord;
  ok: boolean;
}

// 登记或修订：通过则确认冻结，缺失/超额则整笔挂起并保留输入；每次提交都生成新版本，旧值入历史
export function applyDraft(
  records: SettlementRecord[],
  draft: SettlementDraft,
  options: { recordId?: string; reason?: string; now?: string } = {}
): ApplyOutcome {
  const existing = options.recordId
    ? records.find((record) => record.id === options.recordId)
    : undefined;
  const requireReason = !!existing && existing.status === "confirmed";
  const conflicts = validateDraft(draft, records, options.recordId, {
    requireReason,
    reason: options.reason,
  });
  const ok = conflicts.length === 0;

  const version: SettlementVersion = {
    ...cloneDraft(draft),
    version: existing ? existing.current.version + 1 : 1,
    reason:
      options.reason?.trim() ||
      (existing
        ? existing.status === "confirmed"
          ? ""
          : "补全后重新提交"
        : "初始登记"),
    status: ok ? "confirmed" : "pending",
    recordedAt: options.now ?? new Date().toISOString(),
  };

  const record: SettlementRecord = existing
    ? {
        ...existing,
        status: version.status,
        current: version,
        history: [existing.current, ...existing.history],
        conflicts,
      }
    : {
        id: genId("ST"),
        status: version.status,
        current: version,
        history: [],
        conflicts,
      };

  const next = existing
    ? records.map((item) => (item.id === record.id ? record : item))
    : [record, ...records];
  return { records: next, record, ok };
}

// 载入后按当前台账重新判定挂起记录，保证刷新后冲突与绑定关系一致
export function refreshPending(records: SettlementRecord[]): SettlementRecord[] {
  return records.map((record) =>
    record.status === "pending"
      ? { ...record, conflicts: validateDraft(record.current, records, record.id) }
      : record
  );
}
