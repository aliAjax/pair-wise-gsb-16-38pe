// 界面层：展示与交互组件，不含规则判定与持久化细节

import type { ChangeEvent, FormEvent } from "react";
import { STATUS_LABEL, VOUCHER_KIND_LABEL } from "./rules";
import type {
  DraftInput,
  Issue,
  RecordStatus,
  Revision,
  SettlementRecord,
  Voucher,
} from "./types";

const statusColors: Record<RecordStatus, string> = {
  frozen: "status-ok",
  entered: "status-watch",
  suspended: "status-danger",
};

export function yuan(value: number | null): string {
  if (value === null) return "—";
  return `¥${value.toFixed(2)}`;
}

export function formatTime(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

export function voucherText(voucher: Voucher | null): string {
  if (!voucher) return "无补贴凭据";
  return `${VOUCHER_KIND_LABEL[voucher.kind]}凭据 ${voucher.no}`;
}

export function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: RecordStatus | "total";
}) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={tone === "total" ? "" : statusColors[tone]} />
    </article>
  );
}

/** 冲突清单：固定列出客户、项目、原值、限制 */
export function IssueTable({ issues }: { issues: Issue[] }) {
  if (issues.length === 0) return null;
  return (
    <div className="issue-table" role="table">
      <div className="issue-row issue-head" role="row">
        <span>客户</span>
        <span>项目</span>
        <span>原值</span>
        <span>限制</span>
      </div>
      {issues.map((issue, index) => (
        <div
          className={`issue-row issue-code-${issue.code}`}
          role="row"
          key={`${issue.code}-${issue.field}-${index}`}
        >
          <span>{issue.customer}</span>
          <span>{issue.project}</span>
          <span className="issue-value">
            <em className={`field-tag ${issue.code}`}>{issue.field}</em>
            {issue.oldValue}
          </span>
          <span className="issue-limit">{issue.limit}</span>
        </div>
      ))}
    </div>
  );
}

interface FormAlert {
  tone: "ok" | "suspend";
  text: string;
}

interface RegisterFormProps {
  draft: DraftInput;
  editingId: string | null;
  reviseMode: boolean;
  alert: FormAlert | null;
  issues: Issue[];
  onChange: (next: DraftInput) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function RegisterForm({
  draft,
  editingId,
  reviseMode,
  alert,
  issues,
  onChange,
  onSubmit,
  onCancel,
}: RegisterFormProps) {
  const set = (patch: Partial<DraftInput>) => onChange({ ...draft, ...patch });

  return (
    <section className="panel register-panel">
      <div className="section-heading">
        <div>
          <p>结算登记</p>
          <h2>{reviseMode ? "补录修订（新建版本）" : "登记助听设备结算"}</h2>
        </div>
        <span className="version-tag">
          {reviseMode ? "冻结金额不可覆盖，旧值保留" : editingId ? "取回挂起登记" : "新登记"}
        </span>
      </div>

      {reviseMode && (
        <div className="revise-banner">
          正在补录修订：新版本须重新通过校验并再次确认；修订原因必填，确认后金额再次冻结。
        </div>
      )}

      {alert && (
        <div className={`form-alert ${alert.tone}`} role="status">
          {alert.text}
        </div>
      )}

      {alert?.tone === "suspend" && issues.length > 0 && (
        <IssueTable issues={issues} />
      )}

      <form
        className="field-grid"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <label>
          <span>客户姓名 *</span>
          <input
            value={draft.customer}
            placeholder="如：刘慧芳"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              set({ customer: event.target.value })
            }
          />
        </label>
        <label>
          <span>设备序列号 *</span>
          <input
            value={draft.serial}
            placeholder="如：HA-2401-00887（全台账唯一绑定）"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              set({ serial: event.target.value })
            }
          />
        </label>
        <label className="wide">
          <span>助听设备项目 *</span>
          <input
            value={draft.project}
            placeholder="如：双耳 RIC 助听器（含三年延保）"
            list="project-options"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              set({ project: event.target.value })
            }
          />
          <datalist id="project-options">
            <option value="双耳 RIC 助听器" />
            <option value="单耳 BTE 助听器" />
            <option value="儿童耳背式助听器套装" />
            <option value="骨导助听器" />
          </datalist>
        </label>
        <label>
          <span>应收金额（元）*</span>
          <input
            value={draft.receivable}
            inputMode="decimal"
            placeholder="0.00"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              set({ receivable: event.target.value })
            }
          />
        </label>
        <label>
          <span>实收金额（元）*</span>
          <input
            value={draft.received}
            inputMode="decimal"
            placeholder="0.00（补贴抵扣上限基准）"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              set({ received: event.target.value })
            }
          />
        </label>
        <label>
          <span>补贴金额（元）</span>
          <input
            value={draft.subsidy}
            inputMode="decimal"
            placeholder="0.00（不得超过实收金额）"
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              set({ subsidy: event.target.value })
            }
          />
        </label>
        <div className="voucher-row">
          <label>
            <span>补贴凭据类型</span>
            <select
              value={draft.voucherKind}
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                set({ voucherKind: event.target.value as DraftInput["voucherKind"] })
              }
            >
              <option value="">无补贴 / 未选择</option>
              <option value="medical">医保凭据</option>
              <option value="welfare">公益凭据</option>
            </select>
          </label>
          <label>
            <span>凭据编号</span>
            <input
              value={draft.voucherNo}
              placeholder="补贴大于 0 时必填"
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                set({ voucherNo: event.target.value })
              }
            />
          </label>
        </div>

        {reviseMode && (
          <label className="wide">
            <span>修订原因 *</span>
            <textarea
              rows={2}
              value={draft.reason}
              placeholder="如：医保结算单按定点机构比例更正"
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                set({ reason: event.target.value })
              }
            />
          </label>
        )}

        <div className="form-actions wide">
          <button type="submit" className="primary-action">
            {reviseMode ? "提交修订（重新校验）" : "提交登记"}
          </button>
          <button type="button" onClick={onCancel}>
            {editingId ? "放弃修改" : "清空"}
          </button>
        </div>
      </form>
    </section>
  );
}

