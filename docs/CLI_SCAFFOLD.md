# CLI 脚手架使用指南

## 概述

快速创建新的 Agent 模板，自动生成完整的代码结构和测试文件。

---

## 快速开始

### 创建新 Agent

```bash
npm run create-agent
```

### 交互式配置

脚手架会引导你完成以下配置：

#### 1. Agent 名称

```
Agent 名称 (kebab-case, 例如: customer-service): 
```

**命名规则：**
- 使用 kebab-case（小写字母，单词间用 `-` 连接）
- 只能包含字母、数字和连字符
- 必须以字母开头

**示例：**
- ✅ `customer-service`
- ✅ `order-manager`
- ✅ `travel-planner`
- ❌ `CustomerService`（不是 kebab-case）
- ❌ `123-agent`（不能以数字开头）

#### 2. Agent 描述

```
Agent 描述 (例如: 智能客服助手): 
```

简短描述这个 Agent 的功能。

#### 3. 功能特性

```
选择功能特性 (输入数字，多个用逗号分隔，例如: 1,2,3):
  1. 多轮对话 (multi-turn)
  2. 工具调用 (tools)
  3. 流式输出 (streaming)

你的选择: 
```

**功能说明：**
- **多轮对话**：支持状态保持和信息补全
- **工具调用**：包含工具调用示例节点
- **流式输出**：生成的回复节点支持流式输出

#### 4. 确认创建

```
📋 配置确认:
  名称: customer-service
  描述: 智能客服助手
  特性: multi-turn, streaming

确认创建？(y/n): 
```

---

## 生成的文件结构

创建完成后会生成以下文件：

```
src/agents/customer-service/
├── state.ts                      # 状态定义
├── nodes.ts                      # 节点实现
├── graph.ts                      # 图编排
├── prompts.ts                    # Prompts
├── index.ts                      # 导出
├── README.md                     # Agent 文档
└── __tests__/
    └── customer-service.test.ts  # 测试文件
```

---

## 生成的代码说明

### 1. `state.ts` - 状态定义

包含：
- 数据模型 Schema（使用 Zod）
- 状态 Annotation（LangGraph）
- TypeScript 类型定义

```typescript
// 自动生成的数据模型
export const CustomerServiceDataSchema = z.object({
  field1: z.string().nullable().describe("字段1描述"),
  field2: z.number().nullable().describe("字段2描述"),
});

// 状态定义
export const CustomerServiceStateAnnotation = Annotation.Root({
  ...BaseAgentState.spec,
  data: Annotation<CustomerServiceData | null>({ ... }),
  // 如果选择了多轮对话，会包含 latestUserSupplement
});
```

### 2. `nodes.ts` - 节点实现

包含：
- Runtime 配置（插件）
- 基础节点：receive, extract, generate, reply
- 如果选择了工具调用，会包含 tool 节点

```typescript
// Runtime 配置
const runtime = new AgentRuntime()
  .use(new LoggerPlugin({ logState: false }))
  .use(new TimingPlugin({ slowThreshold: 3000 }))
  .use(new RetryPlugin({ maxRetries: 2 }));

// 节点实现
export const extractNode = runtime.node(
  async (state, config?) => {
    // 数据提取逻辑
  },
  { displayName: "extract_data" },
);
```

### 3. `graph.ts` - 图编排

包含：
- StateGraph 定义
- 节点连接
- 编译后的 graph 导出

```typescript
export function createCustomerServiceAgentGraph() {
  const graph = new StateGraph(CustomerServiceStateAnnotation)
    .addNode("receive", receiveNode)
    .addNode("extract_data", extractNode)
    .addNode("generate_reply", generateNode)
    .addNode("send_reply", replyNode)
    .addEdge(START, "receive")
    .addEdge("receive", "extract_data")
    .addEdge("extract_data", "generate_reply")
    .addEdge("generate_reply", "send_reply")
    .addEdge("send_reply", END);

  return graph.compile();
}
```

### 4. `prompts.ts` - Prompts

包含：
- 数据提取 Prompt
- 回复生成 Prompt

```typescript
export const EXTRACT_PROMPT = `
你是一个数据提取助手。
从用户输入中提取关键信息...
`;

export const GENERATE_PROMPT = `
你是一个智能助手 - 智能客服助手。
根据提取的数据，生成友好、专业的回复...
`;
```

### 5. `index.ts` - 导出

统一导出 Agent 和类型。

### 6. `README.md` - 文档

包含：
- Agent 功能说明
- 使用方法
- 测试命令
- 开发指南

### 7. `__tests__/*.test.ts` - 测试

包含：
- 基础功能测试
- 性能测试
- 使用 AgentTester 的示例

---

## 开发流程

### 创建后的开发步骤

#### 1. 定义数据结构

编辑 `state.ts`：

```typescript
export const CustomerServiceDataSchema = z.object({
  orderId: z.string().nullable().describe("订单号"),
  issueType: z.enum(["refund", "complaint", "inquiry"]).nullable(),
  description: z.string().nullable().describe("问题描述"),
});
```

#### 2. 编写 Prompts

编辑 `prompts.ts`：

