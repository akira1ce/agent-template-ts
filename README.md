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
│   │   ├── nodes.ts            # 节点模式规范
│   │   ├── llm.ts              # LLM 调用规范
│   │   ├── graph.ts            # 图编排规范
│   │   └── prompts.ts          # Prompt 模式和最佳实践
│   │
│   ├── tools/                   # 共享工具（跨领域）
│   │   └── index.ts            # 通用工具定义
│   │
│   ├── agents/                  # Agent 领域实现
│   │   └── travel/             # 出差助手领域
│   │       ├── state.ts       # 领域状态
│   │       ├── nodes.ts       # 领域节点
│   │       ├── graph.ts       # 领域图定义
│   │       ├── prompts.ts     # 领域 Prompt ⭐
│   │       └── index.ts       # 领域导出
│   │
│   └── examples/                # 使用示例
│       └── travel-agent-demo.ts
```

### DDD 核心原则

**Prompt 属于领域知识** ⭐

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

## 🚀 快速开始

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env 填写 OPENAI_API_KEY

# 3. 运行示例
npm run dev
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

### 2. 节点设计规范

```typescript
import { withLogging } from "../../core/nodes.js";

async function _myNode(state: MyState) {
  // 节点逻辑
  return { result: "done" };
}

export const myNode = withLogging(_myNode, "myNode");
```

### 3. Prompt 管理规范（DDD）

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

### 4. LLM 调用规范

```typescript
import { createStructuredChain, LLMPresets } from "../../core/llm.js";

const chain = createStructuredChain(
  PROMPT,      // 系统 Prompt
  Schema,      // Zod Schema
  LLMPresets.precise()
);

const result = await chain.invoke({ input: userInput });
```

### 5. 图编排规范

```typescript
import { StateGraph, END } from "@langchain/langgraph";

const graph = new StateGraph(StateAnnotation);
graph.addNode("node1", node1Func);
graph.addEdge("node1", END);
const app = graph.compile();
```

## 🎨 开发新 Agent 的步骤（DDD）

遵循 DDD 原则，创建一个自治的领域模块：

### Step 1: 创建领域目录

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
import { withLogging } from "../../core/nodes.js";
import { createStructuredChain } from "../../core/llm.js";
import { INTENT_PROMPT } from "./prompts.js"; // 从本领域导入

async function _intentNode(state: MyAgentState) {
  const chain = createStructuredChain(INTENT_PROMPT, IntentSchema);
  const result = await chain.invoke({ input: state.input });
  return { intent: result };
}

export const intentNode = withLogging(_intentNode, "intent");
```

### Step 5: 构建领域图 (`graph.ts`)

```typescript
import { StateGraph, END } from "@langchain/langgraph";
import { MyAgentStateAnnotation } from "./state.js";
import { intentNode } from "./nodes.js";

export function createMyAgentGraph() {
  const graph = new StateGraph(MyAgentStateAnnotation);
  
  graph.addNode("intent", intentNode);
  graph.setEntryPoint("intent");
  graph.addEdge("intent", END);
  
  return graph.compile();
}

export const myAgent = createMyAgentGraph();
```

### Step 6: 导出领域模块 (`index.ts`)

```typescript
export * from "./state.js";
export * from "./nodes.js";
export * from "./graph.js";
export * from "./prompts.js"; // 导出 Prompt
```

## 🔥 核心特性

### 1. 多轮对话支持

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
- `graph.ts` - 出差领域图定义
- `prompts.ts` - 出差领域 Prompt ⭐
- `index.ts` - 领域导出

**功能：**
- 意图识别、信息抽取、信息澄清
- 多轮对话和信息补全
- 工具调用（天气查询）
- 结果生成和验证

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
- ✅ 共享的规范放在 `core/`
- ❌ 不要创建全局的 Prompt 文件

### 2. 状态设计

- ✅ 继承 `BaseAgentState`
- ✅ 使用合适的 `reducer`
- ✅ 为复杂类型定义 Zod Schema

### 3. 节点设计

- ✅ 职责单一，一个节点做一件事
- ✅ 使用装饰器增强功能
- ✅ 返回增量更新（`Partial<State>`）

### 4. Prompt 管理

- ✅ 在领域目录内创建 `prompts.ts`
- ✅ 明确每个 Prompt 的职责边界
- ✅ 使用注释说明"要做什么"和"不要做什么"

## 🔗 相关资源

- [LangChain.js 文档](https://js.langchain.com/)
- [LangGraph.js 文档](https://langchain-ai.github.io/langgraphjs/)
- [Zod 文档](https://zod.dev/)
- [OpenAI API 文档](https://platform.openai.com/docs)
- [DDD 领域驱动设计](https://martinfowler.com/bliki/DomainDrivenDesign.html)

## 📄 License

MIT

---

**开始用 DDD 方式构建规范化的 Agent！** 🚀
