// 数据层：初始台账（含一笔已确认、一笔带修订历史、一笔挂起冲突的示例）
import type { SettlementRecord } from "./types";

export function seedRecords(): SettlementRecord[] {
  return [
    {
      id: "ST-SEED-03",
      status: "pending",
      current: {
        version: 1,
        reason: "初始登记",
        status: "pending",
        serialNo: "HA-2026-0001",
        customer: "赵敏",
        item: "充电式RIC助听器（左耳）",
        receivable: "3000",
        vouchers: [
          { id: "V-SEED-31", channel: "公益", voucherNo: "GY-2210", amount: "3600" },
        ],
        recordedAt: "2026-09-21T10:24:00.000Z",
      },
      history: [],
      conflicts: [],
    },
    {
      id: "ST-SEED-02",
      status: "confirmed",
      current: {
        version: 2,
        reason: "补录：医保凭据号更正",
        status: "confirmed",
        serialNo: "HA-2026-0002",
        customer: "陈立",
        item: "定制耳道式助听器（双耳）",
        receivable: "15800",
        vouchers: [
          { id: "V-SEED-22", channel: "医保", voucherNo: "YB-2026-5518", amount: "5000" },
        ],
        recordedAt: "2026-09-20T08:40:00.000Z",
      },
      history: [
        {
          version: 1,
          reason: "初始登记",
          status: "confirmed",
          serialNo: "HA-2026-0002",
          customer: "陈立",
          item: "定制耳道式助听器（双耳）",
          receivable: "15800",
          vouchers: [
            { id: "V-SEED-21", channel: "医保", voucherNo: "YB-2026-5188", amount: "5000" },
          ],
          recordedAt: "2026-09-19T09:12:00.000Z",
        },
      ],
      conflicts: [],
    },
    {
      id: "ST-SEED-01",
      status: "confirmed",
      current: {
        version: 1,
        reason: "初始登记",
        status: "confirmed",
        serialNo: "HA-2026-0001",
        customer: "刘桂芳",
        item: "耳背式助听器（右耳）",
        receivable: "6800",
        vouchers: [
          { id: "V-SEED-11", channel: "医保", voucherNo: "YB-2026-8801", amount: "2000" },
          { id: "V-SEED-12", channel: "公益", voucherNo: "GY-1024", amount: "800" },
        ],
        recordedAt: "2026-09-18T07:30:00.000Z",
      },
      history: [],
      conflicts: [],
    },
  ];
}
