# hxwl-01 助听设备结算与补贴核销台

门店助听设备的结算登记、补贴抵扣与核销台账工作台。

## 技术栈

React + Vite + TypeScript + CSS（无额外依赖）

## 本地运行

```bash
npm install
npm run dev
```

开发端口：5101

## 功能规则

- 每笔登记设备序列号、结算项目与应收金额，补贴按医保或公益凭据逐条抵扣
- 序列号只能绑定一位客户；补贴合计不得超过应收（实收）金额
- 字段缺失或补贴超额时整笔挂起，输入保留在表单与挂起台账中
- 确认后金额冻结；补录须带原因新建修订，旧值保留在版本历史中
- 冲突台账列出客户、项目、字段、原值与限制
- localStorage 持久化，刷新后记录、凭据、金额与版本一致

## 分层结构

- `src/domain/types.ts` —— 数据模型（记录、版本、凭据、冲突）
- `src/domain/rules.ts` —— 判定逻辑（校验、序列号绑定、补贴上限、版本迁移）
- `src/domain/seed.ts` —— 初始台账数据
- `src/storage/store.ts` —— localStorage 读写
- `src/ui/DraftForm.tsx`、`src/App.tsx` —— 界面
