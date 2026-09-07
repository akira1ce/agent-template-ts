# Agent Template (TypeScript) - 设计文档

## 核心定位

**我们不造轮子，我们做规范 + DDD 领域驱动设计**

这个模板的核心价值不是重新实现 LangGraph，而是提供一套基于 LangChain.js/LangGraph.js 的**规范化 + DDD 的 Agent 开发模式**。

## 为什么使用 LangChain.js + LangGraph.js？

### 1. 稳定性和社区支持

- ✅ LangChain 用户基数大，社区活跃
- ✅ 持续维护和更新
- ✅ 丰富的文档和示例
- ✅ 生产环境验证

### 2. Runnable 机制

LangChain 的核心抽象 `Runnable` 提供：

```typescript
// 统一的调用接口
await runnable.invoke(input, config);

// 流式输出
for await (const chunk of await runnable.stream(input)) {
  console.log(chunk);
}

// 批量处理
await runnable.batch([input1, input2]);

// 组合能力
const chain = prompt.pipe(llm).pipe(parser);
```

### 3. StateGraph 的强大功能

- ✅ 自动状态管理（Annotation + reducer）
- ✅ 条件路由（addConditionalEdges）
- ✅ 流式执行（stream）
- ✅ Checkpointing（持久化）
- ✅ Human-in-the-loop（人机协作）

**我们不需要重新实现这些。**

---

## 核心价值：DDD + 规范化

### 1. DDD 领域驱动设计 ⭐

**核心原则：每个 Agent 是一个独立的领域**

```
src/agents/travel/          # Travel 领域
├── state.ts               # 领域状态
├── nodes.ts               # 领域节点
├── graph.ts               # 领域图定义
├── prompts.ts             # 领域 Prompt ⭐
└── index.ts               # 领域导出
```

**关键设计决策：Prompt 属于领域知识**

传统方式（不推荐）：
```
src/
├── prompts/               # 全局 Prompt 目录
│   └── index.ts          # 所有 Agent 的 Prompt 混在一起
├── agents/
│   └── travel/
│       └── nodes.ts      # 从全局导入 Prompt
```

DDD 方式（推荐）：
```
src/
├── core/
│   └── prompts.ts        # 只有 Prompt 模式和最佳实践
├── agents/
│   └── travel/
│       ├── prompts.ts    # Travel 领域的 Prompt ⭐
│       └── nodes.ts      # 从本领域导入 Prompt
```

**理由：**

1. **内聚性（Cohesion）**
   - Prompt 和业务逻辑紧密相关
   - 修改业务逻辑时，通常需要同时修改 Prompt
   - 放在一起方便同步修改

2. **自治性（Autonomy）**
   - 每个领域可以独立演化
   - Travel Agent 的 Prompt 改动不影响 Code Review Agent
   - 团队可以并行开发不同的 Agent

3. **清晰边界（Bounded Context）**
   - 避免全局 Prompt 文件越来越臃肿
   - 每个领域的边界清晰
   - 减少命名冲突

4. **易于维护（Maintainability）**
   - 找 Prompt 时，直接去领域目录找
   - 删除一个 Agent 时，直接删除整个目录
   - 版本控制时，领域内的改动在一起

### 2. 规范化的项目结构

```
src/
├── core/                    # 核心规范（跨领域复用）
│   ├── state.ts            # 状态管理规范
│   ├── nodes.ts            # 节点模式规范
│   ├── llm.ts              # LLM 调用规范
│   ├── graph.ts            # 图编排规范
│   └── prompts.ts          # Prompt 模式和最佳实践
│
├── tools/                   # 共享工具（跨领域）
│   └── index.ts            # 通用工具定义
│
├── agents/                  # Agent 领域实现
│   ├── travel/             # 出差助手领域
│   │   ├── state.ts
│   │   ├── nodes.ts
│   │   ├── graph.ts
│   │   ├── prompts.ts      # 领域 Prompt
│   │   └── index.ts
│   │
│   └── code-review/        # 代码审查领域
│       ├── state.ts
│       ├── nodes.ts
│       ├── graph.ts
│       ├── prompts.ts      # 领域 Prompt
│       └── index.ts
│
└── examples/                # 使用示例
    └── travel-agent-demo.ts
```

**价值：**
- 团队协作时统一的代码风格
- 新成员快速上手
- Agent 之间相互独立

### 3. 标准化的状态管理

使用 `Annotation.Root` 定义状态：

