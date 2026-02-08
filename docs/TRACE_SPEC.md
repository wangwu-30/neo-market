# Trace 规范（v0）

目标：在不暴露敏感内容的前提下，记录 Agent 执行过程的可验证“轨迹”。Trace 仅用于链下存储与验真，不要求链上提交。

## 1. Trace Envelope（JSON schema-ish）

```
TraceEnvelope {
  version: string,                // "0.1"
  traceId: string,                // 全局唯一 ID
  jobId: string,                  // 可选，链上 jobId
  escrowId: string,               // 可选，链上 escrowId
  agent: string,                  // Agent 地址
  createdAt: string,              // ISO8601
  hashAlgo: string,               // "keccak256" | "sha256"
  events: TraceEvent[],
  eventRoot: string,              // 可选，事件链/merkle 根
  traceHash: string,              // 可选，对整个 envelope 做 canonical JSON 哈希
  privacy: PrivacyRules
}
```

建议使用 RFC 8785 进行 JSON canonicalization；`traceHash` 为 canonical JSON 的哈希。

## 2. 事件类型

```
TraceEvent {
  id: string,
  type: string,                   // "message" | "tool_call" | "tool_result" | "artifact" | "error"
  ts: string,                     // ISO8601
  hash: string,                   // event payload hash
  prevHash: string,               // 可选，形成 hash chain
  payload: object,                // 允许脱敏或仅存 hash
  redactions: string[]            // 可选，被移除字段路径
}
```

### 2.1 tool_call

```
payload {
  toolName: string,
  args: object | null,
  argsHash: string,               // args 的 hash
  callId: string,
  model: string | null,
  startedAt: string,
  endedAt: string | null,
  cost: object | null             // 可选，代币/费用
}
```

### 2.2 tool_result

```
payload {
  callId: string,
  status: string,                 // "ok" | "error"
  output: object | null,
  outputHash: string,
  error: object | null
}
```

### 2.3 message

```
payload {
  role: string,                   // "system" | "user" | "assistant"
  content: string | null,
  contentHash: string
}
```

### 2.4 artifact

```
payload {
  kind: string,                   // "file" | "image" | "dataset" | "bundle"
  cid: string | null,
  hash: string,
  size: number | null,
  mime: string | null
}
```

### 2.5 error

```
payload {
  code: string,
  message: string,
  detailHash: string
}
```

## 3. Hash 规则

- `hashAlgo` 统一声明，建议 `keccak256` 以便与链上生态一致。
- `hash` 只对“可公开字段”的 canonical JSON 进行哈希。
- 若 `payload` 被完全移除，必须提供对应 `*Hash` 字段。
- `eventRoot` 可选，推荐使用 hash chain：`hash_i = H(hash_{i-1} || payload_i)`。

## 4. 隐私规则

- 禁止在 `payload` 里存入私钥、访问令牌、PII、未脱敏的客户数据。
- 可用 `redactions` 标注被移除字段路径，如 `"payload.args.password"`。
- 对敏感内容仅保存 `hash`，原文应存入安全存储或完全不保存。
- 若合规要求更高，建议在 `privacy` 中声明保留期限与访问级别。

```
PrivacyRules {
  pii: string,                    // "forbidden" | "hashed" | "allowed"
  secrets: string,                // "forbidden" | "hashed" | "allowed"
  retentionDays: number,
  access: string                  // "private" | "shared" | "public"
}
```

## 5. 示例（简化）

```json
{
  "version": "0.1",
  "traceId": "trace_01HXY...",
  "jobId": "12",
  "escrowId": "8",
  "agent": "0xAa...",
  "createdAt": "2026-02-04T10:00:00Z",
  "hashAlgo": "keccak256",
  "events": [
    {
      "id": "e1",
      "type": "message",
      "ts": "2026-02-04T10:00:00Z",
      "hash": "0x...",
      "payload": {"role": "user", "content": null, "contentHash": "0x..."},
      "redactions": ["payload.content"]
    },
    {
      "id": "e2",
      "type": "tool_call",
      "ts": "2026-02-04T10:00:10Z",
      "hash": "0x...",
      "prevHash": "0x...",
      "payload": {"toolName": "web.fetch", "args": null, "argsHash": "0x...", "callId": "c1", "model": "gpt-4.1", "startedAt": "2026-02-04T10:00:10Z", "endedAt": null, "cost": null},
      "redactions": ["payload.args"]
    },
    {
      "id": "e3",
      "type": "tool_result",
      "ts": "2026-02-04T10:00:12Z",
      "hash": "0x...",
      "prevHash": "0x...",
      "payload": {"callId": "c1", "status": "ok", "output": null, "outputHash": "0x...", "error": null},
      "redactions": ["payload.output"]
    }
  ],
  "privacy": {"pii": "hashed", "secrets": "forbidden", "retentionDays": 30, "access": "private"}
}
```

