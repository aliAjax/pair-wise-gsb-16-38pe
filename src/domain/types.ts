// 数据层：助听设备结算与补贴核销的数据模型
// 金额一律以字符串保存原始输入，挂起时保留输入、确认后冻结、修订时保留旧值

export type SubsidyChannel = "医保" | "公益";

export type RecordStatus = "pending" | "confirmed";

export interface VoucherDraft {
  id: string;
  channel: SubsidyChannel | "";
  voucherNo: string;
  amount: string;
}

export interface SettlementDraft {
  serialNo: string;
  customer: string;
  item: string;
  receivable: string;
  vouchers: VoucherDraft[];
}

export interface SettlementVersion extends SettlementDraft {
  version: number;
  reason: string;
  status: RecordStatus;
  recordedAt: string;
}

export interface Conflict {
  customer: string;
  item: string;
  field: string;
  original: string;
  limit: string;
}

export interface SettlementRecord {
  id: string;
  status: RecordStatus;
  current: SettlementVersion;
  history: SettlementVersion[];
  conflicts: Conflict[];
}