```typescript
export const BaseAgentState = Annotation.Root({
  rawInput: Annotation<string>,
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
});
```

**价值：**
- 继承机制（BaseAgentState）
- 类型安全（自动推导）
- 清晰的状态更新逻辑（reducer）

### 4. 模块化的节点设计

标准节点签名 + 装饰器模式：

```typescript
// 标准签名
export type NodeFunction<TState> = (
  state: TState,
  config?: RunnableConfig
) => Promise<Partial<TState>>;

// 装饰器增强
export const myNode = withLogging(
  withRetry(_myNode, 3),
  "myNode"
);
```

**价值：**
- 统一的节点接口
- 可复用的装饰器（logging、retry、validation）
- 易于测试和调试

### 5. 工程化的 Prompt 管理

**core/prompts.ts** - 提供模式和最佳实践：

```typescript
// 不是具体的 Prompt，而是模板和指导
export function createIntentPromptTemplate(domain: string) {
  return `你是 ${domain} 的意图识别节点...`;
}

export const PROMPT_BEST_PRACTICES = {
  SINGLE_RESPONSIBILITY: "...",
  CLEAR_BOUNDARIES: "...",
  STRUCTURED_OUTPUT: "...",
};
```

**agents/xxx/prompts.ts** - 具体的领域 Prompt：

```typescript
// Travel 领域的具体 Prompt
export const INTENT_PROMPT = `你是出差准备 Agent 的意图识别节点...`;
export const EXTRACT_PROMPT = `你是信息抽取节点...`;
```

**价值：**
- 领域自治
- 避免全局文件臃肿
- 方便 A/B 测试和版本控制

---

## DDD 开发流程

### 创建新 Agent 的标准流程

#### Step 1: 创建领域目录

```bash
mkdir -p src/agents/my-agent
```

#### Step 2: 定义领域状态 (`state.ts`)

```typescript
export const MyAgentStateAnnotation = Annotation.Root({
  ...BaseAgentState.spec,
  myField: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
});
```

#### Step 3: 定义领域 Prompt (`prompts.ts`) ⭐

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

#### Step 4: 实现领域节点 (`nodes.ts`)

```typescript
import { INTENT_PROMPT } from "./prompts.js"; // 从本领域导入

async function _intentNode(state: MyAgentState) {
  const chain = createStructuredChain(INTENT_PROMPT, IntentSchema);
  const result = await chain.invoke({ input: state.input });
  return { intent: result };
}

export const intentNode = withLogging(_intentNode, "intent");
```

#### Step 5: 构建领域图 (`graph.ts`)

```typescript
export function createMyAgentGraph() {
  const graph = new StateGraph(MyAgentStateAnnotation);
  graph.addNode("intent", intentNode);
  graph.setEntryPoint("intent");
  graph.addEdge("intent", END);
  return graph.compile();
}
```

#### Step 6: 导出领域模块 (`index.ts`)

```typescript
export * from "./state.js";
export * from "./nodes.js";
export * from "./graph.js";
export * from "./prompts.js"; // 导出 Prompt
```

**只需这六步，创建一个完整的、自治的领域模块。**

---

## 与传统方式的对比

### 传统方式（不推荐）

```
src/
├── prompts/
│   └── index.ts          # 900 行，包含所有 Agent 的 Prompt
│       ├── TRAVEL_INTENT_PROMPT
│       ├── TRAVEL_EXTRACT_PROMPT
│       ├── CODE_REVIEW_INTENT_PROMPT
│       ├── CODE_REVIEW_EXTRACT_PROMPT
│       └── ... 越来越多
│
├── agents/
│   ├── travel/
│   │   └── nodes.ts      # import from "../../prompts"
│   └── code-review/
│       └── nodes.ts      # import from "../../prompts"
```

**问题：**
- ❌ 全局文件越来越大
- ❌ 修改一个领域的 Prompt 可能影响其他领域
- ❌ 团队协作时容易冲突
- ❌ 领域边界不清晰

### DDD 方式（推荐）

```
src/
├── core/
│   └── prompts.ts        # 只有模式和最佳实践
│
├── agents/
│   ├── travel/
│   │   ├── prompts.ts    # Travel 领域的 Prompt
│   │   └── nodes.ts      # import from "./prompts"
│   │
│   └── code-review/
│       ├── prompts.ts    # Code Review 领域的 Prompt
│       └── nodes.ts      # import from "./prompts"
```

