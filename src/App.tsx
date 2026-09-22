// 界面层：结算与补贴核销台（登记、冲突台账、记录与版本历史）
import { useEffect, useMemo, useState } from "react";
import {
  applyDraft,
  cloneDraft,
  emptyDraft,
  fmtMoney,
  parseAmount,
  refreshPending,
  subsidyTotal,
} from "./domain/rules";
import { seedRecords } from "./domain/seed";
import type { SettlementDraft, SettlementRecord } from "./domain/types";
import { loadRecords, saveRecords } from "./storage/store";
import { DraftForm } from "./ui/DraftForm";
import "./styles.css";

const project = {
  id: "hxwl-01",
  port: 5101,
  title: "助听设备结算与补贴核销台",
  subtitle:
    "每笔登记设备序列号、项目与应收金额，补贴按医保或公益凭据抵扣。序列号只能绑定一位客户，补贴不得超过应收（实收）金额；缺失或超额整笔挂起并保留输入，确认后金额冻结，补录须带原因新建修订并保留旧值。",
  stack: "React + Vite + TypeScript + CSS",
  users: ["听力师", "门店主管", "核销专员"],
  rules: [
    "序列号唯一绑定一位客户",
    "补贴 ≤ 应收金额，凭医保/公益凭据抵扣",
    "缺失或超额 → 整笔挂起、保留输入",
    "确认后金额冻结，不可直接改",
    "补录须带原因，新建修订并保留旧值",
    "本地持久化，刷新后记录/凭据/金额/版本一致",
  ],
};

const statusColors = ["status-ok", "status-watch", "status-danger"];

interface EditingState {
  recordId: string;
  draft: SettlementDraft;
  reason: string;
}

interface Notice {
  type: "ok" | "warn";
  text: string;
}

function fmtTime(iso: string): string {
  const time = new Date(iso);
  return Number.isNaN(time.getTime()) ? iso : time.toLocaleString("zh-CN", { hour12: false });
}

function fmtMoneyCompact(value: number): string {
  return `¥${Math.round(value).toLocaleString("zh-CN")}`;
}

function MetricCard({ label, value, index }: { label: string; value: string; index: number }) {
  return (
    <article className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={statusColors[index % statusColors.length]} />
    </article>
  );
}

