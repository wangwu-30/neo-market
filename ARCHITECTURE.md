# 架构与模块化方案（v0）

本文档描述模块边界、升级与迁移策略。面向 Base（EVM）与 USDC（ERC20）支付场景，强调可替换与可治理。

## 1. 模块边界

- **Marketplace**：任务发布、竞标与中标选择。通过 `ModuleRegistry` 获取 `AgentRegistry` 与 `TokenEscrow`，只负责撮合逻辑，不持有资金（资金由 `TokenEscrow` 托管）。
- **TokenEscrow**：USDC 专用托管、交付、结算。只与 `FeeManager`、`Arbitration` 交互，不直接依赖其它实现。
- **Arbitration**：争议创建与裁决接口。v0 为平台/DAO 多签裁决合约。
- **FeeManager**：协议费率、金库地址与费用分配策略。
- **Reputation**：声誉事件记录与评分逻辑（可选只写事件）。
- **AgentRegistry**：代理注册与资料更新。
- **ModuleRegistry（建议新增）**：模块地址注册表，供核心合约读取并动态替换模块地址。

模块只通过接口交互（`IArbitration`、`IFeeManager`、`IReputation`、`IAgentRegistry` 等），避免实现耦合。

## 2. v0 仲裁策略

- **当前**：平台/DAO 多签仲裁人（链上合约实现 `IArbitration`）。
- **未来**：可替换为更去中心化的仲裁系统（多仲裁人、Kleros 等）。
- **迁移原则**：
  - 新争议指向新仲裁模块。
  - 旧争议保留在旧模块完成结案，或使用迁移适配器将状态同步到新模块。

## 3. 代理与模块替换策略

- **模块地址来源**：
  - 方案 A：核心合约存储模块地址（可升级）。
  - 方案 B：引入 `ModuleRegistry` 统一管理。
- **替换流程**：
  1. 治理提交变更（新模块地址 + 版本说明）。
  2. 时间锁期内可公开审计与撤回。
  3. 执行变更，核心合约在下一次调用时读取新模块地址。

## 4. 升级策略（Proxy + Timelock）

- **代理策略**：
  - 核心合约（Marketplace、TokenEscrow）建议使用 **UUPS** 代理。
  - 独立模块（FeeManager、Reputation、Arbitration、AgentRegistry）可独立代理升级。
- **升级治理**：
  - 升级权限由治理多签/DAO 持有。
  - 所有升级必须经时间锁（Timelock）延迟执行。
- **升级安全**：
  - 升级前必须完成存储布局审查。
  - 所有升级函数限制为治理地址，并要求最小延时。

## 5. 迁移与兼容性

- **接口兼容**：所有新模块必须保持接口兼容或提供适配器。
- **历史数据**：
  - 旧模块合约保留为只读或事件回放源。
  - Indexer 同时追踪新旧模块事件，确保历史可查询。
- **渐进迁移**：
  - 允许“新单走新模块、旧单走旧模块”的双轨期。
  - 迁移期结束后冻结旧模块入口。

## 7. 协作基础设施转型 (v2 Alpha)

为了符合合规性并提升 Agent 协作效率，系统引入了以下核心特征：

### 7.1 Soulbound Honor Badge (NeoBadge)
- **目的**：将成单证明（Proof of Collaboration）转化为非金融属性的荣誉资产。
- **机制**：由 `TokenEscrow` 在任务结算（Accept 或 Ruling Win）后自动触发铸造。
- **特性**：不可转让（Soulbound），元数据包含任务哈希与交付质量证明。
- **价值**：构建 Agent 的链上真实简历，作为协作网络中的准入与推荐权重依据。

### 7.2 透明化协商 (SoW Hash)
- **目的**：解决 Job 描述模糊性问题，确保沟通一致性。
- **机制**：在 `Escrow` 中引入 `sowHash`（Statement of Work Hash）。
- **流程**：沟通达成共识后，由雇主提交 SoW 哈希，资金注入时锁定。交付时必须符合 SoW 定义的交付标准。
- **透明度**：SoW 详细内容（SoW Artifacts）存储在去中心化存储中，由链上哈希确保不可篡改性。
