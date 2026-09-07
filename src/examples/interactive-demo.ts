/**
 * Interactive Travel Agent Demo
 * 交互式旅行助手 - 支持实时输入和流式输出
 *
 * 特性：
 * 1. 命令行交互式输入
 * 2. 流式输出（逐字显示）
 * 3. 多轮对话支持
 * 4. 状态持久化
 */

import "dotenv/config";
import * as readline from "readline";
import { travelAgent } from "@agents/travel/graph.js";
import type { TravelState } from "@agents/travel/state.js";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import { RunnableConfig } from "@langchain/core/runnables";

/**
 * 流式输出回调处理器
 * 实现逐 token 输出
 */
class StreamingCallbackHandler extends BaseCallbackHandler {
  name = "StreamingCallbackHandler";

  // 当 LLM 生成新 token 时调用
  async handleLLMNewToken(token: string) {
    process.stdout.write(token);
  }
}

/**
 * 交互式对话管理器
 */
class InteractiveChat {
  private rl: readline.Interface;
  private currentState: Partial<TravelState> | null = null;
  private conversationHistory: Array<{ role: string; content: string }> = [];

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  /**
   * 打印欢迎信息
   */
  private printWelcome() {
    console.log("\n" + "=".repeat(70));
    console.log("🌏 智能旅行助手 - 交互式对话");
    console.log("=".repeat(70));
    console.log("\n💡 使用说明：");
    console.log("  - 输入您的旅行需求，我会帮您规划");
    console.log("  - 可以分多次补充信息");
    console.log("  - 输入 'exit' 或 'quit' 退出");
    console.log("  - 输入 'reset' 重置对话\n");
    console.log("-".repeat(70) + "\n");
  }

  /**
   * 提示用户输入
   */
  private async prompt(message: string): Promise<string> {
    return new Promise((resolve) => {
      this.rl.question(message, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  /**
   * 处理用户输入
   */
  private async handleInput(userInput: string): Promise<boolean> {
    // 检查退出命令
    if (userInput.toLowerCase() === "exit" || userInput.toLowerCase() === "quit") {
      console.log("\n👋 再见！祝您旅途愉快！\n");
      return false;
    }

    // 检查重置命令
    if (userInput.toLowerCase() === "reset") {
      this.currentState = null;
      this.conversationHistory = [];
      console.log("\n🔄 对话已重置\n");
      return true;
    }

    // 如果输入为空，跳过
    if (!userInput) {
      return true;
    }

    // 记录用户输入
    this.conversationHistory.push({ role: "user", content: userInput });

    try {
      // 准备输入状态
      let inputState: Partial<TravelState>;

      if (this.currentState && !this.currentState.informationGap?.readyToContinue) {
        // 补充轮：设置 latestUserSupplement
        inputState = {
          ...this.currentState,
          rawInput: userInput,
          latestUserSupplement: userInput,
        };
      } else {
        // 首轮或重新开始
        inputState = {
          rawInput: userInput,
        };
      }

      // 创建流式回调处理器
      const streamingHandler = new StreamingCallbackHandler();
      const config: RunnableConfig = {
        callbacks: [streamingHandler],
      };

      console.log("\n🤖 助手: ");

      // 调用 agent（支持流式输出）
      const result = await travelAgent.invoke(inputState, config);

      // 流式输出完成后换行
      console.log("\n");

      // 判断是否需要继续询问
      if (!result.informationGap?.readyToContinue) {
        // 信息不完整，显示需要补充的信息
        if (result.informationGap?.nextQuestion) {
          console.log(`💬 ${result.informationGap.nextQuestion}\n`);
        }
        if (result.informationGap?.askUserFor && result.informationGap.askUserFor.length > 0) {
          console.log(`📋 缺失信息: ${result.informationGap.askUserFor.join(", ")}\n`);
        }
      } else {
        // 信息完整，显示最终规划
        if (result.reply) {
          this.conversationHistory.push({ role: "assistant", content: result.reply });
        }

        // 显示收集到的完整信息
        console.log("\n" + "-".repeat(70));
        console.log("📊 收集到的信息:");
        console.log(`   目的地: ${result.information?.destination || "未知"}`);
        console.log(`   出发时间: ${result.information?.startDate || "未知"}`);
        console.log(`   停留时长: ${result.information?.duration || "未知"}`);
        console.log(`   出行目的: ${result.information?.purpose || "未知"}`);
        if (result.weather) {
          console.log(`   天气情况: ${result.weather.temperature}°C, ${result.weather.description}`);
        }
        console.log("-".repeat(70) + "\n");
      }

      // 更新状态（用于下一轮对话）
      this.currentState = result;

    } catch (error) {
      console.error("\n\n❌ 处理出错:", error instanceof Error ? error.message : error);
      console.log("\n💡 提示: 请重试或输入 'reset' 重置对话\n");
    }

    return true;
  }

  /**
   * 启动交互式对话
   */
  async start() {
    this.printWelcome();

    let running = true;
    while (running) {
      const userInput = await this.prompt("👤 您: ");
      running = await this.handleInput(userInput);
    }

    this.rl.close();
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    // 检查环境变量
    if (!process.env.OPENAI_API_KEY) {
      console.error("\n❌ 错误：请设置 OPENAI_API_KEY 环境变量");
      console.error("提示：");
      console.error("  1. 复制 .env.example 为 .env");
      console.error("  2. 在 .env 中填写你的 API Key\n");
      process.exit(1);
    }

    // 启动交互式对话
    const chat = new InteractiveChat();
    await chat.start();

  } catch (error) {
    console.error("\n❌ 启动失败:", error);
    if (error instanceof Error && error.stack) {
      console.error("堆栈:", error.stack);
    }
    process.exit(1);
  }
}

// 处理 Ctrl+C 优雅退出
process.on("SIGINT", () => {
  console.log("\n\n👋 收到中断信号，正在退出...\n");
  process.exit(0);
});

// 运行
main();
