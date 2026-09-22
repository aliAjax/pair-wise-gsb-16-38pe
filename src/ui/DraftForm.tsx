// 界面层：登记与修订共用的表单（字段、凭据行、实时合计）
import { CHANNELS, fmtMoney, genId, parseAmount, subsidyTotal } from "../domain/rules";
import type { SettlementDraft, SubsidyChannel, VoucherDraft } from "../domain/types";

interface DraftFormProps {
  draft: SettlementDraft;
  onChange: (next: SettlementDraft) => void;
  onSubmit: () => void;
  submitLabel: string;
  reason?: string;
  onReasonChange?: (value: string) => void;
  requireReason?: boolean;
  onCancel?: () => void;
}

export function DraftForm(props: DraftFormProps) {
  const { draft, onChange } = props;
  const receivable = parseAmount(draft.receivable);
  const total = subsidyTotal(draft.vouchers);
  const over = receivable !== null && receivable > 0 && total > receivable;

  const patch = (partial: Partial<SettlementDraft>) => onChange({ ...draft, ...partial });

  const patchVoucher = (id: string, partial: Partial<VoucherDraft>) =>
    patch({
      vouchers: draft.vouchers.map((voucher) =>
        voucher.id === id ? { ...voucher, ...partial } : voucher
      ),
    });

  const addVoucher = () =>
    patch({
      vouchers: [
        ...draft.vouchers,
        { id: genId("V"), channel: "", voucherNo: "", amount: "" },
      ],
    });

  const removeVoucher = (id: string) =>
    patch({ vouchers: draft.vouchers.filter((voucher) => voucher.id !== id) });

  return (
    <form
      className="draft-form"
      onSubmit={(event) => {
        event.preventDefault();
        props.onSubmit();
      }}
    >
      <div className="field-grid">
        <label>
          <span>客户</span>
          <input
            value={draft.customer}
            placeholder="客户姓名"
            onChange={(event) => patch({ customer: event.target.value })}
          />
        </label>
        <label>
          <span>结算项目</span>
          <input
            value={draft.item}
            placeholder="如：耳背式助听器（右耳）"
            onChange={(event) => patch({ item: event.target.value })}
          />
        </label>
        <label>
          <span>设备序列号</span>
          <input
            value={draft.serialNo}
            placeholder="如：HA-2026-0003"
            onChange={(event) => patch({ serialNo: event.target.value })}
          />
        </label>
        <label>
          <span>应收金额（元）</span>
          <input
            value={draft.receivable}
            inputMode="decimal"
            placeholder="如：6800"
            onChange={(event) => patch({ receivable: event.target.value })}
          />
        </label>
      </div>

      <div className="voucher-block">
        <div className="voucher-head">
          <span>补贴凭据（医保 / 公益，按凭据抵扣）</span>
          <button type="button" onClick={addVoucher}>
            添加凭据
          </button>
        </div>
        {draft.vouchers.length === 0 && (
          <p className="hint">无补贴则客户全额自付；有补贴须逐条登记渠道、凭据号与金额。</p>
        )}
        {draft.vouchers.map((voucher, index) => (
          <div className="voucher-row" key={voucher.id}>
            <select
              value={voucher.channel}
              onChange={(event) =>
                patchVoucher(voucher.id, {
                  channel: event.target.value as SubsidyChannel | "",
                })
              }
            >
              <option value="">选择渠道</option>
              {CHANNELS.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
            <input
              value={voucher.voucherNo}
              placeholder={`凭据号 ${index + 1}`}
              onChange={(event) =>
                patchVoucher(voucher.id, { voucherNo: event.target.value })
              }
            />
            <input
              value={voucher.amount}
              inputMode="decimal"
              placeholder="抵扣金额"
              onChange={(event) => patchVoucher(voucher.id, { amount: event.target.value })}
            />
            <button type="button" onClick={() => removeVoucher(voucher.id)}>
              移除
            </button>
          </div>
        ))}
      </div>

      {props.requireReason && (
        <label className="reason-field">
          <span>修订原因（已冻结记录补录必填）</span>
          <input
            value={props.reason ?? ""}
            placeholder="如：补录医保凭据号更正"
            onChange={(event) => props.onReasonChange?.(event.target.value)}
          />
        </label>
      )}

      <div className={`summary-line${over ? " over" : ""}`}>
        <span>补贴合计 {fmtMoney(total)}</span>
        <span>应收 {fmtMoney(receivable)}</span>
        <span>客户实付 {receivable === null ? "—" : fmtMoney(receivable - total)}</span>
        {over && <strong>补贴超额，提交后将整笔挂起</strong>}
      </div>

      <div className="form-actions">
        <button type="submit" className="primary-action">
          {props.submitLabel}
        </button>
        {props.onCancel && (
          <button type="button" onClick={props.onCancel}>
            取消
          </button>
        )}
      </div>
    </form>
  );
}
