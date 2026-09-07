/**
 * Retry Plugin - 重试插件
 *
 * 当节点执行失败时自动重试
 */

import type { AgentPlugin, NodeContext } from "../runtime.js";

export interface RetryPluginOptions {
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试延迟（毫秒） */
  retryDelay?: number;
  /** 延迟策略：fixed（固定）| exponential（指数退避） */
  delayStrategy?: "fixed" | "exponential";
  /** 指数退避的基数 */
  backoffMultiplier?: number;
  /** 哪些错误需要重试（返回 true 表示重试） */
  shouldRetry?: (error: unknown) => boolean;
}

export class RetryPlugin<S = any> implements AgentPlugin<S> {
  name = "retry";

  private options: Required<Omit<RetryPluginOptions, "shouldRetry">> & {
    shouldRetry: (error: unknown) => boolean;
  };

  constructor(options: RetryPluginOptions = {}) {
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      delayStrategy: options.delayStrategy ?? "exponential",
      backoffMultiplier: options.backoffMultiplier ?? 2,
      shouldRetry:
        options.shouldRetry ??
        ((error: unknown) => {
          // 默认：网络错误和临时错误重试
          if (error instanceof Error) {
            const message = error.message.toLowerCase();
            return (
              message.includes("timeout") ||
              message.includes("network") ||
              message.includes("econnrefused") ||
              message.includes("429") || // Rate limit
              message.includes("503") // Service unavailable
            );
          }
          return false;
        }),
    };
  }

  intercept(
    ctx: NodeContext<S>,
    next: () => Promise<Partial<S>>,
  ): Promise<Partial<S>> {
    return this.executeWithRetry(ctx, next, 0);
  }

  private async executeWithRetry(
    ctx: NodeContext<S>,
    next: () => Promise<Partial<S>>,
    attempt: number,
  ): Promise<Partial<S>> {
    try {
      return await next();
    } catch (error) {
      const shouldRetry = this.options.shouldRetry(error);
      const canRetry = attempt < this.options.maxRetries;

      if (!shouldRetry || !canRetry) {
        // 不重试或已达最大重试次数
        if (attempt > 0) {
          console.error(`❌ ${ctx.nodeName} failed after ${attempt} retries`);
        }
        throw error;
      }

      // 计算延迟
      const delay = this.calculateDelay(attempt);

      console.warn(
        `🔄 ${ctx.nodeName} failed, retrying (${attempt + 1}/${this.options.maxRetries}) in ${delay}ms...`,
      );
      console.warn(
        `   Error: ${error instanceof Error ? error.message : String(error)}`,
      );

      // 等待后重试
      await this.sleep(delay);
      return this.executeWithRetry(ctx, next, attempt + 1);
    }
  }

  private calculateDelay(attempt: number): number {
    if (this.options.delayStrategy === "fixed") {
      return this.options.retryDelay;
    }

    // 指数退避: delay * (multiplier ^ attempt)
    return Math.min(
      this.options.retryDelay *
        Math.pow(this.options.backoffMultiplier, attempt),
      30000, // 最大 30 秒
    );
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
