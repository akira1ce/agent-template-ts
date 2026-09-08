# Agent Runtime 插件系统

## 概述

Agent Runtime 提供了一套灵活的插件系统，用于增强节点的功能。通过插件，你可以轻松添加日志、性能监控、重试机制等横切关注点。

## 核心概念

### AgentRuntime
运行时容器，管理所有插件并应用到节点上。

### AgentPlugin
插件接口，定义了完整的生命周期钩子：
- `onInit` - 初始化时调用
- `onNodeStart` - 节点开始前调用
- `onNodeEnd` - 节点成功结束后调用
- `onNodeError` - 节点出错时调用
- `intercept` - 拦截器（洋葱模型）

## 快速开始

### 1. 创建 Runtime 并注册插件

```typescript
import { AgentRuntime } from "@core/runtime.js";
import {
  LoggerPlugin,
  TimingPlugin,
  RetryPlugin,
} from "@core/plugins/index.js";

const runtime = new AgentRuntime<MyState>()
  .use(new LoggerPlugin({ logState: false }))
  .use(new TimingPlugin({ slowThreshold: 3000 }))
  .use(new RetryPlugin({ maxRetries: 2 }));
```

### 2. 应用到节点

```typescript
// 原始节点实现
async function _myNode(
  state: MyState,
  config?: RunnableConfig
): Promise<Partial<MyState>> {
  // 业务逻辑
  return { result: "done" };
}

// 使用 runtime 增强节点
export const myNode = runtime.node(_myNode, {
  displayName: "my_node",
});
```

### 3. 节点级别的插件控制

```typescript
// 禁用某些插件
export const weatherNode = runtime.node(_weatherNode, {
  displayName: "query_weather",
  disablePlugins: ["retry"], // 天气查询不重试
});
```

## 内置插件

### LoggerPlugin

记录节点的执行情况。

```typescript
new LoggerPlugin({
  logState: false,   // 是否记录状态详情
  logResult: false,  // 是否记录结果详情
  level: "info",     // 日志级别
})
```

**输出示例：**
```
[Node Start] identify_intent
[Node End] identify_intent (234ms)
```

### TimingPlugin

性能监控，记录节点耗时。

```typescript
new TimingPlugin({
  slowThreshold: 5000,  // 慢查询阈值（毫秒）
  printTiming: true,    // 是否打印耗时
})
```

**输出示例：**
```
⏱️  identify_intent: 234ms
⚠️  Slow node detected: extract_info took 6234ms (threshold: 5000ms)
```

**获取统计信息：**
```typescript
const timingPlugin = new TimingPlugin();
runtime.use(timingPlugin);

// 执行一些节点后
const stats = timingPlugin.getStats("identify_intent");
// { count: 10, total: 2340, avg: 234, min: 180, max: 450 }

timingPlugin.printStats(); // 打印所有节点统计
```

### RetryPlugin

自动重试失败的节点。

```typescript
new RetryPlugin({
  maxRetries: 3,                    // 最大重试次数
  retryDelay: 1000,                 // 重试延迟（毫秒）
  delayStrategy: "exponential",     // "fixed" | "exponential"
  backoffMultiplier: 2,             // 指数退避倍数
  shouldRetry: (error) => {         // 自定义重试条件
    return error.message.includes("timeout");
  },
})
```

**默认重试条件：**
- 网络错误（timeout, network, ECONNREFUSED）
- Rate limit（429）
- Service unavailable（503）

**输出示例：**
```
🔄 extract_info failed, retrying (1/3) in 1000ms...
   Error: Network timeout
🔄 extract_info failed, retrying (2/3) in 2000ms...
   Error: Network timeout
❌ extract_info failed after 2 retries
```

## 完整示例

```typescript
// src/agents/travel/nodes.ts
import { AgentRuntime } from "@core/runtime.js";
import {
  LoggerPlugin,
  TimingPlugin,
  RetryPlugin,
} from "@core/plugins/index.js";

// 创建全局 runtime
const runtime = new AgentRuntime<TravelState>()
  .use(new LoggerPlugin({ logState: false, logResult: false }))
  .use(new TimingPlugin({ slowThreshold: 3000 }))
  .use(new RetryPlugin({ maxRetries: 2, retryDelay: 1000 }));

// 普通节点
async function _intentNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  // 业务逻辑
  const userIntent = await identifyIntent(state.input!);
  return { userIntent };
}

export const intentNode = runtime.node(_intentNode, {
  displayName: "identify_intent",
});

// 禁用重试的节点
async function _weatherNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  const weather = await queryWeather(state.destination);
  return { weather };
}

export const weatherNode = runtime.node(_weatherNode, {
  displayName: "query_weather",
  disablePlugins: ["retry"], // 天气 API 失败不重试
});
```

