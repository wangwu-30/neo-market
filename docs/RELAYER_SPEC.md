# Relayer 规范（v0）

目标：在不修改现有合约的前提下提供“代发/赞助”能力。Relayer 是链下服务，不引入新合约或新基础设施。

## 1. 设计原则

- **不改合约**：仅调用现有 `AgentRegistry` 与 `TokenEscrow`。
- **两种模式**：
  - **Sponsored 模式**：Relayer 自付 gas 并直接发起交易（仅支持 `submitDelivery`）。
  - **Broadcast 模式**：用户提供已签名的原始交易，Relayer 仅做转发（支持 `register/updateAgent` 与可选 `openDispute`）。
- **Base + USDC**：所有交易均在 Base 网络，资产以 USDC 计。

## 2. 支持的动作（v0）

- `registerAgent`：调用 `AgentRegistry.register(manifestCID)`（Broadcast 模式）。
- `updateAgent`：调用 `AgentRegistry.updateManifest(manifestCID)`（Broadcast 模式）。
- `submitDelivery`：调用 `TokenEscrow.submitDelivery(receipt, signature)`（Sponsored 模式）。
- `openDispute`（可选）：调用 `TokenEscrow.openDispute(escrowId, evidenceCID)`（Broadcast 模式，限额更严格）。

说明：
- `submitDelivery` 本身包含 EIP-712 签名与链上验证，所以允许由任意 `msg.sender` 代发。
- `register/updateAgent/openDispute` 需要 `msg.sender` 为本人，因此只能转发用户已签名交易。

## 3. Sponsored 模式（submitDelivery）

### 3.1 认证消息（EIP-712）

Relayer 只在链下校验授权，避免滥用与重放。

Domain：
- `name`: `"AgentMarket"`
- `version`: `"1"`
- `chainId`: Base chainId
- `verifyingContract`: Relayer 服务标识地址（可使用 `TokenEscrow` 地址作为约定值）

Typed Data：
```
RelayRequest(
  address sender,
  address target,
  bytes32 dataHash,
  uint256 nonce,
  uint64 deadline
)
```

- `sender`：Agent 地址
- `target`：`TokenEscrow` 地址
- `dataHash`：`keccak256(abi.encode(receipt, signature))`
- `nonce`：Relayer 维护的 per-sender 递增 nonce
- `deadline`：过期时间（Unix 秒）

### 3.2 提交流程

1. Agent 生成 `DeliveryReceiptSignature` 并签名（见 `docs/AGENT_SDK_QUICKSTART.md`）。
2. 计算 `dataHash`，生成 `RelayRequest` 并签名。
3. Relayer 校验：
   - `deadline` 未过期
   - `nonce` 与本地一致
   - `dataHash` 与请求体一致
4. Relayer 发送链上交易：
   - `TokenEscrow.submitDelivery(receipt, signature)`
5. Relayer 递增本地 `nonce`。

## 4. Broadcast 模式（register/updateAgent/openDispute）

- 用户在本地构造并签名原始交易（`eth_sendRawTransaction` 的 payload）。
- Relayer 仅做转发，不修改交易内容。
- Relayer 依旧可以要求一个轻量授权消息（可选），用于限流与审计。

## 5. Nonce 与 Deadline

- Sponsored 模式使用 **Relayer 侧 nonce**，与链上 `TokenEscrow.nonces` 无关。
- DeliveryReceipt 本身仍需满足链上 `TokenEscrow.nonces[agent]`。
- `deadline` 超时拒绝，建议默认 10 分钟。

## 6. 限流与滥用防护

- 按 `sender` 地址限流：默认 `10 / min`。
- 按 IP 限流：默认 `60 / min`。
- Sponsored 模式需白名单或最低信誉分（可由服务配置）。
- `openDispute` 仅允许参与方地址，且每日次数上限更低（例如 `2 / day`）。
- 请求体大小限制，`manifestCID` 与 `evidenceCID` 长度需在合理范围内。

## 7. 最小 API（示例）

```
POST /relay/submit-delivery
{
  "receipt": { ... },
  "signature": "0x...",
  "relayRequest": { ... },
  "relaySignature": "0x..."
}

POST /relay/broadcast
{
  "rawTx": "0x...",
  "action": "registerAgent" | "updateAgent" | "openDispute"
}
```

