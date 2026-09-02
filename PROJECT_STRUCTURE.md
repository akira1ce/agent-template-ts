# 项目结构说明（DDD 版本）

## 目录树

```
agent-template-ts/
├── src/
│   ├── core/                       # 核心规范模块（跨领域复用）
│   │   ├── state.ts               # 状态管理规范
│   │   ├── nodes.ts               # 节点模式规范
│   │   ├── llm.ts                 # LLM 调用规范
│   │   ├── graph.ts               # 图编排规范
│   │   ├── prompts.ts             # Prompt 模式和最佳实践 ⭐
│   │   └── index.ts               # 统一导出
│   │
│   ├── tools/                      # 共享工具（跨领域）
│   │   └── index.ts               # 工具定义（weather、flights、hotels）
│   │
│   ├── agents/                     # Agent 领域实现
│   │   └── travel/                # Travel 领域（示例）
│   │       ├── state.ts           # 领域状态定义
│   │       ├── nodes.ts           # 领域节点实现
│   │       ├── graph.ts           # 领域图定义
│   │       ├── prompts.ts         # 领域 Prompt ⭐
│   │       └── index.ts           # 领域导出
│   │
│   └── examples/                   # 使用示例
│       └── travel-agent-demo.ts
│
├── package.json                    # 依赖配置
├── tsconfig.json                   # TypeScript 配置
├── .env.example                    # 环境变量示例
├── .gitignore
│
├── README.md                       # 详细文档（含 DDD 说明）
├── DESIGN.md                       # 设计理念（含 DDD 原则）
├── QUICKSTART.md                   # 快速开始
├── SUMMARY.md                      # 项目总结
├── DDD_MIGRATION.md                # DDD 迁移指南
└── PROJECT_STRUCTURE.md            # 本文件
```

## 核心模块说明

### 1. core/ - 核心规范模块

**目的：** 提供跨领域复用的规范和工具

#### core/state.ts
- `BaseAgentState` - 基础状态定义
- `InformationGapSchema` - 信息缺口 Schema
- `IntentSchema` - 意图识别 Schema
- 工具函数：`createReadyGap()`, `createGapWithQuestion()`

#### core/nodes.ts
- `NodeFunction<TState>` - 标准节点函数类型
- `NodeMetadata` - 节点元数据
- 装饰器：`withLogging()`, `withRetry()`, `validateStateKeys()`
- 工具函数：`createRouter()`, `safeGet()`

#### core/llm.ts
- `LLMPresets` - LLM 配置预设（precise, balanced, creative, fast）
- `createStructuredChain()` - 创建结构化输出 Chain
- `createTextChain()` - 创建文本输出 Chain

#### core/graph.ts
- `createContinueRouter()` - 通用的条件路由
- `addLinearNodes()` - 添加线性节点链
- `createTracingConfig()` - LangSmith 追踪配置

#### core/prompts.ts ⭐
- `PROMPT_BEST_PRACTICES` - Prompt 最佳实践
- `createIntentPromptTemplate()` - 意图识别模板
- `createExtractPromptTemplate()` - 信息抽取模板
- `createClarifyPromptTemplate()` - 信息澄清模板
- `createGeneratePromptTemplate()` - 结果生成模板

**注意：** 这里只提供 Prompt 模式和最佳实践，不包含具体的业务 Prompt

### 2. tools/ - 共享工具

**目的：** 提供跨领域复用的工具

- `queryWeatherTool` - 天气查询工具（LangChain tool）
- `queryWeather()` - 天气查询函数（直接调用）
- `queryFlightsTool` - 航班查询工具（示例）
- `queryHotelsTool` - 酒店查询工具（示例）

### 3. agents/ - Agent 领域实现

**目的：** 每个 Agent 是一个独立的领域模块

#### agents/travel/ - Travel 领域（完整示例）

**travel/state.ts** - 领域状态
- `TravelInformationSchema` - 出差信息 Schema
- `PlanSchema` - 计划 Schema
- `ValidationSchema` - 验证结果 Schema
- `TravelStateAnnotation` - Travel 领域状态定义
- `TravelState` - 状态类型

