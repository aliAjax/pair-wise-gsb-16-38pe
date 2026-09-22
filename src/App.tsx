import { useEffect, useMemo, useState } from "react";
import "./styles.css";
import {
  buildRecord,
  bindingOf,
  emptyDraft,
  freezeRecord,
  nowIso,
  resubmitRecord,
  reviseRecord,
  summarize,
} from "./rules";
import { loadLedger, resetLedger, saveLedger } from "./storage";
import type {
  DraftInput,
  Issue,
  LedgerEnvelope,
  RecordStatus,
  SettlementRecord,
} from "./types";
import { IssueTable, MetricCard, RegisterForm, RecordCard, yuan } from "./components";

type Filter = RecordStatus | "all";

interface FormAlert {
  tone: "ok" | "suspend";
  text: string;
}

const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "suspended", label: "已挂起" },
  { key: "entered", label: "待确认" },
  { key: "frozen", label: "已冻结" },
];

const RULE_LINES = [
  "每笔登记设备序列号、项目与应收金额",
  "补贴凭医保或公益凭据抵扣",
  "一个序列号只能绑定一位客户",
  "补贴不得超过实收金额",
  "缺失或超额：整笔挂起并保留输入",
  "确认后金额冻结，补录带原因新建修订",
];

function App() {
  const [ledger, setLedger] = useState<LedgerEnvelope>(() => loadLedger());
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<DraftInput>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reviseMode, setReviseMode] = useState(false);
  const [alert, setAlert] = useState<FormAlert | null>(null);

  // 存储层：每次台账变更后整体落盘，刷新后记录、凭据、金额与版本一致
  useEffect(() => {
    saveLedger(ledger);
  }, [ledger]);

  const summary = useMemo(() => summarize(ledger.records), [ledger.records]);
  const bindings = useMemo(
    () => bindingOf(ledger.records, editingId ?? undefined),
    [ledger.records, editingId],
  );

  const replaceRecord = (id: string, next: SettlementRecord) =>
    setLedger((prev) => ({
      ...prev,
      savedAt: nowIso(),
      records: prev.records.map((record) => (record.id === id ? next : record)),
    }));

  const resetForm = () => {
    setDraft(emptyDraft());
    setEditingId(null);
    setReviseMode(false);
  };

  const handleSubmit = () => {
    if (editingId) {
      const existing = ledger.records.find((record) => record.id === editingId);
      if (!existing) {
        resetForm();
        return;
      }
      const next =
        reviseMode && existing.status === "frozen"
          ? reviseRecord(existing, draft, bindings)
          : resubmitRecord(existing, draft, bindings);
      replaceRecord(existing.id, next);

      if (next.status === "suspended") {
        setAlert({
          tone: "suspend",
          text: `登记未通过，整笔挂起并保留输入（${next.issues.length} 项冲突），修正后可再次提交。`,
        });
      } else {
        setAlert({
          tone: "ok",
          text: reviseMode
            ? `修订 v${next.version} 已建立并通过校验，金额尚未冻结，请确认后再次冻结；旧值已在历史版本中保留。`
            : "挂起登记已通过校验，现为待确认状态。",
        });
        resetForm();
      }
      return;
    }

    const id = `SET-202609-${String(ledger.nextSeq).padStart(4, "0")}`;
    const record = buildRecord(draft, id, nowIso(), bindings);
    setLedger((prev) => ({
      ...prev,
      savedAt: nowIso(),
      nextSeq: prev.nextSeq + 1,
      records: [...prev.records, record],
    }));

    if (record.status === "suspended") {
      setEditingId(record.id);
      setAlert({
        tone: "suspend",
        text: `登记未通过，整笔挂起并保留输入（${record.issues.length} 项冲突），输入未清空，可直接修正后再次提交。`,
      });
    } else {
      setAlert({ tone: "ok", text: "登记通过校验，已进入待确认；确认后金额冻结。" });
      resetForm();
    }
  };

  const handleConfirm = (id: string) => {
    const record = ledger.records.find((item) => item.id === id);
    if (!record) return;
    replaceRecord(id, freezeRecord(record, nowIso()));
    setAlert({
      tone: "ok",
      text: `${record.customer} 的结算已确认，金额于 v${record.version} 冻结；如需补录须带原因新建修订。`,
    });
    if (editingId === id) resetForm();
  };

  const handleRetrieve = (id: string) => {
    const record = ledger.records.find((item) => item.id === id);
    if (!record) return;
    setDraft({ ...record.draft });
    setEditingId(id);
    setReviseMode(false);
    setAlert({
      tone: "suspend",
      text: "已取回挂起登记，原始输入原样回填；修正后提交重新校验。",
    });
  };

  const handleRevise = (id: string) => {
    const record = ledger.records.find((item) => item.id === id);
    if (!record) return;
    setDraft({ ...emptyDraft(), ...record.draft, reason: "" });
    setEditingId(id);
    setReviseMode(true);
    setAlert({
      tone: "ok",
      text: `v${record.version} 冻结值保持不变；提交将新建 v${record.version + 1}，旧值保留在历史版本。`,
    });
  };

  const handleCancel = () => {
    resetForm();
    setAlert(null);
  };

  const handleResetDemo = () => {
    setLedger(resetLedger());
    resetForm();
    setAlert({ tone: "ok", text: "已恢复演示台账（含冻结修订与挂起冲突样例）。" });
  };

  const visibleRecords = ledger.records
    .filter((record) => filter === "all" || record.status === filter)
    .slice()
    .reverse();

  const allIssues = ledger.records.flatMap((record) =>
    record.status === "suspended" ? record.issues : [],
  );
  const formIssues: Issue[] = alert?.tone === "suspend" && editingId
    ? ledger.records.find((record) => record.id === editingId)?.issues ?? []
    : [];

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">hxwl-01 · port 5101</p>
          <h1>助听设备结算与补贴核销台</h1>
          <p className="subtitle">
            每笔登记设备序列号、项目与应收金额，补贴凭医保或公益凭据抵扣；
            序列号唯一绑定客户、补贴不得超过实收金额，冲突整笔挂起，确认冻结、修订留痕。
          </p>
        </div>
        <div className="stack-card">
          <span>分层实现 · 无新增依赖</span>
          <strong>数据 / 判定 / 存储 / 界面</strong>
          <small>React + Vite + TypeScript + localStorage</small>
        </div>
      </section>

      <section className="metrics-grid">
        <MetricCard label="登记笔数" value={String(summary.total)} tone="total" />
        <MetricCard label="已挂起" value={String(summary.suspended)} tone="suspended" />
        <MetricCard label="待确认" value={String(summary.entered)} tone="entered" />
        <MetricCard
          label="已核销补贴（冻结）"
          value={yuan(summary.subsidyWrittenOff)}
          tone="frozen"
        />
      </section>

      <section className="workspace">
        <aside className="panel narrow">
          <h2>角色</h2>
          <div className="chips">
            <span>验配结算员</span>
            <span>门店主管</span>
            <span>医保核销岗</span>
          </div>
          <h2>状态筛选</h2>
          <div className="chips muted filter-chips">
            {FILTERS.map((item) => (
              <button
                key={item.key}
                className={filter === item.key ? "active" : ""}
                onClick={() => setFilter(item.key)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <h2>核销规则</h2>
          <ul className="rule-list">
            {RULE_LINES.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button className="reset-demo" onClick={handleResetDemo}>
            恢复演示台账
          </button>
        </aside>

        <RegisterForm
          draft={draft}
          editingId={editingId}
          reviseMode={reviseMode}
          alert={alert}
          issues={formIssues}
          onChange={(next) => {
            setDraft(next);
            setAlert(null);
          }}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </section>

      {allIssues.length > 0 && filter !== "frozen" && filter !== "entered" && (
        <section className="panel conflict-panel">
          <div className="section-heading">
            <div>
              <p>挂起与冲突</p>
              <h2>冲突明细（客户 / 项目 / 原值 / 限制）</h2>
            </div>
            <span className="version-tag">{allIssues.length} 项未解除</span>
          </div>
          <p className="conflict-hint">
            以下限制导致整笔挂起；在登记表单中取回对应记录修正，原值与限制均在此留档。
          </p>
          <ConflictSummary records={ledger.records} />
        </section>
      )}

      <section className="records panel">
        <div className="section-heading">
          <div>
            <p>台账记录 · 本地持久化</p>
            <h2>
              {FILTERS.find((item) => item.key === filter)?.label} ·{" "}
              {visibleRecords.length} 笔
            </h2>
          </div>
          <small className="saved-at">最近保存 {new Date(ledger.savedAt).toLocaleString()}</small>
        </div>
        <div className="record-list ledger-list">
          {visibleRecords.length === 0 ? (
            <p className="empty-hint">当前筛选下暂无记录。</p>
          ) : (
            visibleRecords.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                onRetrieve={handleRetrieve}
                onRevise={handleRevise}
                onConfirm={handleConfirm}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function ConflictSummary({ records }: { records: SettlementRecord[] }) {
  const suspended = records.filter((record) => record.status === "suspended");
  return (
    <div className="conflict-groups">
      {suspended.map((record) => (
        <div className="conflict-group" key={record.id}>
          <p className="conflict-record">
            登记 {record.id} · 序列号 {record.serial || "（缺失）"} · v{record.version}
          </p>
          <IssueTable issues={record.issues} />
        </div>
      ))}
    </div>
  );
}

export default App;
