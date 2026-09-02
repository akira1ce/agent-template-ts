/**
 * Graph Patterns - 图编排模式规范
 *
 * 核心价值：
 * 1. 提供常见的路由模式
 * 2. 图构建的最佳实践
 */

import { END } from "@langchain/langgraph";
import type { RunnableConfig } from "@langchain/core/runnables";

/**
 * 通用的条件路由：判断是否继续执行
 *
 * 用于多轮对话场景，根据 informationGap 判断是否需要暂停等待用户输入
 */
export function createContinueRouter<
  TState extends { informationGap?: { readyToContinue?: boolean } }
>(continueNode: string, waitNode: string = END) {
  return (state: TState): typeof continueNode | typeof waitNode => {
    if (state.informationGap?.readyToContinue) {
      return continueNode;
    }
    return waitNode;
  };
}

/**
 * 图配置：启用 LangSmith 追踪
 */
export function createTracingConfig(
  metadata?: Record<string, any>
): RunnableConfig {
  return {
    metadata: {
      ...metadata,
    },
    tags: metadata?.tags || [],
  };
}

/**
 * END 节点的别名，用于可读性
 */
export const WAIT = END;

/**
 * 导出 LangGraph 常用类型
 */
export { END };
export type { RunnableConfig };
