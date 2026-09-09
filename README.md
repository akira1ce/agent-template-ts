# Agent Template (TypeScript)

> 基于 LangChain.js 和 LangGraph.js 的模块化 Agent 开发模板

**核心价值：提供规范化的 Agent 开发范式，遵循 DDD 领域驱动设计**

## 🎯 设计理念

我们不重复实现图引擎，而是专注于：

✅ **规范化开发模式** - 统一的项目结构和开发范式
✅ **领域驱动设计** - 遵循 DDD 原则，领域逻辑内聚
✅ **模块化节点设计** - 可复用的节点模式和装饰器
✅ **工程化 Prompt 管理** - Prompt 属于领域知识，与领域放在一起
✅ **标准化状态管理** - 类型安全的状态定义
✅ **可复用的 Loop 模式** - 多轮对话和信息补全

## 📦 技术栈

- **[@langchain/langgraph](https://github.com/langchain-ai/langgraphjs)** - 图编排引擎（StateGraph、Runnable）
- **[@langchain/core](https://github.com/langchain-ai/langchainjs)** - 核心抽象（Prompt、Tools）
- **[@langchain/openai](https://github.com/langchain-ai/langchainjs)** - OpenAI 集成
- **[Zod](https://zod.dev/)** - Schema 验证和类型推导
- **TypeScript** - 完整的类型安全

## 🏗️ 项目结构（DDD）

```
agent-template-ts/
├── src/
│   ├── core/                    # 核心规范模块（跨领域复用）
│   │   ├── state.ts            # 状态管理规范
│   │   ├── runtime.ts          # 运行时工具（节点装饰器等）
│   │   ├── llm.ts              # LLM 调用规范
│   │   ├── prompts.ts          # Prompt 模式和最佳实践
│   │   └── plugins/            # 核心插件系统 ⭐
│   │       ├── index.ts       # 插件导出
│   │       ├── logger.ts      # 日志插件
│   │       ├── timing.ts      # 性能计时插件
│   │       └── retry.ts       # 重试插件
│   │
│   ├── tools/                   # 共享工具（跨领域）
│   │   └── weather.ts          # 天气查询工具
│   │
│   ├── agents/                  # Agent 领域实现
│   │   └── travel/             # 出差助手领域
│   │       ├── state.ts       # 领域状态
│   │       ├── nodes.ts       # 领域节点
│   │       ├── graph.ts       # 领域图定义
│   │       ├── routes.ts      # 路由判断逻辑 ⭐
│   │       ├── prompts.ts     # 领域 Prompt
│   │       └── index.ts       # 领域导出
│   │
│   └── examples/                # 使用示例
│       ├── interactive-demo.ts  # 交互式演示
│       └── multi-turn-demo.ts   # 多轮对话演示
│
├── scripts/
│   └── create-agent.ts         # Agent 脚手架 CLI ⭐
```

### DDD 核心原则

**1. Prompt 属于领域知识** ⭐

- ❌ **不推荐**：全局 `src/prompts/` 目录集中管理所有 Prompt
- ✅ **推荐**：每个领域在自己的模块内管理自己的 Prompt

```typescript
// ❌ 旧方式：从全局导入
import { INTENT_PROMPT } from "../../prompts/index.js";

// ✅ DDD 方式：从本领域导入
import { INTENT_PROMPT } from "./prompts.js";
```

**理由：**

1. **内聚性** - Prompt 和业务逻辑紧密相关，应该放在一起
2. **自治性** - 每个领域可以独立演化自己的 Prompt
3. **清晰边界** - 避免全局 Prompt 文件越来越臃肿
4. **易于维护** - 修改一个领域的 Prompt 不影响其他领域

**2. 路由逻辑内聚** ⭐

- ❌ **不推荐**：将路由判断函数散落在图定义中
- ✅ **推荐**：集中管理路由逻辑在 `routes.ts` 文件中

```typescript
// ❌ 旧方式：在 graph.ts 中内联路由函数
.addConditionalEdges("receive", (state) => {
  if (state.latestUserSupplement) return "complete_info";
  return "identify_intent";
})

// ✅ 新方式：从 routes.ts 导入
import { routeAfterReceive, shouldContinue } from "./routes.js";

.addConditionalEdges("receive", routeAfterReceive, {
  identify_intent: "identify_intent",
  complete_info: "complete_info",
})
```

**理由：**

1. **可测试性** - 路由函数可以独立测试
2. **可维护性** - 路由逻辑集中管理，易于查找和修改
3. **可读性** - 图定义更简洁，专注于流程编排
4. **可复用性** - 相同的路由逻辑可以在多处使用

**3. 插件系统增强** ⭐

使用 `AgentRuntime` 和插件系统为节点添加横切关注点：

```typescript
import { AgentRuntime } from "../../core/runtime.js";
import {
  LoggerPlugin,
  TimingPlugin,
  RetryPlugin,
} from "../../core/plugins/index.js";

// 创建 Runtime 并注册插件
const runtime = new AgentRuntime<MyState>()
  .use(new LoggerPlugin({ logState: false, logResult: false }))
  .use(new TimingPlugin({ slowThreshold: 3000 }))
  .use(new RetryPlugin({ maxRetries: 2, retryDelay: 1000 }));

// 使用 runtime.node() 包装节点，自动应用所有插件
const myNode = runtime.node(
  async (state, config?) => {
    // 节点逻辑
    return { result: "done" };
  },
  { displayName: "my_node" },
);
```

**理由：**

1. **关注点分离** - 业务逻辑和横切关注点分离
2. **全局配置** - 一次配置，所有节点生效
3. **可扩展性** - 容易添加新的插件
4. **标准化** - 统一的插件接口和生命周期钩子

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填写 OPENAI_API_KEY

# 3. 运行示例
npm run dev

# 4. 创建新的 Agent（使用脚手架）⭐
npm run create-agent
# 按提示输入 Agent 名称，自动生成完整的领域模块结构
```

## 💡 核心规范

### 1. 状态管理规范

```typescript
import { Annotation } from "@langchain/langgraph";

export const MyStateAnnotation = Annotation.Root({
  field: Annotation<Type>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
});
```

### 2. 节点设计规范（使用插件系统）

```typescript
import { AgentRuntime } from "../../core/runtime.js";
import { LoggerPlugin, TimingPlugin } from "../../core/plugins/index.js";

// 创建 Runtime 并注册插件
const runtime = new AgentRuntime<MyState>()
  .use(new LoggerPlugin())
  .use(new TimingPlugin());

// 使用 runtime.node() 包装节点
async function _myNode(state: MyState, config?) {
  // 节点逻辑
  return { result: "done" };
}

export const myNode = runtime.node(_myNode, { displayName: "my_node" });
```

### 3. 路由逻辑规范（集中管理）

**在 `routes.ts` 中定义路由函数：**

```typescript
// src/agents/my-agent/routes.ts

/**
 * 路由函数：判断执行路径
 */
export function routeAfterStep(state: MyState): string {
  if (state.condition) {
    return "path_a";
  }
  return "path_b";
}
```

**在图中使用：**

```typescript
// src/agents/my-agent/graph.ts
import { routeAfterStep } from "./routes.js";

graph.addConditionalEdges("step", routeAfterStep, {
  path_a: "node_a",
  path_b: "node_b",
});
```

### 4. Prompt 管理规范（DDD）

**在领域内创建 `prompts.ts`：**

```typescript
// src/agents/my-agent/prompts.ts

/**
 * 意图识别 Prompt
 * 职责：只判断用户想做什么
 */
export const INTENT_PROMPT = `你是 xxx 的意图识别节点...`;

/**
 * 信息抽取 Prompt
 * 职责：只记录明确的事实
 */
export const EXTRACT_PROMPT = `你是信息抽取节点...`;
```

**在节点中导入：**

```typescript
// src/agents/my-agent/nodes.ts
import { INTENT_PROMPT } from "./prompts.js"; // 从本领域导入
```

### 5. LLM 调用规范

```typescript
import { createStructuredChain, LLMPresets } from "../../core/llm.js";

const chain = createStructuredChain(
  PROMPT, // 系统 Prompt
  Schema, // Zod Schema
  LLMPresets.deepseek(), // 或 LLMPresets.openai()
);

const result = await chain.invoke({ input: userInput });
```

### 6. 图编排规范

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { routeAfterStep } from "./routes.js";

const graph = new StateGraph(StateAnnotation)
  .addNode("node1", node1Func)
  .addConditionalEdges("node1", routeAfterStep, {
    continue: "node2",
    end: END,
  });

const app = graph.compile();
```

## 🎨 开发新 Agent 的步骤（DDD）

遵循 DDD 原则，创建一个自治的领域模块：

### Step 0: 使用脚手架快速创建（推荐）⭐

```bash
npm run create-agent
# 输入 Agent 名称，自动生成完整的领域模块结构
```

### Step 1: 手动创建领域目录（可选）

```bash
mkdir -p src/agents/my-agent
```

### Step 2: 定义领域状态 (`state.ts`)

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

### Step 3: 定义领域 Prompt (`prompts.ts`) ⭐

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

### Step 4: 实现领域节点 (`nodes.ts`)

```typescript
import { AgentRuntime } from "../../core/runtime.js";
import {
  LoggerPlugin,
  TimingPlugin,
  RetryPlugin,
} from "../../core/plugins/index.js";
import { createStructuredChain, LLMPresets } from "../../core/llm.js";
import { INTENT_PROMPT } from "./prompts.js"; // 从本领域导入

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
      LLMPresets.deepseek(),
    );
    const result = await chain.invoke({ input: state.input }, config);
    return { intent: result };
  },
  { displayName: "identify_intent" },
);
```

### Step 5: 定义路由逻辑 (`routes.ts`) ⭐

```typescript
import type { MyAgentState } from "./state.js";

/**
 * 路由函数：判断执行路径
 */
export function routeAfterIntent(state: MyAgentState): string {
  if (state.intent === "query") {
    return "query_path";
  }
  return "default_path";
}

/**
 * 条件判断：是否继续执行
 */
export function shouldContinue(state: MyAgentState): string {
  if (state.isComplete) {
    return "end";
  }
  return "continue";
}
```

### Step 6: 构建领域图 (`graph.ts`)

```typescript
import { StateGraph, START, END } from "@langchain/langgraph";
import { MyAgentStateAnnotation } from "./state.js";
import { intentNode } from "./nodes.js";
import { routeAfterIntent, shouldContinue } from "./routes.js";

export function createMyAgentGraph() {
  const graph = new StateGraph(MyAgentStateAnnotation)
    .addNode("intent", intentNode)
    .addEdge(START, "intent")
    .addConditionalEdges("intent", routeAfterIntent, {
      query_path: "query",
      default_path: END,
    });

  return graph.compile();
}

export const myAgent = createMyAgentGraph();
```

## 🔥 核心特性

### 1. 插件系统 ⭐

基于 `AgentRuntime` 的插件系统提供横切关注点的能力增强：

**创建 Runtime 并注册插件**

```typescript
import { AgentRuntime } from "../../core/runtime.js";
import {
  LoggerPlugin,
  TimingPlugin,
  RetryPlugin,
} from "../../core/plugins/index.js";

const runtime = new AgentRuntime<MyState>()
  .use(new LoggerPlugin({ logState: false, logResult: false }))
  .use(new TimingPlugin({ slowThreshold: 3000 }))
  .use(new RetryPlugin({ maxRetries: 2, retryDelay: 1000 }));
```

**日志插件（LoggerPlugin）**

- 自动记录节点的执行情况
- 支持简洁模式和详细模式
- 性能图标展示（⚡ 快速，🐢 慢速）

**性能计时插件（TimingPlugin）**

- 自动记录节点执行时间
- 慢节点警告（超过阈值）

**重试插件（RetryPlugin）**

- 自动重试失败的节点
- 可配置重试次数和延迟
- 可针对特定节点禁用

**使用 runtime.node() 包装节点**

```typescript
// 自动应用所有已注册的插件
export const myNode = runtime.node(
  async (state, config?) => {
    // 节点逻辑
    return { result: "done" };
  },
  {
    displayName: "my_node",
    disablePlugins: ["retry"], // 可选：禁用特定插件
  },
);
```

**优势：**

- 一次配置，所有节点生效
- 支持节点级别的插件控制
- 完整的生命周期钩子（onNodeStart, onNodeEnd, onNodeError）
- 洋葱模型拦截器

### 2. 路由逻辑分离 ⭐

将条件路由逻辑提取到 `routes.ts` 中集中管理：

```typescript
// src/agents/travel/routes.ts
export function routeAfterReceive(state: TravelState): string {
  if (state.latestUserSupplement) {
    return "complete_info";
  }
  return "identify_intent";
}

// src/agents/travel/graph.ts
import { routeAfterReceive } from "./routes.js";

graph.addConditionalEdges("receive", routeAfterReceive, {
  identify_intent: "identify_intent",
  complete_info: "complete_info",
});
```

**优势：**

- 路由函数可独立测试
- 图定义更简洁易读
- 路由逻辑可复用

### 3. 多轮对话支持

基于 `informationGap` 模式：

```typescript
// 首轮
const result1 = await agent.invoke({ rawInput: "我要去北京" });

if (!result1.informationGap?.readyToContinue) {
  console.log(result1.informationGap?.nextQuestion);
  // "请问您计划在北京停留几天？"
}

// 补充轮
const result2 = await agent.invoke({
  ...result1,
  latestUserSupplement: "停留3天",
});
```

### 2. 流式输出

利用 LangGraph 的 `stream` 方法：

```typescript
const stream = await agent.stream({ rawInput: userInput });

for await (const chunk of stream) {
  console.log(chunk); // 观察每个节点的执行
}
```

### 3. LangSmith 集成

在 `.env` 中启用：

```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_API_KEY=your-langsmith-key
LANGCHAIN_PROJECT=agent-template
```

## 📚 核心概念

### StateGraph

LangGraph 的核心类，用于定义节点和边：

```typescript
const graph = new StateGraph(StateAnnotation);
graph.addNode("node1", nodeFunc);
graph.addEdge("node1", "node2");
const app = graph.compile();
```

### Runnable

LangChain 的核心抽象，所有节点函数、Chain 都是 Runnable：

```typescript
// 节点是 Runnable
const result = await myNode.invoke(state, config);

// Chain 也是 Runnable
const chain = prompt.pipe(llm);
const output = await chain.invoke(input);
```

### DDD - 领域驱动设计

**核心原则：**

- 每个 Agent 是一个独立的领域
- 领域内的所有内容（状态、节点、图、Prompt）放在一起
- 领域之间通过清晰的接口交互
- 共享的内容放在 `core/` 和 `tools/`

## 📖 示例场景

### Travel Agent（出差助手）✅

位于 `src/agents/travel/`

**领域文件：**

- `state.ts` - 出差领域状态
- `nodes.ts` - 出差领域节点
- `routes.ts` - 路由判断逻辑 ⭐
- `graph.ts` - 出差领域图定义
- `prompts.ts` - 出差领域 Prompt
- `index.ts` - 领域导出

**功能：**

- 意图识别、信息抽取、信息澄清
- 多轮对话和信息补全
- 条件路由（首轮 vs 补充轮）
- 工具调用（天气查询）
- 结果生成和验证

**架构亮点：**

- 使用插件系统增强节点能力
- 路由逻辑独立管理，可测试
- 清晰的执行流程和状态管理

### 扩展场景

按照相同的 DDD 结构创建：

**Code Review Agent** (`src/agents/code-review/`)

```
读取代码 → 分析问题 → 检查规范 → 生成报告
```

**Customer Service Agent** (`src/agents/customer-service/`)

```
意图分类 → 知识库搜索 → 生成回复 → 满意度跟踪
```

## 📝 最佳实践

### 1. DDD 边界

- ✅ 每个 Agent 是一个独立的领域模块
- ✅ 领域内的 Prompt 属于领域知识
- ✅ 领域内的路由逻辑放在 `routes.ts`
- ✅ 共享的规范放在 `core/`
- ❌ 不要创建全局的 Prompt 文件

### 2. 状态设计

- ✅ 继承 `BaseAgentState`
- ✅ 使用合适的 `reducer`
- ✅ 为复杂类型定义 Zod Schema

### 3. 节点设计

- ✅ 职责单一，一个节点做一件事
- ✅ 使用插件系统增强功能（日志、计时、重试）
- ✅ 返回增量更新（`Partial<State>`）
- ✅ 分离业务逻辑和横切关注点

### 4. 路由设计

- ✅ 将路由函数提取到 `routes.ts`
- ✅ 为路由函数添加清晰的注释说明职责
- ✅ 保持路由函数的纯函数特性（无副作用）
- ✅ 使用命名路由提高可读性

### 5. Prompt 管理

- ✅ 在领域目录内创建 `prompts.ts`
- ✅ 明确每个 Prompt 的职责边界
- ✅ 使用注释说明"要做什么"和"不要做什么"

### 6. 插件使用

- ✅ 所有节点默认使用 LoggerPlugin
- ✅ 性能关键节点使用 TimingPlugin
- ✅ 网络调用节点使用 RetryPlugin
- ✅ 按需组合多个插件

## 🔗 相关资源

- [LangChain.js 文档](https://js.langchain.com/)
- [LangGraph.js 文档](https://langchain-ai.github.io/langgraphjs/)
- [Zod 文档](https://zod.dev/)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [DDD 领域驱动设计](https://martinfowler.com/bliki/DomainDrivenDesign.html)

## 📄 License

MIT