function App() {
  const [records, setRecords] = useState<SettlementRecord[]>(() =>
    refreshPending(loadRecords())
  );
  const [draft, setDraft] = useState<SettlementDraft>(() => emptyDraft());
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    saveRecords(records);
  }, [records]);

  const metrics = useMemo(() => {
    const confirmed = records.filter((record) => record.status === "confirmed");
    return {
      confirmedCount: confirmed.length,
      pendingCount: records.length - confirmed.length,
      subsidy: confirmed.reduce((sum, record) => sum + subsidyTotal(record.current.vouchers), 0),
      receivable: confirmed.reduce(
        (sum, record) => sum + (parseAmount(record.current.receivable) ?? 0),
        0
      ),
    };
  }, [records]);

  const conflictRows = useMemo(
    () =>
      records
        .filter((record) => record.status === "pending")
        .flatMap((record) =>
          record.conflicts.map((conflict) => ({ ...conflict, recordId: record.id }))
        ),
    [records]
  );

  function submitNew() {
    const outcome = applyDraft(records, draft);
    setRecords(outcome.records);
    if (outcome.ok) {
      setDraft(emptyDraft());
      setNotice({
        type: "ok",
        text: `登记成功：${outcome.record.current.customer} · ${outcome.record.current.item}，金额已冻结（v${outcome.record.current.version}）。`,
      });
    } else {
      // 整笔挂起：表单与台账都保留本次输入
      setNotice({
        type: "warn",
        text: `发现 ${outcome.record.conflicts.length} 项冲突，整笔挂起，输入已保留在表单与挂起台账中。`,
      });
    }
  }

  function startEdit(record: SettlementRecord) {
    const { version, reason, status, recordedAt, ...draftFields } = record.current;
    void version;
    void reason;
    void status;
    void recordedAt;
    setEditing({ recordId: record.id, draft: cloneDraft(draftFields), reason: "" });
  }

  function submitEdit() {
    if (!editing) return;
    const outcome = applyDraft(records, editing.draft, {
      recordId: editing.recordId,
      reason: editing.reason,
    });
    setRecords(outcome.records);
    if (outcome.ok) {
      setEditing(null);
      setNotice({
        type: "ok",
        text: `已新建修订 v${outcome.record.current.version} 并冻结，旧值保留在版本历史中。`,
      });
    } else {
      // 修订未通过：整笔挂起，编辑表单保留本次输入
      setNotice({
        type: "warn",
        text: `修订未通过：${outcome.record.conflicts.length} 项冲突，整笔挂起，旧值与本次输入均已保留。`,
      });
    }
  }

  function resetSeeds() {
    setRecords(refreshPending(seedRecords()));
    setEditing(null);
    setNotice({ type: "ok", text: "已恢复示例台账。" });
  }

  const metricValues = [
    String(metrics.confirmedCount),
    String(metrics.pendingCount),
    fmtMoneyCompact(metrics.subsidy),
    fmtMoneyCompact(metrics.receivable),
  ];
  const metricLabels = ["已确认冻结（笔）", "挂起待处理（笔）", "补贴核销总额", "冻结应收总额"];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">
            {project.id} · port {project.port}
          </p>
          <h1>{project.title}</h1>
          <p className="subtitle">{project.subtitle}</p>
        </div>
        <div className="stack-card">
          <span>技术栈</span>
          <strong>{project.stack}</strong>
        </div>
      </section>

      <section className="metrics-grid">
        {metricLabels.map((label, index) => (
          <MetricCard key={label} label={label} value={metricValues[index]} index={index} />
        ))}
      </section>

      {notice && (
        <div className={`notice ${notice.type}`}>
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)}>知道了</button>
        </div>
      )}

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            {project.users.map((user) => (
              <span key={user}>{user}</span>
            ))}
          </div>
          <h2>核销规则</h2>
          <ul className="rule-list">
            {project.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </aside>

        <section className="panel">
          <div className="section-heading">
            <div>
              <p>结算登记</p>
              <h2>新登记</h2>
            </div>
          </div>
          <DraftForm
            draft={draft}
            onChange={setDraft}
            onSubmit={submitNew}
            submitLabel="登记并确认"
          />
        </section>
      </section>

      <section className="panel conflicts-panel">
        <div className="section-heading">
          <div>
            <p>挂起与冲突</p>
            <h2>冲突台账</h2>
          </div>
          <span className="conflict-count">{conflictRows.length} 项待处理</span>
        </div>
        {conflictRows.length === 0 ? (
          <p className="hint">当前无挂起冲突，已确认记录的金额均已冻结。</p>
        ) : (
          <table className="conflict-table">
            <thead>
              <tr>
                <th>客户</th>
                <th>项目</th>
                <th>字段</th>
                <th>原值</th>
                <th>限制</th>
              </tr>
            </thead>
            <tbody>
              {conflictRows.map((conflict, index) => (
                <tr key={`${conflict.recordId}-${index}`}>
                  <td>{conflict.customer}</td>
                  <td>{conflict.item}</td>
                  <td>{conflict.field}</td>
                  <td>{conflict.original}</td>
                  <td>{conflict.limit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>结算台账</p>
            <h2>记录与版本</h2>
          </div>
          <button onClick={resetSeeds}>恢复示例数据</button>
        </div>
        <div className="record-list">
          {records.map((record, index) => {
            const current = record.current;
            const receivable = parseAmount(current.receivable);
            const subsidy = subsidyTotal(current.vouchers);
            const isEditing = editing?.recordId === record.id;
            return (
              <article key={record.id} className={`record-card ${record.status}`}>
                <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                <div className="record-body">
                  <header className="record-head">
                    <div>
                      <h3>
                        {current.customer || "（未填写客户）"} ·{" "}
                        {current.item || "（未填写项目）"}
                      </h3>
                      <p>
                        序列号 {current.serialNo || "—"} · 登记于 {fmtTime(current.recordedAt)}
                      </p>
                    </div>
                    <span className={`status-badge ${record.status}`}>
                      {record.status === "confirmed"
                        ? `已冻结 v${current.version}`
                        : `挂起 v${current.version}`}
                    </span>
                  </header>

                  <div className="amount-grid">
                    <div>
                      <span>应收金额</span>
                      <strong>{fmtMoney(receivable)}</strong>
                    </div>
                    <div>
                      <span>补贴抵扣</span>
                      <strong>{fmtMoney(subsidy)}</strong>
                    </div>
                    <div>
                      <span>客户实付</span>
                      <strong>
                        {receivable === null ? "—" : fmtMoney(receivable - subsidy)}
                      </strong>
                    </div>
                  </div>

                  {current.vouchers.length > 0 && (
                    <div className="voucher-chips">
                      {current.vouchers.map((voucher) => (
                        <span key={voucher.id}>
                          {voucher.channel || "未选渠道"} · {voucher.voucherNo || "无凭据号"} ·{" "}
                          {fmtMoney(parseAmount(voucher.amount))}
                        </span>
                      ))}
                    </div>
                  )}

                  {record.status === "pending" && record.conflicts.length > 0 && (
                    <ul className="conflict-list">
                      {record.conflicts.map((conflict, conflictIndex) => (
                        <li key={conflictIndex}>
                          <strong>{conflict.field}</strong>：原值 {conflict.original}；限制{" "}
                          {conflict.limit}
                        </li>
                      ))}
                    </ul>
                  )}

                  {record.history.length > 0 && (
                    <details className="history-block">
                      <summary>
                        版本历史（{record.history.length} 个旧版本，旧值已保留）
                      </summary>
                      <ul>
                        {record.history.map((version) => (
                          <li key={version.version}>
                            <span>
                              v{version.version} ·{" "}
                              {version.status === "confirmed" ? "已确认" : "挂起"} ·{" "}
                              {version.reason || "（无原因）"} · {fmtTime(version.recordedAt)}
                            </span>
                            <span>
                              应收 {fmtMoney(parseAmount(version.receivable))} · 补贴{" "}
                              {fmtMoney(subsidyTotal(version.vouchers))} · 序列号{" "}
                              {version.serialNo || "—"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <div className="record-actions">
                    <button
                      onClick={() => (isEditing ? setEditing(null) : startEdit(record))}
                    >
                      {isEditing
                        ? "收起"
                        : record.status === "confirmed"
                          ? "补录修订"
                          : "补全重提"}
                    </button>
                  </div>

                  {isEditing && editing && (
                    <div className="edit-block">
                      <DraftForm
                        draft={editing.draft}
                        onChange={(next) => setEditing({ ...editing, draft: next })}
                        reason={editing.reason}
                        onReasonChange={(value) => setEditing({ ...editing, reason: value })}
                        requireReason={record.status === "confirmed"}
                        submitLabel={
                          record.status === "confirmed" ? "新建修订并冻结" : "重新提交"
                        }
                        onSubmit={submitEdit}
                        onCancel={() => setEditing(null)}
                      />
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

export default App;