function RevisionHistory({ revisions }: { revisions: Revision[] }) {
  if (revisions.length === 0) return null;
  return (
    <details className="revision-history">
      <summary>历史版本（{revisions.length}）· 旧值永久保留</summary>
      <ol>
        {revisions.map((revision) => (
          <li key={revision.version}>
            <div className="revision-line">
              <strong>v{revision.version}</strong>
              <span>冻结于 {formatTime(revision.frozenAt)}</span>
            </div>
            <div className="revision-amounts">
              应收 {yuan(revision.receivable)} · 实收 {yuan(revision.received)} · 补贴{" "}
              {yuan(revision.subsidy)} · {voucherText(revision.voucher)}
            </div>
            {revision.reason && <div className="revision-reason">原因：{revision.reason}</div>}
          </li>
        ))}
      </ol>
    </details>
  );
}

interface RecordCardProps {
  record: SettlementRecord;
  onRetrieve: (id: string) => void;
  onRevise: (id: string) => void;
  onConfirm: (id: string) => void;
}

export function RecordCard({ record, onRetrieve, onRevise, onConfirm }: RecordCardProps) {
  return (
    <article className={`record-card ledger status-${record.status}`}>
      <div className="record-main">
        <div className="record-index">{record.serial || "—"}</div>
        <div className="record-info">
          <div className="record-title">
            <h3>{record.customer || "（客户缺失）"}</h3>
            <span className={`badge ${statusColors[record.status]}`}>
              {STATUS_LABEL[record.status]} · v{record.version}
            </span>
          </div>
          <p className="record-project">{record.project || "（项目缺失）"}</p>
          <p className="record-meta">
            设备序列号 {record.serial || "（缺失）"} · 登记于 {formatTime(record.createdAt)}
            {record.confirmedAt && ` · ${formatTime(record.confirmedAt)} 冻结`}
          </p>
          {record.reason && <p className="record-reason">当前修订原因：{record.reason}</p>}
        </div>
        <div className="amount-grid">
          <div>
            <span>应收</span>
            <strong>{yuan(record.receivable)}</strong>
          </div>
          <div>
            <span>实收</span>
            <strong>{yuan(record.received)}</strong>
          </div>
          <div>
            <span>补贴抵扣</span>
            <strong className="subsidy">{yuan(record.subsidy)}</strong>
          </div>
          <div>
            <span>凭据</span>
            <strong className="voucher">{voucherText(record.voucher)}</strong>
          </div>
        </div>
        <div className="record-actions">
          {record.status === "suspended" && (
            <button onClick={() => onRetrieve(record.id)}>取回修改（保留输入）</button>
          )}
          {record.status === "entered" && (
            <>
              <button className="primary-action" onClick={() => onConfirm(record.id)}>
                确认冻结
              </button>
              <button onClick={() => onRetrieve(record.id)}>取回修改</button>
            </>
          )}
          {record.status === "frozen" && (
            <button onClick={() => onRevise(record.id)}>补录修订（带原因）</button>
          )}
        </div>
      </div>

      {record.issues.length > 0 && (
        <div className="record-issues">
          <p className="issues-caption">整笔挂起 · 冲突与限制（{record.issues.length}）</p>
          <IssueTable issues={record.issues} />
        </div>
      )}

      <RevisionHistory revisions={record.revisions} />
    </article>
  );
}
