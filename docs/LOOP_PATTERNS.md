# LangGraph Loop 模式指南

本文档说明 LangGraph 中两种循环模式的区别、适用场景和实现方式。

## 目录

- [两种 Loop 模式](#两种-loop-模式)
- [当前项目的实现](#当前项目的实现)
- [图内 Loop 的典型场景](#图内-loop-的典型场景)
- [实现示例](#实现示例)
- [选择指南](#选择指南)

---

## 两种 Loop 模式

### 1. 会话级 Loop（当前项目使用）

**特点**：
- 每次用户输入都是一次独立的图执行
- 通过 state 持久化记住上下文
- 流程在需要外部输入时结束（`END`），等待下次调用

**流程**：
```
第一次执行: START → ... → check_gap → END (信息不足)
         ↓ 用户补充信息
第二次执行: START → receive → complete_info → ... → END
```

### 2. 图内 Loop（自动迭代）

**特点**：
- 单次 `invoke()` 调用完成所有迭代
- 不需要等待外部输入
- 通过条件边回到之前的节点形成循环

**流程**：
```
单次执行: START → think → tool → observe → think → tool → observe → END
                     ↑________________↓ (循环)
```

---

## 当前项目的实现

在 `src/agents/travel/graph.ts` 中，我们使用的是**会话级 Loop**：

```typescript
.addConditionalEdges("check_gap", shouldContinue, {
  plan: "make_plan",
  wait: END,  // 👈 结束当前执行，等待用户输入
})
```

**为什么选择这种方式？**
- ✅ 旅行 Agent 需要真实用户输入（目的地、日期等）
- ✅ 用户输入时机不确定（可能几秒后，可能几小时后）
- ✅ 更符合对话式 Agent 的交互模式
- ✅ 状态通过外部持久化管理

---

## 图内 Loop 的典型场景

以下场景适合使用图内 Loop，因为它们**不需要人工介入、能自主迭代完成**。

### 1. ReAct 模式 - 工具调用循环

Agent 不断 "思考 → 使用工具 → 观察结果 → 再思考"。

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode("think", thinkNode)        // LLM 决定下一步
  .addNode("use_tool", toolNode)      // 执行工具
  .addNode("observe", observeNode)    // 处理工具返回
  .addConditionalEdges("observe", (state) => {
    return state.taskCompleted ? "finish" : "think";
  }, {
    finish: "generate_final_answer",
    think: "think"  // 👈 循环回 think
  });
```

**应用场景**：
- 搜索 → 发现信息不足 → 再搜索 → 综合答案
- 调用 API → 发现需要另一个 API 的数据 → 调用第二个 API
- 执行 SQL → 发现权限不足 → 切换连接 → 重试

### 2. 自我验证和修正循环

生成内容 → 自我检查 → 不满意就重新生成。

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode("generate_code", generateNode)
  .addNode("validate_code", validateNode)
  .addConditionalEdges("validate_code", (state) => {
    return state.validation.passed ? "done" : "fix";
  }, {
    done: END,
    fix: "generate_code"  // 👈 循环修正
  });
```

**应用场景**：
- 写代码 → 语法检查 → 有错误就改 → 再检查
- 生成 JSON → Schema 验证 → 不符合就重试
- 翻译文本 → 质量评分 → 低于阈值就重新翻译

### 3. 迭代优化循环

每次迭代都在改进结果，直到达到目标。

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode("optimize", optimizeNode)
  .addNode("evaluate", evaluateNode)
  .addConditionalEdges("evaluate", (state) => {
    // 达到目标或超过最大次数就停止
    return state.score >= 0.9 || state.iterations >= 5 
      ? "finish" 
      : "optimize";
  }, {
    finish: "summarize",
    optimize: "optimize"  // 👈 继续优化
  });
```

**应用场景**：
- Prompt 优化：测试 → 评估效果 → 调整 prompt → 再测试
- 参数调优：尝试参数 → 评估性能 → 调整 → 再尝试
- 文本摘要：总结 → 检查长度 → 太长就再压缩

### 4. 分治 + 聚合循环

处理一批任务，逐个完成。

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode("process_item", processNode)
  .addNode("check_remaining", checkNode)
  .addConditionalEdges("check_remaining", (state) => {
    return state.remainingItems.length > 0 
      ? "process" 
      : "aggregate";
  }, {
    process: "process_item",  // 👈 处理下一个
    aggregate: "aggregate_results"
  });
```

**应用场景**：
- 批量数据清洗：处理一条 → 检查队列 → 处理下一条
- 多文档分析：分析一个文档 → 还有文档吗 → 分析下一个
- 爬虫任务：爬一个页面 → 提取链接 → 爬下一个

### 5. 多轮推理循环（Chain of Thought）

复杂问题分解成多步推理。

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode("reason_step", reasonNode)
  .addNode("check_solved", checkNode)
  .addConditionalEdges("check_solved", (state) => {
    return state.problemSolved ? "conclude" : "reason";
  }, {
    conclude: "final_answer",
    reason: "reason_step"  // 👈 继续推理
  });
```

**应用场景**：
- 数学问题：拆解子问题 → 解决一步 → 还有子问题吗 → 继续
- 逻辑推理：提出假设 → 验证 → 不成立就换假设
- 规划任务：生成步骤 → 检查可行性 → 调整 → 再检查

### 6. 对抗式验证循环

生成 + 评判的对抗模式。

```typescript
const graph = new StateGraph(StateAnnotation)
  .addNode("generator", generateNode)
  .addNode("critic", criticNode)
  .addConditionalEdges("critic", (state) => {
    return state.critique.acceptable ? "accept" : "generate";
  }, {
    accept: END,
    generate: "generator"  // 👈 重新生成
  });
```

**应用场景**：
- 生成创意 → 评判质量 → 不好就重新生成
- 写营销文案 → 合规检查 → 有风险就改写
- 生成测试用例 → 覆盖率检查 → 不够就补充

---

## 实现示例

### 完整的图内 Loop 示例：代码生成 + 验证

```typescript
import { StateGraph, START, END, Annotation } from "@langchain/langgraph";

// 定义 State
const CodeGenStateAnnotation = Annotation.Root({
  requirement: Annotation<string>,
  code: Annotation<string | null>,
  validationErrors: Annotation<string[]>,
  attempts: Annotation<number>,
});

// 生成代码节点
const generateCodeNode = async (state: typeof CodeGenStateAnnotation.State) => {
  const llm = createLLM();
  const prompt = state.validationErrors.length > 0
    ? `修复以下错误并重新生成代码：\n${state.validationErrors.join('\n')}\n\n原始需求：${state.requirement}`
    : `根据以下需求生成代码：${state.requirement}`;
  
  const code = await llm.invoke(prompt);
  
  return {
    code: code.content,
    attempts: state.attempts + 1,
  };
};

// 验证代码节点
const validateCodeNode = async (state: typeof CodeGenStateAnnotation.State) => {
  const errors: string[] = [];
  
  // 语法检查
  try {
    new Function(state.code!);
  } catch (e) {
    errors.push(`语法错误: ${e.message}`);
  }
  
  // 更多验证逻辑...
  
  return { validationErrors: errors };
};

// 路由函数
const shouldRetry = (state: typeof CodeGenStateAnnotation.State) => {
  const hasErrors = state.validationErrors.length > 0;
  const maxAttempts = state.attempts >= 3;
  
  if (maxAttempts) return "give_up";
  if (hasErrors) return "retry";
  return "success";
};

// 构建图
const graph = new StateGraph(CodeGenStateAnnotation)
  .addNode("generate", generateCodeNode)
  .addNode("validate", validateCodeNode)
  .addEdge(START, "generate")
  .addEdge("generate", "validate")
  .addConditionalEdges("validate", shouldRetry, {
    retry: "generate",     // 👈 循环回生成
    success: END,
    give_up: END,
  });

const codeGenAgent = graph.compile();

// 使用
const result = await codeGenAgent.invoke({
  requirement: "写一个计算斐波那契数列的函数",
  code: null,
  validationErrors: [],
  attempts: 0,
});
```

---

## 选择指南

| 维度 | 图内 Loop | 会话级 Loop |
|------|-----------|------------|
| **输入来源** | 程序自主决定 | 需要等待用户输入 |
| **执行方式** | 单次 `invoke()` 完成所有迭代 | 多次 `invoke()`，每次用户输入一次 |
| **状态持久化** | 在图的 state 中 | 需要外部存储（数据库/内存） |
| **终止条件** | 程序逻辑判断 | 用户决定或业务逻辑 |
| **适用场景** | 自动化任务、批处理、自我优化 | 对话、人机协作、需要外部输入 |
| **典型例子** | ReAct Agent、代码验证、批处理 | 聊天机器人、表单填写、审批流程 |

### 快速判断

**使用图内 Loop**，如果：
- ✅ 所有决策都可以由程序自主完成
- ✅ 不需要等待外部输入（用户、外部系统）
- ✅ 希望在单次调用中完成所有迭代
- ✅ 有明确的终止条件（次数、质量阈值）

**使用会话级 Loop**，如果：
- ✅ 需要真实用户输入
- ✅ 输入时机不确定（可能延迟很久）
- ✅ 需要在外部系统中持久化状态
- ✅ 符合对话式交互模式

---

## 最佳实践

### 图内 Loop 的注意事项

1. **设置最大迭代次数**，防止无限循环：
```typescript
.addConditionalEdges("check", (state) => {
  if (state.iterations >= MAX_ITERATIONS) return "force_stop";
  return state.shouldContinue ? "continue" : "done";
});
```

2. **记录每次迭代的状态**，便于调试：
```typescript
const StateAnnotation = Annotation.Root({
  history: Annotation<IterationRecord[]>({
    reducer: (old, next) => [...old, ...next],
    default: () => [],
  }),
});
```

3. **提供清晰的退出路径**，避免困在循环中：
```typescript
// 多个退出条件
const routeNext = (state) => {
  if (state.success) return "success_path";
  if (state.gaveUp) return "failure_path";
  if (state.iterations >= MAX) return "timeout_path";
  return "retry";
};
```

### 会话级 Loop 的注意事项

1. **设计清晰的状态持久化策略**
2. **在 state 中记录会话阶段**，方便路由判断
3. **处理超时和过期会话**

---

## 相关文档

- [Runtime 和插件系统](./runtime-plugins.md)
- [API 迁移指南](./API_MIGRATION.md)
- [LangGraph 官方文档 - Conditional Edges](https://langchain-ai.github.io/langgraphjs/how-tos/branching/)
