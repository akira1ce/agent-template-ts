/**
 * Logger Plugin - 日志插件
 *
 * 记录节点的执行情况：
 * - 节点开始/结束
 * - 执行耗时
 * - 错误信息
 */

import type { AgentPlugin, NodeContext } from "../runtime.js";

export interface LoggerPluginOptions {
  /** 是否记录状态详情 */
  logState?: boolean;
  /** 是否记录结果详情 */
  logResult?: boolean;
  /** 日志级别 */
  level?: "debug" | "info" | "warn" | "error";
}

export class LoggerPlugin<S = any> implements AgentPlugin<S> {
  name = "logger";

  private options: Required<LoggerPluginOptions>;

  constructor(options: LoggerPluginOptions = {}) {
    this.options = {
      logState: options.logState ?? false,
      logResult: options.logResult ?? false,
      level: options.level ?? "info",
    };
  }

  async onNodeStart(ctx: NodeContext<S>): Promise<void> {
    console.log(`[Node Start] ${ctx.nodeName}`);

    if (this.options.logState) {
      console.log(`  State:`, JSON.stringify(ctx.state, null, 2));
    }
  }

  async onNodeEnd(ctx: NodeContext<S>, result: Partial<S>): Promise<void> {
    const duration = Date.now() - ctx.startTime;
    console.log(`[Node End] ${ctx.nodeName} (${duration}ms)`);

    if (this.options.logResult) {
      console.log(`  Result:`, JSON.stringify(result, null, 2));
    }
  }

  async onNodeError(ctx: NodeContext<S>, error: unknown): Promise<void> {
    const duration = Date.now() - ctx.startTime;
    console.error(`[Node Error] ${ctx.nodeName} (${duration}ms)`);
    console.error(`  Error:`, error);
  }
}
