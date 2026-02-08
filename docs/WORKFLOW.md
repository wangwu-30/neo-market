# WORKFLOW（执行纪律）

目标：避免“计划写了但没推进”的断档；任何里程碑都有可见的启动/进行/完成信号。

## 1. 里程碑节奏

- 每次定 plan 后，必须在 **2 分钟内**做一件事：
  - 启动 Codex（后台任务）并登记到 watchdog；或
  - 明确写出阻塞点并向王五提问。

- 后台任务完成后，必须在 **30 秒内**发结论（由 watchdog 自动保证）。

## 2. Codex 使用规则

- 任何「实现/改代码」优先交给 Codex。
- 我只做：验收（npm test）、diff 检查、commit、里程碑汇报。

## 3. Watchdog 规则

- 启动任何后台 Codex/exec 任务时，必须把 sessionId 写入：
  `/Users/wangwu/.openclaw/workspace/memory/watchdog-tasks.json`
- Watchdog 每 20 秒轮询一次，任务完成会自动推送：
  - 结果（✅/⚠️）
  - 变更（diff stat）
  - 测试（pass/fail）
  - 下一步（1 行）

## 4. 同步标准（关键进展才打断）

- 打断同步：完成里程碑 / 测试不绿 / 需要决策 / 风险。
- 非关键：不刷屏。
