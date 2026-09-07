/**
 * Agent Runtime - 插件系统
 *
 * 提供统一的节点增强机制，支持：
 * 1. 全局插件配置，所有节点共享
 * 2. 完整的生命周期钩子
 * 3. 洋葱模型拦截器
 * 4. 节点级别的插件控制
 */

import type { RunnableConfig } from "@langchain/core/runnables";

/**
 * 节点上下文
 */
export interface NodeContext<S = any> {
  /** 节点名称 */
  nodeName: string;
  /** 当前状态 */
  state: S;
  /** 运行配置 */
  config?: RunnableConfig;
  /** 开始时间戳 */
  startTime: number;
  /** 扩展数据，插件可以存储自定义信息 */
  metadata: Record<string, any>;
}

/**
 * 节点处理器函数签名
 */
export type NodeHandler<S> = (
  state: S,
  config?: RunnableConfig,
) => Promise<Partial<S>>;

/**
 * Agent 插件接口
 */
export interface AgentPlugin<S = any> {
  /** 插件名称，用于标识和禁用 */
  name: string;

  /** 初始化钩子 - runtime 创建时调用 */
  onInit?(runtime: AgentRuntime<S>): void;

  /** 节点开始前钩子 */
  onNodeStart?(ctx: NodeContext<S>): Promise<void>;

  /** 节点结束后钩子 */
  onNodeEnd?(ctx: NodeContext<S>, result: Partial<S>): Promise<void>;

  /** 节点错误钩子 */
  onNodeError?(ctx: NodeContext<S>, error: unknown): Promise<void>;

  /**
   * 拦截器 - 洋葱模型
   * 可以在 next() 前后执行逻辑
   */
  intercept?(
    ctx: NodeContext<S>,
    next: () => Promise<Partial<S>>,
  ): Promise<Partial<S>>;
}

/**
 * 节点配置选项
 */
export interface NodeOptions {
  /** 禁用的插件名称列表 */
  disablePlugins?: string[];
  /** 节点显示名称（用于日志） */
  displayName?: string;
}

/**
 * Agent Runtime - 插件运行时
 */
export class AgentRuntime<S = any> {
  private plugins: AgentPlugin<S>[] = [];

  /**
   * 注册插件
   */
  use(plugin: AgentPlugin<S>): this {
    this.plugins.push(plugin);
    plugin.onInit?.(this);
    return this;
  }

  /**
   * 增强节点处理器
   * @param handler 原始节点处理函数
   * @param options 节点配置选项
   * @returns 增强后的节点处理函数
   */
  node(handler: NodeHandler<S>, options?: NodeOptions): NodeHandler<S> {
    // 过滤掉被禁用的插件
    const activePlugins = options?.disablePlugins
      ? this.plugins.filter((p) => !options.disablePlugins!.includes(p.name))
      : this.plugins;

    return async (state: S, config?: RunnableConfig): Promise<Partial<S>> => {
      const ctx: NodeContext<S> = {
        nodeName: options?.displayName || handler.name || "anonymous",
        state,
        config,
        startTime: Date.now(),
        metadata: {},
      };

      try {
        // 1. 触发 onNodeStart 钩子
        await Promise.all(activePlugins.map((p) => p.onNodeStart?.(ctx)));

        // 2. 构建洋葱模型拦截链
        // 从右到左包裹，最后注册的插件在最内层
        const interceptChain = activePlugins
          .filter((p) => p.intercept)
          .reduceRight(
            (next, plugin) => () => plugin.intercept!(ctx, next),
            () => handler(state, config),
          );

        // 3. 执行拦截链
        const result = await interceptChain();

        // 4. 触发 onNodeEnd 钩子
        await Promise.all(activePlugins.map((p) => p.onNodeEnd?.(ctx, result)));

        return result;
      } catch (error) {
        // 5. 触发 onNodeError 钩子
        await Promise.all(
          activePlugins.map((p) => p.onNodeError?.(ctx, error)),
        );
        throw error;
      }
    };
  }

  /**
   * 获取已注册的插件列表
   */
  getPlugins(): ReadonlyArray<AgentPlugin<S>> {
    return this.plugins;
  }
}
