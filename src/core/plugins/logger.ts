/**
 * Logger Plugin - 日志插件
 *
 * 记录节点的执行情况：
 * - 节点开始/结束
 * - 执行耗时
 * - 错误信息
 * - 性能统计
 */

import type { AgentPlugin, NodeContext } from "../runtime.js";

export interface LoggerPluginOptions {
  /** 是否记录状态详情 */
  logState?: boolean;
  /** 是否记录结果详情 */
  logResult?: boolean;
  /** 日志级别 */
  level?: "debug" | "info" | "warn" | "error";
  /** 是否启用简洁模式（只显示完成信息） */
  compact?: boolean;
  /** 节点名称列宽（用于对齐） */
  nodeNameWidth?: number;
}

export class LoggerPlugin<S = any> implements AgentPlugin<S> {
  name = "logger";

  private options: Required<LoggerPluginOptions>;

  constructor(options: LoggerPluginOptions = {}) {
    this.options = {
      logState: options.logState ?? false,
      logResult: options.logResult ?? false,
      level: options.level ?? "info",
      compact: options.compact ?? true,
      nodeNameWidth: options.nodeNameWidth ?? 20,
    };
  }

  async onNodeStart(ctx: NodeContext<S>): Promise<void> {
    // 简洁模式下不显示开始信息
    if (this.options.compact) {
      return;
    }

    console.log(`⚡ ${ctx.nodeName}`);

    if (this.options.logState) {
      console.log(`   State:`, JSON.stringify(ctx.state, null, 2));
    }
  }

  async onNodeEnd(ctx: NodeContext<S>, result: Partial<S>): Promise<void> {
    const duration = Date.now() - ctx.startTime;

    // 格式化时长显示
    const timeStr = this.formatDuration(duration);

    // 根据耗时选择图标
    const icon = this.getIcon(duration);

    // 对齐节点名称
    const name = ctx.nodeName.padEnd(this.options.nodeNameWidth);

    console.log(`${icon} ${name} ${timeStr}`);

    if (this.options.logResult) {
      console.log(`   Result:`, JSON.stringify(result, null, 2));
    }
  }

  async onNodeError(ctx: NodeContext<S>, error: unknown): Promise<void> {
    const duration = Date.now() - ctx.startTime;

    const timeStr = this.formatDuration(duration);
    const name = ctx.nodeName.padEnd(this.options.nodeNameWidth);

    console.error(`❌ ${name} ${timeStr}`);
    console.error(`   Error:`, error);
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${ms}ms`;
    }
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private getIcon(duration: number): string {
    if (duration < 100) return "⚡";
    if (duration < 1000) return "👌";
    if (duration < 5000) return "🐢";
    return "🔥";
  }
}
