// 数据层：演示台账，首次打开或重置时载入

import { buildRecord, bindingOf, freezeRecord, reviseRecord, nowIso } from "./rules";
import type { DraftInput, LedgerEnvelope, SettlementRecord } from "./types";

function draft(partial: Partial<DraftInput>): DraftInput {
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
    ...partial,
  };
}

export function createSeedLedger(): LedgerEnvelope {
  // ① 刘慧芳：先按初版冻结，后凭医保更正单新建修订并再次冻结，旧值留在 revisions
  const liuDraft1 = draft({
    customer: "刘慧芳",
    serial: "HA-2401-00887",
    project: "双耳 RIC 助听器（含三年延保）",
    receivable: "12800",
    received: "10300",
    subsidy: "2500",
    voucherKind: "medical",
    voucherNo: "YB-2026-09-7781",
  });
  let liu = buildRecord(
    liuDraft1,
    "SET-202609-0001",
    "2026-09-12T09:12:00.000Z",
    new Map(),
  );
  liu = freezeRecord(liu, "2026-09-12T09:18:00.000Z");

  // ② 陈建国：公益项目直补，冻结
  const chen = buildRecord(
    draft({
      customer: "陈建国",
      serial: "HA-2302-00415",
      project: "单耳 BTE 助听器",
      receivable: "5600",
      received: "3600",
      subsidy: "2000",
      voucherKind: "welfare",
      voucherNo: "GY-JJ-2026-1109",
    }),
    "SET-202609-0002",
    "2026-09-15T10:05:00.000Z",
    bindingOf([liu]),
  );
  const chenFrozen = freezeRecord(chen, "2026-09-15T10:12:00.000Z");

  // 刘慧芳的修订：冻结金额之上补录，须带原因，旧值保留
  liu = reviseRecord(
    liu,
    draft({
      ...liuDraft1,
      received: "9800",
      subsidy: "3000",
      reason: "医保结算单按定点机构比例更正：补贴 2500 → 3000",
    }),
    bindingOf([liu, chenFrozen], liu.id),
  );
  liu = freezeRecord(liu, "2026-09-18T14:40:00.000Z");

  // ③ 赵晓明：序列号已绑定刘慧芳、凭据缺失、补贴超额——整笔挂起并保留输入
  const zhao = buildRecord(
    draft({
      customer: "赵晓明",
      serial: "HA-2401-00887",
      project: "双耳 RIC 助听器",
      receivable: "9800",
      received: "5000",
      subsidy: "6000",
      voucherKind: "",
      voucherNo: "",
    }),
    "SET-202609-0003",
    "2026-09-20T16:20:00.000Z",
    bindingOf([liu, chenFrozen]),
  );

  // ④ 孙玉珍：校验通过待确认
  const sun = buildRecord(
    draft({
      customer: "孙玉珍",
      serial: "HA-2405-01102",
      project: "儿童耳背式助听器套装（含语训课包）",
      receivable: "15800",
      received: "10300",
      subsidy: "5500",
      voucherKind: "medical",
      voucherNo: "YB-2026-09-8120",
    }),
    "SET-202609-0004",
    "2026-09-21T11:02:00.000Z",
    bindingOf([liu, chenFrozen, zhao]),
  );

  const records: SettlementRecord[] = [liu, chenFrozen, zhao, sun];
  return {
    schema: 1,
    savedAt: nowIso(),
    nextSeq: 5,
    records,
  };
}