**travel/prompts.ts** ⭐ - 领域 Prompt
- `INTENT_PROMPT` - 意图识别 Prompt
- `EXTRACT_PROMPT` - 信息抽取 Prompt
- `CLARIFY_PROMPT` - 信息澄清 Prompt
- `PLAN_PROMPT` - 计划生成 Prompt
- `GENERATE_PROMPT` - 结果生成 Prompt
- `VALIDATE_PROMPT` - 结果验证 Prompt

**travel/nodes.ts** - 领域节点
- `receiveNode` - 接收节点
- `intentNode` - 意图识别节点
- `extractNode` - 信息抽取节点
- `clarifyNode` - 信息澄清节点
- `completeNode` - 信息补全节点
- `planNode` - 计划生成节点
- `weatherNode` - 天气查询节点
- `generateNode` - 结果生成节点
- `validateNode` - 结果验证节点
- `replyNode` - 回复节点
- `shouldContinue()` - 条件判断函数

**travel/graph.ts** - 领域图定义
- `createTravelAgentGraph()` - 创建 Travel Agent 图
- `travelAgent` - 默认导出的实例

**travel/index.ts** - 领域导出
- 导出所有领域内容（state, nodes, graph, prompts）

### 4. examples/ - 使用示例

- `travel-agent-demo.ts` - 完整的 Travel Agent 使用示例
  - 单轮对话示例
  - 多轮对话示例
  - 流式输出示例

## DDD 核心原则 ⭐

### 1. Prompt 属于领域知识

**旧方式（不推荐）：**
```
src/prompts/index.ts    # 全局 Prompt 文件
```

**DDD 方式（推荐）：**
```
src/
├── core/prompts.ts              # 只有模式和最佳实践
└── agents/
    └── travel/
        └── prompts.ts           # Travel 领域的 Prompt
```

### 2. 领域自治

每个 Agent 是一个独立的领域模块，包含：
- 状态定义（state.ts）
- 节点实现（nodes.ts）
- 图定义（graph.ts）
- Prompt 定义（prompts.ts）⭐
- 导出（index.ts）

### 3. 清晰边界

- **core/** - 跨领域复用的规范和工具
- **tools/** - 跨领域复用的工具
- **agents/xxx/** - 领域特定的内容

## 文件依赖关系

```
examples/travel-agent-demo.ts
    ↓ import
agents/travel/index.ts
    ↓ export
agents/travel/
    ├── state.ts
    ├── prompts.ts        ⭐
    ├── nodes.ts          ← import from ./prompts.ts
    └── graph.ts          ← import from ./nodes.ts
        ↓ import
core/
    ├── state.ts
    ├── nodes.ts
    ├── llm.ts
    ├── graph.ts
    └── prompts.ts        ⭐ (模式和最佳实践)
```

## 添加新 Agent 的步骤

### 1. 创建领域目录
```bash
mkdir -p src/agents/my-agent
```

### 2. 创建必需文件
```bash
cd src/agents/my-agent
touch state.ts nodes.ts graph.ts prompts.ts index.ts
```

### 3. 实现顺序
1. **state.ts** - 定义领域状态
2. **prompts.ts** - 定义领域 Prompt ⭐
3. **nodes.ts** - 实现领域节点（从 ./prompts.ts 导入）
4. **graph.ts** - 构建领域图
5. **index.ts** - 导出领域模块

### 4. 文件模板

参考 `agents/travel/` 目录的实现

## 关键设计决策

### 为什么 Prompt 放在领域内？

**理由：**
1. **内聚性** - Prompt 和业务逻辑紧密相关
2. **自治性** - 每个领域可以独立演化
3. **清晰边界** - 避免全局文件臃肿
4. **易于维护** - 修改一个领域不影响其他领域

### core/prompts.ts 的作用？

**不是：** 存放具体的业务 Prompt
**而是：** 提供 Prompt 模式和最佳实践

**内容：**
- Prompt 工程最佳实践
- 通用的 Prompt 模板函数
- 参考示例

## 文档说明

- **README.md** - 详细使用文档，包含 DDD 说明
- **DESIGN.md** - 设计理念，深入解释 DDD 原则
- **QUICKSTART.md** - 快速开始指南
- **SUMMARY.md** - 项目总结
- **DDD_MIGRATION.md** - 从旧版本迁移到 DDD 的指南
- **PROJECT_STRUCTURE.md** - 项目结构说明（本文件）

---

**遵循 DDD 原则，构建清晰的领域边界！** 🚀
