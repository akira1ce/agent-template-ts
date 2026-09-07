/**
 * Timing Plugin - 性能计时插件
 *
 * 记录节点的执行耗时，并收集性能指标
 */

import type { AgentPlugin, NodeContext } from "../runtime.js";

export interface TimingPluginOptions {
  /** 慢查询阈值（毫秒），超过此时间会警告 */
  slowThreshold?: number;
  /** 是否在每个节点结束时打印耗时 */
  printTiming?: boolean;
}

export class TimingPlugin<S = any> implements AgentPlugin<S> {
  name = "timing";

  private options: Required<TimingPluginOptions>;
  private timings: Map<string, number[]> = new Map();

  constructor(options: TimingPluginOptions = {}) {
    this.options = {
      slowThreshold: options.slowThreshold ?? 5000, // 默认 5 秒
      printTiming: options.printTiming ?? false, // 默认不打印，由 LoggerPlugin 负责
    };
  }

  async onNodeEnd(ctx: NodeContext<S>, result: Partial<S>): Promise<void> {
    const duration = Date.now() - ctx.startTime;

    // 收集耗时数据
    if (!this.timings.has(ctx.nodeName)) {
      this.timings.set(ctx.nodeName, []);
    }
    this.timings.get(ctx.nodeName)!.push(duration);

    // 打印耗时
    if (this.options.printTiming) {
      console.log(`⏱️  ${ctx.nodeName}: ${duration}ms`);
    }

    // 慢查询警告
    if (duration > this.options.slowThreshold) {
      console.warn(
        `⚠️  Slow node detected: ${ctx.nodeName} took ${duration}ms (threshold: ${this.options.slowThreshold}ms)`,
      );
    }

    // 存储到上下文 metadata
    ctx.metadata.duration = duration;
  }

  /**
   * 获取节点的统计信息
   */
  getStats(nodeName: string): {
    count: number;
    total: number;
    avg: number;
    min: number;
    max: number;
  } | null {
    const timings = this.timings.get(nodeName);
    if (!timings || timings.length === 0) {
      return null;
    }

    const total = timings.reduce((sum, t) => sum + t, 0);
    const avg = total / timings.length;
    const min = Math.min(...timings);
    const max = Math.max(...timings);

    return {
      count: timings.length,
      total,
      avg: Math.round(avg),
      min,
      max,
    };
  }

  /**
   * 打印所有节点的统计信息
   */
  printStats(): void {
    console.log("\n=== Node Timing Statistics ===");
    for (const [nodeName, timings] of this.timings.entries()) {
      const stats = this.getStats(nodeName);
      if (stats) {
        console.log(
          `${nodeName}: avg=${stats.avg}ms, min=${stats.min}ms, max=${stats.max}ms, count=${stats.count}`,
        );
      }
    }
    console.log("==============================\n");
  }

  /**
   * 重置统计数据
   */
  reset(): void {
    this.timings.clear();
  }
}