## 自定义插件

```typescript
import type { AgentPlugin, NodeContext } from "@core/runtime.js";

export class MyCustomPlugin<S = any> implements AgentPlugin<S> {
  name = "my-custom-plugin";

  async onNodeStart(ctx: NodeContext<S>): Promise<void> {
    console.log(`Starting ${ctx.nodeName}`);
  }

  async onNodeEnd(ctx: NodeContext<S>, result: Partial<S>): Promise<void> {
    const duration = Date.now() - ctx.startTime;
    console.log(`Finished ${ctx.nodeName} in ${duration}ms`);
  }

  async intercept(
    ctx: NodeContext<S>,
    next: () => Promise<Partial<S>>
  ): Promise<Partial<S>> {
    // 前置逻辑
    console.log("Before execution");
    
    // 执行节点
    const result = await next();
    
    // 后置逻辑
    console.log("After execution");
    
    return result;
  }
}

// 使用自定义插件
const runtime = new AgentRuntime()
  .use(new MyCustomPlugin())
  .use(new LoggerPlugin());
```

## 插件执行顺序

插件按照注册顺序执行（洋葱模型）：

```typescript
runtime
  .use(new PluginA())  // 最外层
  .use(new PluginB())
  .use(new PluginC());  // 最内层

// 执行顺序：
// A.onNodeStart
//   B.onNodeStart
//     C.onNodeStart
//       [节点执行]
//     C.onNodeEnd
//   B.onNodeEnd
// A.onNodeEnd
```

对于 `intercept`（洋葱模型）：
```
A.intercept (before)
  B.intercept (before)
    C.intercept (before)
      [节点执行]
    C.intercept (after)
  B.intercept (after)
A.intercept (after)
```

## 最佳实践

### 1. 全局配置，局部覆盖
```typescript
// 创建全局 runtime
const runtime = new AgentRuntime()
  .use(new LoggerPlugin())
  .use(new RetryPlugin({ maxRetries: 3 }));

// 大部分节点使用全局配置
export const nodeA = runtime.node(_nodeA);
export const nodeB = runtime.node(_nodeB);

// 特殊节点禁用某些插件
export const nodeC = runtime.node(_nodeC, {
  disablePlugins: ["retry"],
});
```

### 2. 不同 Agent 使用不同配置
```typescript
// Travel Agent - 需要重试
const travelRuntime = new AgentRuntime()
  .use(new LoggerPlugin())
  .use(new RetryPlugin({ maxRetries: 3 }));

// Weather Agent - 不需要重试
const weatherRuntime = new AgentRuntime()
  .use(new LoggerPlugin())
  .use(new TimingPlugin());
```

### 3. 生产环境 vs 开发环境
```typescript
const isDev = process.env.NODE_ENV === "development";

const runtime = new AgentRuntime()
  .use(new LoggerPlugin({ 
    logState: isDev,    // 开发环境记录状态
    logResult: isDev,
  }))
  .use(new TimingPlugin({ 
    printTiming: isDev, // 开发环境打印耗时
  }));
```

## 对比旧的装饰器方式

### 旧方式（已废弃）
```typescript
// ❌ 嵌套地狱
export const node = withLogging(
  withRetry(
    withTiming(_node),
    3
  ),
  "my_node"
);
```

### 新方式（推荐）
```typescript
// ✅ 清晰简洁
const runtime = new AgentRuntime()
  .use(new LoggerPlugin())
  .use(new TimingPlugin())
  .use(new RetryPlugin({ maxRetries: 3 }));

export const node = runtime.node(_node, {
  displayName: "my_node",
});
```

## 总结

Agent Runtime 插件系统提供了：
- ✅ 清晰的声明式 API
- ✅ 全局复用，避免重复配置
- ✅ 灵活的节点级别控制
- ✅ 完整的生命周期钩子
- ✅ 易于扩展的插件机制
- ✅ 类型安全