**优势：**
- ✅ 领域自治，互不影响
- ✅ 修改清晰，影响范围小
- ✅ 团队可以并行开发
- ✅ 删除 Agent 时，直接删除目录

---

## 核心模式：信息补全 Loop

这是我们模板的核心模式之一：

```
首轮：
  receive → intent → extract → clarify
  → [信息完整？ 是:继续 | 否:暂停]

补充轮：
  complete → [信息完整？ 是:继续 | 否:再次暂停]

继续执行：
  plan → tool → generate → validate → reply
```

**实现方式：**

```typescript
// routes.ts - 条件路由函数集中管理
export function shouldContinue(state: TravelState): string {
  if (state.informationGap?.readyToContinue) {
    return "plan";
  }
  return "wait"; // END
}

export function routeAfterReceive(state: TravelState): string {
  if (state.latestUserSupplement) {
    return "complete_info";
  }
  return "identify_intent";
}

// graph.ts - 图定义
import { shouldContinue, routeAfterReceive } from "./routes.js";

graph.addConditionalEdges("clarify", shouldContinue, {
  plan: "plan",
  wait: END,
});
```

---

## 最佳实践

### 1. DDD 边界

- ✅ 每个 Agent 是一个独立的领域模块
- ✅ 领域内的 Prompt 属于领域知识
- ✅ 共享的规范放在 `core/`
- ✅ 共享的工具放在 `tools/`
- ❌ 不要创建全局的 Prompt 文件

### 2. 状态设计

- ✅ 继承 `BaseAgentState`
- ✅ 使用合适的 `reducer`（替换 vs 累加）
- ✅ 为复杂类型定义 Zod Schema
- ❌ 不要把临时变量放进状态

### 3. 节点设计

- ✅ 职责单一（一个节点做一件事）
- ✅ 返回增量更新（`Partial<State>`）
- ✅ 使用装饰器增强功能
- ❌ 不要在节点间直接传递大对象

### 4. Prompt 设计

- ✅ 在领域目录内创建 `prompts.ts`
- ✅ 明确职责边界（"要做什么"、"不要做什么"）
- ✅ 使用示例提升质量
- ❌ 不要在节点代码里硬编码 Prompt

### 5. 图编排

- ✅ 清晰的执行流程注释
- ✅ 合理的节点粒度
- ✅ 适当的条件分支
- ❌ 不要过度嵌套

---

## 扩展性

### 添加新 Agent（DDD 方式）

```bash
# 1. 创建领域目录
mkdir -p src/agents/customer-service

# 2. 创建领域文件
cd src/agents/customer-service
touch state.ts nodes.ts graph.ts prompts.ts index.ts

# 3. 按照标准流程实现
# state.ts    - 定义领域状态
# prompts.ts  - 定义领域 Prompt ⭐
# nodes.ts    - 实现领域节点（从 ./prompts.ts 导入）
# graph.ts    - 构建领域图
# index.ts    - 导出领域模块
```

### 添加新工具

```typescript
// src/tools/index.ts
export const myNewTool = tool(
  async ({ param }) => {
    // 工具逻辑
    return result;
  },
  {
    name: "my_new_tool",
    description: "...",
    schema: z.object({ param: z.string() }),
  }
);
```

### 添加新装饰器

```typescript
// src/core/nodes.ts
export function withMetrics<TState>(
  func: NodeFunction<TState>
): NodeFunction<TState> {
  return async (state, config) => {
    // 记录指标
    const result = await func(state, config);
    // 上报指标
    return result;
  };
}
```

---

## 总结

**核心价值：**

1. ✅ 使用成熟的 LangChain/LangGraph（不重复造轮子）
2. ✅ 遵循 DDD 领域驱动设计（Prompt 属于领域知识）⭐
3. ✅ 提供规范化的开发模式（统一范式）
4. ✅ 模块化的节点和 Prompt 管理（工程化）
5. ✅ 可复用的 Loop 模式（多轮对话）
6. ✅ 完整的类型安全（TypeScript + Zod）

**DDD 核心原则：**

- 每个 Agent 是一个独立的领域
- Prompt 属于领域知识，放在领域内
- 领域自治，互不影响
- 清晰的边界和职责

**适用场景：**

- 需要多轮对话的 Agent
- 需要信息补全的场景
- 团队协作开发多个 Agent
- 需要规范化的项目结构
- 需要清晰的领域边界

---

**开始用 DDD 方式构建规范化的 Agent！** 🚀
