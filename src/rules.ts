// 判定层：全部为纯函数，不依赖 DOM、localStorage 或 React
// 规则来源：
// 1) 必填缺失（客户/项目/序列号/应收/实收）整笔挂起并保留输入
// 2) 金额格式无效整笔挂起
// 3) 补贴须持医保或公益凭据，凭据缺失整笔挂起
// 4) 补贴不得超过实收金额，超额整笔挂起
// 5) 序列号只能绑定一位客户，绑定他人整笔挂起

import type {
  DraftInput,
  Issue,
  LedgerEnvelope,
  LedgerSummary,
  RecordStatus,
  Revision,
  SettlementRecord,
  Voucher,
} from "./types";

export const VOUCHER_KIND_LABEL: Record<Voucher["kind"], string> = {
  medical: "医保",
  welfare: "公益",
};

export const STATUS_LABEL: Record<RecordStatus, string> = {
  suspended: "已挂起",
  entered: "待确认",
  frozen: "已冻结",
};

export function emptyDraft(): DraftInput {
  return {
    customer: "",
    serial: "",
    project: "",
    receivable: "",
    received: "",
    subsidy: "",
    voucherKind: "",
    voucherNo: "",
    reason: "",
  };
}

/** 金额解析：允许两位小数的非负数；无法解析返回 null */
export function parseAmount(raw: string): number | null {
  const text = raw.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  return Number(text);
}

export function bindingOf(
  records: SettlementRecord[],
  excludeId?: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const record of records) {
    if (record.id === excludeId) continue;
    const serial = record.serial.trim();
    if (!serial) continue;
    if (map.has(serial)) continue;
    map.set(serial, record.customer.trim());
  }
  return map;
}

function missing(field: string, draft: DraftInput, limit: string): Issue {
  return {
    code: "required",
    field,
    customer: draft.customer.trim() || "（未填）",
    project: draft.project.trim() || "（未填）",
    oldValue: "（缺失）",
    limit,
  };
}

/** 判定一笔输入是否可以通过，返回全部冲突（客户、项目、原值、限制） */
export function validate(
  draft: DraftInput,
  bindings: Map<string, string>,
  opts: { reasonRequired: boolean },
): Issue[] {
  const issues: Issue[] = [];
  const customer = draft.customer.trim();
  const project = draft.project.trim();
  const serial = draft.serial.trim();

  for (const [field, value, limit] of [
    ["customer", customer, "必填：客户姓名"],
    ["serial", serial, "必填：设备序列号"],
    ["project", project, "必填：助听设备项目"],
  ] as const) {
    if (!value) issues.push(missing(field, draft, limit));
  }

  if (!draft.receivable.trim()) {
    issues.push(missing("receivable", draft, "必填：应收金额，单位元"));
  } else if (parseAmount(draft.receivable) === null) {
    issues.push({
      code: "format",
      field: "receivable",
      customer: customer || "（未填）",
      project: project || "（未填）",
      oldValue: draft.receivable,
      limit: "须为非负数字，最多两位小数",
    });
  }

  if (!draft.received.trim()) {
    issues.push(missing("received", draft, "必填：实收金额，单位元"));
  } else if (parseAmount(draft.received) === null) {
    issues.push({
      code: "format",
      field: "received",
      customer: customer || "（未填）",
      project: project || "（未填）",
      oldValue: draft.received,
      limit: "须为非负数字，最多两位小数",
    });
  }

  // 补贴：0 视为无补贴；填写正数必须有凭据
  const subsidyRaw = draft.subsidy.trim();
  let subsidy: number | null = 0;
  if (subsidyRaw === "") {
    subsidy = 0;
  } else {
    subsidy = parseAmount(draft.subsidy);
    if (subsidy === null) {
      issues.push({
        code: "format",
        field: "subsidy",
        customer: customer || "（未填）",
        project: project || "（未填）",
        oldValue: draft.subsidy,
        limit: "须为非负数字，最多两位小数",
      });
    }
  }

  if (subsidy !== null && subsidy > 0) {
    if (draft.voucherKind === "" || !draft.voucherNo.trim()) {
      issues.push({
        code: "voucher-missing",
        field: "subsidy",
        customer: customer || "（未填）",
        project: project || "（未填）",
        oldValue: `补贴 ¥${subsidy.toFixed(2)}，凭据：${
          draft.voucherKind === ""
            ? "类型未选"
            : VOUCHER_KIND_LABEL[draft.voucherKind]
        } ${draft.voucherNo.trim() || "编号缺失"}`,
        limit: "补贴抵扣须附医保或公益凭据（类型与编号齐全）",
      });
    }
  }

  const received = parseAmount(draft.received);
  if (subsidy !== null && received !== null && subsidy > received) {
    issues.push({
      code: "subsidy-over",
      field: "subsidy",
      customer: customer || "（未填）",
      project: project || "（未填）",
      oldValue: `补贴 ¥${subsidy.toFixed(2)} / 实收 ¥${received.toFixed(2)}`,
      limit: `补贴不得超过实收金额（实收 ¥${received.toFixed(2)}）`,
    });
  }

  // 序列号只能绑定一位客户
  if (serial) {
    const owner = bindings.get(serial);
    if (owner !== undefined && owner !== customer) {
      issues.push({
        code: "serial-bound",
        field: "serial",
        customer: customer || "（未填）",
        project: project || "（未填）",
        oldValue: `序列号 ${serial} 已被「${owner}」绑定`,
        limit: "一个序列号只能绑定一位客户",
      });
    }
  }

  if (opts.reasonRequired && !draft.reason.trim()) {
    issues.push(missing("reason", draft, "冻结记录补录修订必须填写原因"));
  }

  return issues;
}

