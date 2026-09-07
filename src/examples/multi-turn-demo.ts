/**
 * Multi-Turn Conversation Demo
 * 展示如何处理多轮对话和信息补全
 *
 * 核心要点：
 * 1. 状态持久化 - 保持对话上下文
 * 2. 增量信息提取 - 合并新旧信息
 * 3. 信息完整性判断 - 决定是否继续
 */

import "dotenv/config";
import { travelAgent } from "@agents/travel/graph.js";
import type { TravelState } from "@agents/travel/state.js";

/**
 * 模拟多轮对话场景
 */
async function runMultiTurnConversation() {
  console.log("=".repeat(70));
  console.log("多轮对话示例 - 信息逐步补全");
  console.log("=".repeat(70));

  // 保存状态，用于下一轮对话
  let currentState: Partial<TravelState> | null = null;

  // 第一轮：用户只提供部分信息
  console.log("\n【第 1 轮对话】");
  console.log("-".repeat(70));

  const turn1Input = "我想去北京";
  console.log(`👤 用户: ${turn1Input}\n`);

  const result1 = await travelAgent.invoke({
    rawInput: turn1Input,
  });

  console.log(`🤖 Agent: ${result1.informationGap?.nextQuestion}\n`);
  console.log("📊 状态快照:");
  console.log(`   - 意图: ${result1.userIntent?.intent}`);
  console.log(`   - 已知信息: ${JSON.stringify(result1.information)}`);
  console.log(`   - 缺失字段: ${result1.informationGap?.askUserFor?.join(", ")}`);
  console.log(`   - 准备继续: ${result1.informationGap?.readyToContinue}`);

  // 保存状态
  currentState = result1;

  // 第二轮：用户补充时间信息
  if (!result1.informationGap?.readyToContinue) {
    console.log("\n【第 2 轮对话】");
    console.log("-".repeat(70));

    const turn2Input = "明天出发";
    console.log(`👤 用户: ${turn2Input}\n`);

    // 合并新输入到现有状态
    const result2 = await travelAgent.invoke({
      ...currentState,
      rawInput: turn2Input,
    });

    console.log(`🤖 Agent: ${result2.informationGap?.nextQuestion || result2.reply}\n`);
    console.log("📊 状态快照:");
    console.log(`   - 已知信息: ${JSON.stringify(result2.information)}`);
    console.log(`   - 缺失字段: ${result2.informationGap?.askUserFor?.join(", ")}`);
    console.log(`   - 准备继续: ${result2.informationGap?.readyToContinue}`);

    currentState = result2;

    // 第三轮：用户补充停留时长和目的
    if (!result2.informationGap?.readyToContinue) {
      console.log("\n【第 3 轮对话】");
      console.log("-".repeat(70));

      const turn3Input = "停留3天，去开会";
      console.log(`👤 用户: ${turn3Input}\n`);

      const result3 = await travelAgent.invoke({
        ...currentState,
        rawInput: turn3Input,
      });

      if (result3.informationGap?.readyToContinue) {
        console.log(`🤖 Agent: \n${result3.reply}\n`);
        console.log("📊 最终状态:");
        console.log(`   - 完整信息: ${JSON.stringify(result3.information, null, 2)}`);
        console.log(`   - 天气数据: ${JSON.stringify(result3.weather, null, 2)}`);
      } else {
        console.log(`🤖 Agent: ${result3.informationGap?.nextQuestion}\n`);
      }
    }
  }
}

/**
 * 演示中断恢复场景
 */
async function runInterruptAndResume() {
  console.log("\n\n" + "=".repeat(70));
  console.log("中断恢复示例 - 用户中途切换话题");
  console.log("=".repeat(70));

  // 开始一个对话
  console.log("\n【初始对话】");
  console.log("-".repeat(70));

  const initialInput = "我要去上海出差";
  console.log(`👤 用户: ${initialInput}\n`);

  const result1 = await travelAgent.invoke({
    rawInput: initialInput,
  });

  console.log(`🤖 Agent: ${result1.informationGap?.nextQuestion}\n`);

  // 用户没有回答，而是重新开始一个新话题
  console.log("\n【用户重新开始】");
  console.log("-".repeat(70));

  const newInput = "我明天去杭州出差2天开会，需要准备什么？";
  console.log(`👤 用户: ${newInput}\n`);

  // 注意：这里重新开始，不传递之前的状态
  const result2 = await travelAgent.invoke({
    rawInput: newInput,
  });

  if (result2.informationGap?.readyToContinue) {
    console.log(`🤖 Agent: \n${result2.reply}\n`);
    console.log("💡 说明: 信息完整，直接生成回复，之前的上海出差话题被放弃");
  }
}

/**
 * 演示信息修正场景
 */
async function runInformationCorrection() {
  console.log("\n\n" + "=".repeat(70));
  console.log("信息修正示例 - 用户更正之前的信息");
  console.log("=".repeat(70));

  let currentState: Partial<TravelState> | null = null;

  // 第一轮
  console.log("\n【第 1 轮】");
  console.log("-".repeat(70));

  const turn1Input = "我明天去北京出差3天";
  console.log(`👤 用户: ${turn1Input}\n`);

  const result1 = await travelAgent.invoke({
    rawInput: turn1Input,
  });

  console.log(`🤖 Agent: ${result1.informationGap?.nextQuestion}\n`);
  console.log(`📊 提取信息: ${JSON.stringify(result1.information)}`);

  currentState = result1;

  // 第二轮：用户发现错误，修正信息
  console.log("\n【第 2 轮 - 修正】");
  console.log("-".repeat(70));

  const turn2Input = "不对，是后天去，停留2天";
  console.log(`👤 用户: ${turn2Input}\n`);

  const result2 = await travelAgent.invoke({
    ...currentState,
    rawInput: turn2Input,
  });

  console.log(`🤖 Agent: ${result2.informationGap?.nextQuestion || result2.reply}\n`);
  console.log(`📊 更新后信息: ${JSON.stringify(result2.information)}`);
  console.log(`💡 说明: 新提取的信息会覆盖旧信息（日期从"明天"改为"后天"，时长从3天改为2天）`);
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

    console.log("\n🚀 Multi-Turn Conversation Demo\n");
    console.log("💡 本示例展示如何处理多轮对话中的信息补全");
    console.log("💡 关键技术：状态持久化、增量提取、信息合并\n");

    // 运行各种场景
    await runMultiTurnConversation();
    await runInterruptAndResume();
    await runInformationCorrection();

    console.log("\n\n" + "=".repeat(70));
    console.log("✅ Demo 运行完成");
    console.log("=".repeat(70));
    console.log("\n📚 技术要点总结：");
    console.log("  1. 状态传递: 将上一轮的结果作为下一轮的输入");
    console.log("  2. 信息合并: extract 节点会合并 rawInput 和已有 information");
    console.log("  3. 重新开始: 不传递旧状态即可开启新对话");
    console.log("  4. 信息修正: 新提取的非 null 值会覆盖旧值");
    console.log("\n💡 实际应用：");
    console.log("  - Web应用: 将状态存储在 session/数据库");
    console.log("  - 聊天机器人: 维护用户对话上下文");
    console.log("  - CLI工具: 在内存中保持状态直到任务完成\n");

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
