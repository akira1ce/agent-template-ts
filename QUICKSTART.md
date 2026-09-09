# 快速开始指南（DDD 版本）

## 项目已创建 ✅

位置：`/Users/akira1ce/Documents/workspace/akira1ce/agent/agent-template-ts`

## 核心理念

**我们使用 LangChain.js + LangGraph.js + DDD 领域驱动设计**

- ✅ 使用成熟的图引擎（LangGraph StateGraph）
- ✅ 使用 Runnable 机制（统一接口、流式支持）
- ✅ 遵循 DDD 原则（Prompt 属于领域知识）⭐
- ✅ 提供规范化的开发模式
- ✅ 提供模块化的节点和 Prompt 管理

## 重要变更：DDD 架构 ⭐

### Prompt 管理方式

**旧方式（已废弃）：**
```
src/prompts/index.ts    # 全局 Prompt 文件
```

**新方式（DDD）：**
```
src/
├── core/prompts.ts              # Prompt 模式和最佳实践
└── agents/
    └── travel/
        └── prompts.ts           # Travel 领域的 Prompt ⭐
```

**导入方式：**
```typescript
// ❌ 旧方式
import { INTENT_PROMPT } from "../../prompts/index.js";

// ✅ DDD 方式
import { INTENT_PROMPT } from "./prompts.js";
```

## 快速开始

### 1. 安装依赖

```bash
cd /Users/akira1ce/Documents/workspace/akira1ce/agent/agent-template-ts
npm install
```

### 2. 配置环境

```bash
cp .env.example .env
# 编辑 .env 填写 OPENAI_API_KEY
```

### 3. 运行示例

```bash
npm run dev
```

你将看到三个示例：
1. 单轮对话（信息完整）
2. 多轮对话（信息补全）
3. 流式输出（观察节点执行）

## 核心依赖

```json
{
  "@langchain/core": "^0.3.0",        // 核心抽象
  "@langchain/openai": "^0.3.0",      // OpenAI 集成
  "langchain": "^0.3.0",              // LangChain 主包
  "@langchain/langgraph": "^0.2.0",   // 图编排引擎
  "zod": "^3.23.8"                    // Schema 验证
}
```

## 项目结构（DDD）

```
src/
├── core/               # 核心规范（跨领域复用）
│   ├── state.ts
│   ├── runtime.ts     # 运行时和插件系统
│   ├── llm.ts
│   ├── prompts.ts     # Prompt 模式和最佳实践
│   └── plugins/       # 核心插件系统 ⭐
│       ├── index.ts
│       ├── logger.ts
│       ├── timing.ts
│       └── retry.ts
│
├── tools/              # 共享工具（跨领域）
│   └── weather.ts
│
├── agents/             # Agent 领域实现
│   └── travel/        # Travel 领域
│       ├── state.ts
│       ├── nodes.ts
│       ├── routes.ts  # 路由判断逻辑 ⭐
│       ├── graph.ts
│       ├── prompts.ts # 领域 Prompt ⭐
│       └── index.ts
│
└── examples/           # 运行示例
    ├── interactive-demo.ts
    └── multi-turn-demo.ts
```

## DDD 核心概念

### 1. 领域模块

每个 Agent 是一个独立的领域模块：

```
src/agents/travel/          # Travel 领域
├── state.ts               # 领域状态
├── nodes.ts               # 领域节点
├── graph.ts               # 领域图定义
├── prompts.ts             # 领域 Prompt ⭐
└── index.ts               # 领域导出
```

### 2. Prompt 属于领域知识

**核心原则：** Prompt 和业务逻辑紧密相关，应该放在一起

**优势：**
- ✅ 内聚性 - 修改业务逻辑时，同步修改 Prompt
- ✅ 自治性 - 每个领域独立演化
- ✅ 清晰边界 - 避免全局文件臃肿
- ✅ 易于维护 - 删除 Agent 时，直接删除目录

## 开发新 Agent（DDD 方式）

### Step 1: 创建领域目录

```bash
mkdir -p src/agents/my-agent
cd src/agents/my-agent
```

### Step 2: 创建领域文件

```bash
touch state.ts nodes.ts graph.ts prompts.ts index.ts
```

### Step 3: 定义领域状态 (`state.ts`)

```typescript
import { Annotation } from "@langchain/langgraph";
import { BaseAgentState } from "../../core/state.js";

export const MyAgentStateAnnotation = Annotation.Root({
  ...BaseAgentState.spec,
  
  // 添加领域字段
  myField: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
});

export type MyAgentState = typeof MyAgentStateAnnotation.State;
```

### Step 4: 定义领域 Prompt (`prompts.ts`) ⭐

```typescript
/**
 * 意图识别 Prompt
 */
export const INTENT_PROMPT = `你是 xxx 的意图识别节点...`;

/**
 * 信息抽取 Prompt
 */
export const EXTRACT_PROMPT = `你是信息抽取节点...`;
```

### Step 5: 实现领域节点 (`nodes.ts`)

