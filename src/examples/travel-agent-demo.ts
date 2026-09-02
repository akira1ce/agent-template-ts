/**
 * Travel Agent Demo
 * 展示如何使用 Travel Agent
 */

import "dotenv/config";
import { travelAgent } from "@agents/travel/graph.js";

/**
 * 运行单轮示例（信息完整）
 */
async function runSingleTurn() {
  console.log("=".repeat(70));
  console.log("示例 1: 单轮对话（信息完整）");
  console.log("=".repeat(70));

  const userInput = "我明天去上海出差2天，主要是技术交流，需要带什么？";
  console.log(`\n👤 用户输入:\n${userInput}\n`);

  const result = await travelAgent.invoke({
    rawInput: userInput,
  });

  if (result.informationGap?.readyToContinue) {
    console.log("\n✅ 信息完整，已生成回复：\n");
    console.log(result.reply);
  } else {
    console.log("\n⚠️ 信息不完整，需要补充：\n");
    console.log(result.informationGap?.nextQuestion);
  }

  console.log("\n" + "-".repeat(70));
  console.log("调试信息：");
  console.log("- 意图:", JSON.stringify(result.intent, null, 2));
  console.log("- 信息:", JSON.stringify(result.information, null, 2));
  console.log("- 天气:", JSON.stringify(result.weather, null, 2));
}

/**
 * 运行多轮示例（信息补全）
 */
async function runMultiTurn() {
  console.log("\n" + "=".repeat(70));
  console.log("示例 2: 多轮对话（信息补全）");
  console.log("=".repeat(70));

  // 首轮 - 信息不完整
  const firstInput = "我要去北京出差";
  console.log(`\n👤 用户输入:\n${firstInput}\n`);

  const result1 = await travelAgent.invoke({
    rawInput: firstInput,
  });

  console.log(`\n🤖 Agent 回复:\n${result1.informationGap?.nextQuestion}\n`);

  console.log("-".repeat(70));
  console.log("调试信息（首轮）：");
  console.log("- 意图:", JSON.stringify(result1.intent, null, 2));
  console.log("- 已提取信息:", JSON.stringify(result1.information, null, 2));
  console.log("- 缺失信息:", result1.informationGap?.askUserFor);
  console.log("- 是否准备好:", result1.informationGap?.readyToContinue);

  // 补充轮 - 提供更多信息
  if (!result1.informationGap?.readyToContinue) {
    const supplementInput = "停留3天，主要是技术交流";
    console.log(`\n👤 用户补充:\n${supplementInput}\n`);

    // 注意：这里需要使用完整的状态 + 补充信息
    // 但由于我们的图入口点是 receive，这里简化演示：使用包含所有信息的新输入
    const fullInput = "我要去北京出差，停留3天，主要是技术交流";
    const result2 = await travelAgent.invoke({
      rawInput: fullInput,
    });

    if (result2.informationGap?.readyToContinue) {
      console.log("\n✅ 信息完整，已生成回复：\n");
      console.log(result2.reply);
    }

    console.log("\n" + "-".repeat(70));
    console.log("调试信息（补充轮）：");
    console.log("- 完整信息:", JSON.stringify(result2.information, null, 2));
    console.log("- 天气:", JSON.stringify(result2.weather, null, 2));
  }
}

/**
 * 展示 LangGraph 的流式输出（高级特性）
 */
async function runStreamingExample() {
  console.log("\n" + "=".repeat(70));
  console.log("示例 3: 流式输出（展示节点执行过程）");
  console.log("=".repeat(70));

  const userInput = "我明天去杭州出差1天，开会，需要准备什么？";
  console.log(`\n👤 用户输入:\n${userInput}\n`);

  console.log("执行流程：\n");

  // 使用 stream 方法观察每个节点的执行
  const stream = await travelAgent.stream({
    rawInput: userInput,
  });

  let finalResult: any;
  for await (const chunk of stream) {
    const nodeNames = Object.keys(chunk);
    for (const nodeName of nodeNames) {
      console.log(`✓ 节点 [${nodeName}] 执行完成`);
      finalResult = chunk[nodeName];
    }
  }

  console.log("\n最终结果：\n");
  console.log(finalResult.reply);
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
      console.error("  2. 在 .env 中填写你的 OpenAI API Key\n");
      process.exit(1);
    }

    console.log("\n🚀 Travel Agent Demo - 基于 LangChain.js & LangGraph.js\n");

    // 运行示例
    await runSingleTurn();
    await runMultiTurn();
    await runStreamingExample();

    console.log("\n" + "=".repeat(70));
    console.log("✅ Demo 运行完成");
    console.log("=".repeat(70));
    console.log("\n提示：");
    console.log("- 查看 src/agents/travel/ 了解 Agent 实现");
    console.log("- 查看 src/core/ 了解核心规范");
    console.log("- 查看 src/prompts/ 了解 Prompt 管理");
    console.log("- 参考此模式创建你自己的 Agent\n");
  } catch (error) {
    console.error("\n❌ 执行错误:", error);
    if (error instanceof Error) {
      console.error("详情:", error.message);
      if (error.stack) {
        console.error("\n堆栈:", error.stack);
      }
    }
    process.exit(1);
  }
}

// 运行
main();
