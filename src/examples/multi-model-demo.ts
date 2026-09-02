/**
 * Multi-Model Demo
 * 展示如何使用不同的 LLM 模型
 */

import "dotenv/config";
import { createStructuredChain, LLMPresets } from "@core/llm.js";
import { IntentSchema } from "@core/state.js";
import { z } from "zod";

/**
 * 示例 1：使用不同的模型
 */
async function exampleModels() {
  console.log("=".repeat(70));
  console.log("示例 1: 使用不同的模型");
  console.log("=".repeat(70));

  const userInput = "我明天去上海出差，需要带什么？";

  // OpenAI GPT-4o
  console.log("\n1. OpenAI GPT-4o:");
  try {
    const openaiChain = createStructuredChain(
      "你是意图识别助手",
      IntentSchema,
      LLMPresets.openai()
    );
    const openaiResult = await openaiChain.invoke({ input: userInput });
    console.log(JSON.stringify(openaiResult, null, 2));
  } catch (error: any) {
    console.log(`错误: ${error.message}`);
  }

  // DeepSeek Chat
  console.log("\n2. DeepSeek Chat:");
  try {
    const deepseekChain = createStructuredChain(
      "你是意图识别助手",
      IntentSchema,
      LLMPresets.deepseek()
    );
    const deepseekResult = await deepseekChain.invoke({ input: userInput });
    console.log(JSON.stringify(deepseekResult, null, 2));
  } catch (error: any) {
    console.log(`错误: ${error.message}`);
  }
}

/**
 * 示例 2：自定义配置（不同温度）
 */
async function exampleCustomConfig() {
  console.log("\n" + "=".repeat(70));
  console.log("示例 2: 自定义配置（调整温度）");
  console.log("=".repeat(70));

  const userInput = "什么是 DDD 领域驱动设计？";

  const AnswerSchema = z.object({
    answer: z.string(),
    keyPoints: z.array(z.string()),
  });

  // 低温度 - 更确定性
  console.log("\n1. DeepSeek (temperature=0.0, 更确定):");
  try {
    const chain1 = createStructuredChain(
      "你是技术概念讲解助手，简明扼要地解释概念",
      AnswerSchema,
      {
        provider: "deepseek",
        modelName: "deepseek-chat",
        temperature: 0.0,
        maxTokens: 2048,
      }
    );
    const result1 = await chain1.invoke({ input: userInput });
    console.log(`回答: ${result1.answer.substring(0, 100)}...`);
  } catch (error: any) {
    console.log(`错误: ${error.message}`);
  }

  // 高温度 - 更多样性
  console.log("\n2. DeepSeek (temperature=0.8, 更多样):");
  try {
    const chain2 = createStructuredChain(
      "你是技术概念讲解助手，简明扼要地解释概念",
      AnswerSchema,
      {
        provider: "deepseek",
        modelName: "deepseek-chat",
        temperature: 0.8,
        maxTokens: 2048,
      }
    );
    const result2 = await chain2.invoke({ input: userInput });
    console.log(`回答: ${result2.answer.substring(0, 100)}...`);
  } catch (error: any) {
    console.log(`错误: ${error.message}`);
  }
}

/**
 * 示例 3：DeepSeek Coder
 */
async function exampleCoder() {
  console.log("\n" + "=".repeat(70));
  console.log("示例 3: DeepSeek Coder (代码生成)");
  console.log("=".repeat(70));

  const userInput = "写一个 TypeScript 函数，计算斐波那契数列";

  const CodeSchema = z.object({
    language: z.string(),
    code: z.string(),
    explanation: z.string(),
  });

  try {
    const chain = createStructuredChain(
      "你是代码生成助手，生成简洁高效的代码",
      CodeSchema,
      LLMPresets.deepseek_coder()
    );

    const result = await chain.invoke({ input: userInput });
    console.log(`\n语言: ${result.language}`);
    console.log(`\n代码:\n${result.code}`);
    console.log(`\n说明: ${result.explanation}`);
  } catch (error: any) {
    console.log(`错误: ${error.message}`);
  }
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log("\n🚀 Multi-Model Demo - 多模型使用示例\n");

    // 检查环境变量
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    const hasDeepSeek = !!process.env.DEEPSEEK_API_KEY;

    console.log("环境变量检查:");
    console.log(`- OPENAI_API_KEY: ${hasOpenAI ? "✅" : "❌"}`);
    console.log(`- DEEPSEEK_API_KEY: ${hasDeepSeek ? "✅" : "❌"}`);

    if (!hasOpenAI && !hasDeepSeek) {
      console.error("\n❌ 错误：至少需要配置一个 API Key");
      console.error("提示：");
      console.error("  1. 复制 .env.example 为 .env");
      console.error("  2. 填写 OPENAI_API_KEY 或 DEEPSEEK_API_KEY\n");
      process.exit(1);
    }

    console.log();

    // 运行示例
    await exampleModels();

    if (hasDeepSeek) {
      await exampleCustomConfig();
      await exampleCoder();
    }

    console.log("\n" + "=".repeat(70));
    console.log("✅ Demo 运行完成");
    console.log("=".repeat(70));
    console.log("\n提示：");
    console.log("- 查看 src/core/llm.ts 了解 LLM 配置");
    console.log("- LLMPresets.openai() - OpenAI GPT-4o");
    console.log("- LLMPresets.openai_mini() - OpenAI GPT-4o-mini");
    console.log("- LLMPresets.deepseek() - DeepSeek Chat");
    console.log("- LLMPresets.deepseek_coder() - DeepSeek Coder\n");
  } catch (error) {
    console.error("\n❌ 执行错误:", error);
    if (error instanceof Error) {
      console.error("详情:", error.message);
    }
    process.exit(1);
  }
}

// 运行
main();
