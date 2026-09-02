/**
 * Node Patterns - 节点模式规范
 *
 * 核心价值：
 * 1. 标准化的节点函数签名
 * 2. 可复用的节点装饰器
 * 3. 通用的节点工具函数
 */

import { RunnableConfig } from "@langchain/core/runnables";

/**
 * 标准节点函数类型
 * 所有节点都应该遵循这个签名
 */
export type NodeFunction<TState> = (
  state: TState,
  config?: RunnableConfig
) => Promise<Partial<TState>>;

/**
 * 节点元数据 - 用于文档和可观测性
 */
export interface NodeMetadata {
  id: string;
  label: string;
  actor: "输入" | "模型" | "工具" | "代码" | "输出";
  description?: string;
}

/**
 * 装饰器：为节点添加日志
 */
export function withLogging<TState>(
  func: NodeFunction<TState>,
  nodeName: string
): NodeFunction<TState> {
  return async (state: TState, config?: RunnableConfig) => {
    console.log(`\n[节点开始] ${nodeName}`);
    const startTime = Date.now();

    try {
      const result = await func(state, config);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[节点成功] ${nodeName} - 耗时: ${duration}s`);
      return result;
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[节点失败] ${nodeName} - 耗时: ${duration}s`);
      console.error(`错误详情:`, error);
      throw error;
    }
  };
}

/**
 * 装饰器：验证状态字段
 */
export function validateStateKeys<TState extends Record<string, any>>(
  requiredKeys: (keyof TState)[],
  nodeName: string
) {
  return (func: NodeFunction<TState>): NodeFunction<TState> => {
    return async (state: TState, config?: RunnableConfig) => {
      const missingKeys = requiredKeys.filter(
        (key) => state[key] === undefined || state[key] === null
      );

      if (missingKeys.length > 0) {
        throw new Error(
          `节点 ${nodeName} 缺少必需的状态键: ${missingKeys.join(", ")}`
        );
      }

      return func(state, config);
    };
  };
}

/**
 * 装饰器：添加重试机制
 */
export function withRetry<TState>(
  func: NodeFunction<TState>,
  maxRetries = 3,
  delay = 1000
): NodeFunction<TState> {
  return async (state: TState, config?: RunnableConfig) => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await func(state, config);
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          console.log(`[重试] ${attempt + 1}/${maxRetries}...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  };
}

/**
 * 工具函数：创建条件路由函数
 */
export function createRouter<TState>(
  conditionFunc: (state: TState) => string,
  nodeName?: string
): (state: TState) => string {
  return (state: TState) => {
    const result = conditionFunc(state);
    if (nodeName) {
      console.log(`[路由] ${nodeName} -> ${result}`);
    }
    return result;
  };
}

/**
 * 工具函数：安全获取状态值
 */
export function safeGet<T>(
  state: Record<string, any>,
  key: string,
  defaultValue?: T
): T | undefined {
  return state[key] ?? defaultValue;
}