```typescript
import { AgentRuntime } from "../../core/runtime.js";
import { LoggerPlugin, TimingPlugin, RetryPlugin } from "../../core/plugins/index.js";
import { createStructuredChain, LLMPresets } from "../../core/llm.js";
import { INTENT_PROMPT } from "./prompts.js"; // 从本领域导入 ⭐

// 创建 Runtime 并配置全局插件
const runtime = new AgentRuntime<MyAgentState>()
  .use(new LoggerPlugin({ logState: false, logResult: false }))
  .use(new TimingPlugin({ slowThreshold: 3000 }))
  .use(new RetryPlugin({ maxRetries: 2, retryDelay: 1000 }));

// 使用 runtime.node() 包装节点
export const intentNode = runtime.node(
  async (state, config?) => {
    const chain = createStructuredChain(
      INTENT_PROMPT,
      IntentSchema,
      LLMPresets.deepseek()
    );
    const result = await chain.invoke({ input: state.input }, config);
    return { intent: result };
  },
  { displayName: "identify_intent" }
);
```

### Step 6: 构建领域图 (`graph.ts`)

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { MyAgentStateAnnotation } from "./state.js";
import { intentNode } from "./nodes.js";

export function createMyAgentGraph() {
  const graph = new StateGraph(MyAgentStateAnnotation)
    .addNode("intent", intentNode)
    .addEdge(START, "intent")
    .addEdge("intent", END);
  
  return graph.compile();
}

export const myAgent = createMyAgentGraph();
```

### Step 7: 导出领域模块 (`index.ts`)

```typescript
export * from "./state.js";
export * from "./nodes.js";
export * from "./graph.ts";
export * from "./prompts.js";  // 导出 Prompt
```

## 核心规范

### 1. 状态管理

使用 LangGraph 的 `Annotation.Root`：

```typescript
export const MyStateAnnotation = Annotation.Root({
  field: Annotation<Type>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
});
```

### 2. 节点设计

使用 `AgentRuntime` 和插件系统：

```typescript
import { AgentRuntime } from "../../core/runtime.js";
import { LoggerPlugin, TimingPlugin } from "../../core/plugins/index.js";

// 创建 Runtime 并注册插件
const runtime = new AgentRuntime<MyState>()
  .use(new LoggerPlugin())
  .use(new TimingPlugin());

// 使用 runtime.node() 包装节点
export const myNode = runtime.node(
  async (state, config?) => {
    return { result: "done" };
  },
  { displayName: "my_node" }
);
```

### 3. Prompt 管理（DDD）⭐

```typescript
// src/agents/my-agent/prompts.ts
export const MY_PROMPT = `你是 xxx 节点...`;

// src/agents/my-agent/nodes.ts
import { MY_PROMPT } from "./prompts.js"; // 从本领域导入
```

### 4. LLM 调用

使用封装的 `createStructuredChain`：

```typescript
import { createStructuredChain, LLMPresets } from "../../core/llm.js";

const chain = createStructuredChain(
  PROMPT,
  Schema,
  LLMPresets.deepseek()  // 或 LLMPresets.openai()
);
const result = await chain.invoke({ input: userInput });
```

### 5. 图编排

使用 LangGraph 的 `StateGraph`：

```typescript
const graph = new StateGraph(StateAnnotation);
graph.addNode("node1", node1Func);
graph.addEdge("node1", END);
const app = graph.compile();
```

## LangGraph 核心优势

### 1. Runnable 机制

所有节点都是 Runnable，统一接口：

```typescript
// 调用
await runnable.invoke(input, config);

// 流式
for await (const chunk of await runnable.stream(input)) {
  console.log(chunk);
}

// 组合
const chain = prompt.pipe(llm).pipe(parser);
```

### 2. StateGraph 功能

- 自动状态管理（reducer）
- 条件路由
- 流式执行
- Checkpointing
- Human-in-the-loop

**我们无需重新实现这些！**

## 与 Python 版本对应

| Python | TypeScript |
|--------|-----------|
| `StateGraph(TypedDict)` | `StateGraph(Annotation.Root)` |
| `Pydantic` | `Zod` |
| `add_node()` | `addNode()` |
| `compile()` | `compile()` |
| `invoke()` | `invoke()` |
| `stream()` | `stream()` |

API 高度一致！

## 下一步

1. 查看 `src/agents/travel/` 了解完整的 DDD 实现
2. 查看 `DESIGN.md` 了解 DDD 设计理念
3. 查看 `README.md` 了解详细文档
4. 参考此模式创建你的 Agent

## 文档

- **README.md** - 详细文档（含 DDD 说明）
- **DESIGN.md** - 设计理念（含 DDD 原则）
- **QUICKSTART.md** - 本文件
- **SUMMARY.md** - 项目总结

## 关键要点

### DDD 原则 ⭐

1. **Prompt 属于领域知识**
   - 放在 `agents/xxx/prompts.ts`
   - 不要放在全局 `prompts/` 目录

2. **领域自治**
   - 每个 Agent 是独立的领域模块
   - 修改一个领域不影响其他领域

3. **清晰边界**
   - 共享的规范放在 `core/`
   - 共享的工具放在 `tools/`
   - 领域特定的放在 `agents/xxx/`

---

**开始用 DDD 方式构建规范化的 Agent！** 🚀