export function voucherOf(draft: DraftInput): Voucher | null {
  const subsidy = parseAmount(draft.subsidy);
  if ((subsidy ?? 0) > 0 && draft.voucherKind !== "" && draft.voucherNo.trim()) {
    return { kind: draft.voucherKind, no: draft.voucherNo.trim() };
  }
  return null;
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 由原始输入构造登记记录：校验不过即挂起并保留输入 */
export function buildRecord(
  draft: DraftInput,
  id: string,
  createdAt: string,
  bindings: Map<string, string>,
): SettlementRecord {
  const issues = validate(draft, bindings, { reasonRequired: false });
  const status: RecordStatus = issues.length === 0 ? "entered" : "suspended";
  return {
    id,
    customer: draft.customer.trim(),
    serial: draft.serial.trim(),
    project: draft.project.trim(),
    receivable: parseAmount(draft.receivable),
    received: parseAmount(draft.received),
    subsidy: parseAmount(draft.subsidy) ?? 0,
    voucher: voucherOf(draft),
    status,
    version: 1,
    createdAt,
    confirmedAt: null,
    reason: null,
    revisions: [],
    issues,
    draft: { ...draft },
  };
}

/** 确认：金额冻结，记录历史版本 */
export function freezeRecord(
  record: SettlementRecord,
  at: string,
): SettlementRecord {
  const snapshot: Revision = {
    version: record.version,
    frozenAt: at,
    reason: record.reason,
    receivable: record.receivable ?? 0,
    received: record.received ?? 0,
    subsidy: record.subsidy ?? 0,
    voucher: record.voucher,
  };
  const last = record.revisions[record.revisions.length - 1];
  const sameAsLast = last?.version === snapshot.version;
  return {
    ...record,
    status: "frozen",
    confirmedAt: at,
    revisions: sameAsLast ? record.revisions : [...record.revisions, snapshot],
  };
}

/** 冻结记录补录：带原因新建修订并保留旧值；新修订须重新校验、重新确认 */
export function reviseRecord(
  record: SettlementRecord,
  draft: DraftInput,
  bindings: Map<string, string>,
): SettlementRecord {
  const issues = validate(draft, bindings, { reasonRequired: true });
  return {
    ...record,
    customer: draft.customer.trim(),
    serial: draft.serial.trim(),
    project: draft.project.trim(),
    receivable: parseAmount(draft.receivable),
    received: parseAmount(draft.received),
    subsidy: parseAmount(draft.subsidy) ?? 0,
    voucher: voucherOf(draft),
    status: issues.length === 0 ? "entered" : "suspended",
    version: record.version + 1,
    confirmedAt: null,
    reason: draft.reason.trim(),
    issues,
    draft: { ...draft },
  };
}

/** 挂起记录取回修改后重新登记：不升版本，原值仍可在冻结后进入历史 */
export function resubmitRecord(
  record: SettlementRecord,
  draft: DraftInput,
  bindings: Map<string, string>,
): SettlementRecord {
  const issues = validate(draft, bindings, { reasonRequired: false });
  return {
    ...record,
    customer: draft.customer.trim(),
    serial: draft.serial.trim(),
    project: draft.project.trim(),
    receivable: parseAmount(draft.receivable),
    received: parseAmount(draft.received),
    subsidy: parseAmount(draft.subsidy) ?? 0,
    voucher: voucherOf(draft),
    status: issues.length === 0 ? "entered" : "suspended",
    issues,
    draft: { ...draft },
  };
}

export function summarize(records: SettlementRecord[]): LedgerSummary {
  const summary: LedgerSummary = {
    total: records.length,
    suspended: 0,
    entered: 0,
    frozen: 0,
    subsidyWrittenOff: 0,
  };
  for (const record of records) {
    summary[record.status] += 1;
    if (record.status === "frozen") {
      summary.subsidyWrittenOff += record.subsidy ?? 0;
    }
  }
  return summary;
}

export function newEnvelope(records: SettlementRecord[], nextSeq: number): LedgerEnvelope {
  return { schema: 1, savedAt: nowIso(), nextSeq, records };
}
