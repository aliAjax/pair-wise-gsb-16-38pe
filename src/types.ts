// 数据层：助听设备结算与补贴核销台账的领域模型

/** 补贴凭据类型：医保 / 公益 */
export type VoucherKind = "medical" | "welfare";

/** 登记状态：挂起（校验未过）/ 待确认（校验通过未冻结）/ 已冻结 */
export type RecordStatus = "suspended" | "entered" | "frozen";

export interface Voucher {
  kind: VoucherKind;
  /** 医保或公益凭据编号 */
  no: string;
}

/** 表单原始输入：金额保留字符串，挂起时可原样回填（保留输入） */
export interface DraftInput {
  customer: string;
  serial: string;
  project: string;
  receivable: string;
  received: string;
  subsidy: string;
  voucherKind: "" | VoucherKind;
  voucherNo: string;
  /** 补录修订原因，仅修订时必填 */
  reason: string;
}

export type IssueCode =
  | "required" // 必填缺失
  | "format" // 金额格式无效
  | "voucher-missing" // 补贴凭据缺失
  | "subsidy-over" // 补贴超过实收金额
  | "serial-bound"; // 序列号已绑定其他客户

/** 冲突/限制明细：按要求列出客户、项目、原值与限制 */
export interface Issue {
  code: IssueCode;
  field: string;
  customer: string;
  project: string;
  oldValue: string;
  limit: string;
}

/** 已冻结的历史版本快照，旧值永久保留 */
export interface Revision {
  version: number;
  frozenAt: string;
  reason: string | null;
  receivable: number;
  received: number;
  subsidy: number;
  voucher: Voucher | null;
}

export interface SettlementRecord {
  id: string;
  customer: string;
  /** 设备序列号：全台账只能绑定一位客户 */
  serial: string;
  project: string;
  /** 应收金额，无法解析的挂起登记为 null */
  receivable: number | null;
  /** 实收金额：补贴抵扣的上限基准 */
  received: number | null;
  /** 补贴金额：不得超过实收金额，且须有医保/公益凭据 */
  subsidy: number | null;
  voucher: Voucher | null;
  status: RecordStatus;
  version: number;
  createdAt: string;
  confirmedAt: string | null;
  /** 当前版本的修订原因 */
  reason: string | null;
  revisions: Revision[];
  /** 挂起时留存的冲突快照 */
  issues: Issue[];
  /** 原始输入留存，刷新或取回修改时原样回填 */
  draft: DraftInput;
}

export interface LedgerSummary {
  total: number;
  suspended: number;
  entered: number;
  frozen: number;
  /** 已冻结记录的补贴合计（已核销） */
  subsidyWrittenOff: number;
}

/** localStorage 持久化信封：记录、凭据、金额与版本统一存取，保证刷新后一致 */
export interface LedgerEnvelope {
  schema: 1;
  savedAt: string;
  nextSeq: number;
  records: SettlementRecord[];
}