```typescript
export const EXTRACT_PROMPT = `
你是客服助手的数据提取模块。

从用户输入中提取以下信息：
1. 订单号（如果提到）
2. 问题类型（退款、投诉、咨询）
3. 问题描述

返回结构化数据。
`;
```

#### 3. 实现业务逻辑

编辑 `nodes.ts`：

```typescript
// 添加自定义节点
export const queryOrderNode = runtime.node(
  async (state, config?) => {
    const orderId = state.data?.orderId;
    if (!orderId) {
      return {};
    }

    // 查询订单信息
    const orderInfo = await queryOrder(orderId);
    return { orderInfo };
  },
  { displayName: "query_order" },
);
```

#### 4. 调整流程

编辑 `graph.ts`：

```typescript
const graph = new StateGraph(CustomerServiceStateAnnotation)
  .addNode("receive", receiveNode)
  .addNode("extract_data", extractNode)
  .addNode("query_order", queryOrderNode)  // 新增节点
  .addNode("generate_reply", generateNode)
  .addNode("send_reply", replyNode)
  .addEdge(START, "receive")
  .addEdge("receive", "extract_data")
  .addEdge("extract_data", "query_order")  // 新增边
  .addEdge("query_order", "generate_reply")
  .addEdge("generate_reply", "send_reply")
  .addEdge("send_reply", END);
```

#### 5. 编写测试

编辑 `__tests__/*.test.ts`：

```typescript
describe("Customer Service Agent", () => {
  const tester = createAgentTester(customerServiceAgent);

  it("应该正确提取订单号", async () => {
    await tester.testSingleTurn(
      { rawInput: "我的订单 12345 想退款" },
      {
        assertions: (result) => {
          expect(result.data?.orderId).toBe("12345");
          expect(result.data?.issueType).toBe("refund");
        },
      },
    );
  });
});
```

#### 6. 运行测试

```bash
npm test -- src/agents/customer-service
```

---

## 示例：创建完整的 Agent

### 场景：订单管理助手

```bash
$ npm run create-agent

Agent 名称: order-manager
Agent 描述: 智能订单管理助手
选择功能特性: 1,2,3

✅ Agent "order-manager" 创建成功！
```

### 开发步骤

**1. 定义数据模型：**

```typescript
// src/agents/order-manager/state.ts
export const OrderManagerDataSchema = z.object({
  action: z.enum(["create", "query", "cancel"]).nullable(),
  orderId: z.string().nullable(),
  productId: z.string().nullable(),
  quantity: z.number().nullable(),
});
```

**2. 实现节点：**

```typescript
// src/agents/order-manager/nodes.ts
export const processOrderNode = runtime.node(
  async (state, config?) => {
    const { action, orderId } = state.data || {};
    
    if (action === "create") {
      // 创建订单逻辑
    } else if (action === "query") {
      // 查询订单逻辑
    }
    
    return { result: "..." };
  },
  { displayName: "process_order" },
);
```

**3. 测试：**

```typescript
// src/agents/order-manager/__tests__/order-manager.test.ts
it("应该正确创建订单", async () => {
  await tester.testSingleTurn(
    { rawInput: "我要购买商品 ABC，数量 2" },
    {
      assertions: (result) => {
        expect(result.data?.action).toBe("create");
        expect(result.data?.productId).toBe("ABC");
        expect(result.data?.quantity).toBe(2);
      },
    },
  );
});
```

---

## 自定义模板

如果需要自定义生成的模板，可以修改 `scripts/create-agent.ts` 中的生成函数：

- `generateStateTemplate()`
- `generateNodesTemplate()`
- `generateGraphTemplate()`
- `generatePromptsTemplate()`

---

## 故障排查

### 权限问题

```bash
chmod +x scripts/create-agent.ts
```

### TypeScript 错误

确保生成的代码符合项目的 `tsconfig.json` 配置。

### Agent 已存在

```
❌ Agent "customer-service" 已存在
```

解决方法：
- 使用不同的名称
- 或删除已存在的 Agent 目录

---

## 最佳实践

### 命名规范

- Agent 名称：kebab-case（`customer-service`）
- 文件名：kebab-case（`customer-service.test.ts`）
- 类型名：PascalCase（`CustomerServiceState`）
- 变量名：camelCase（`customerServiceAgent`）

### 开发流程

1. 使用脚手架创建基础结构
2. 定义数据模型和 Prompts
3. 实现核心业务逻辑
4. 编写单元测试
5. 运行测试确保正确性
6. 集成到应用中

### 代码组织

- 保持 `nodes.ts` 中每个节点职责单一
- 复杂逻辑提取到独立的工具函数
- Prompts 使用清晰的结构和说明
- 测试覆盖核心功能和边界情况

---

## 总结

CLI 脚手架提供：

- ✅ **快速创建** - 一个命令创建完整 Agent 结构
- ✅ **标准模板** - 符合项目规范的代码模板
- ✅ **功能可选** - 根据需求选择功能特性
- ✅ **即用测试** - 自动生成测试文件和示例

使用脚手架可以大大提升开发效率，确保代码结构的一致性！
