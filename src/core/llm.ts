/**
 * LLM Integration - 多模型 LLM 调用规范
 *
 * 核心价值：
 * 1. 支持多个 LLM 提供商（OpenAI、DeepSeek 等）
 * 2. 统一的配置管理
 * 3. 结构化输出支持（Zod Schema）
 * 4. 预定义的模型配置
 */

import { ChatOpenAI } from "@langchain/openai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { z } from "zod";

/**
 * LLM 提供商类型
 */
export type LLMProvider = "openai" | "deepseek";

/**
 * LLM 基础配置
 */
export interface LLMConfig {
  provider: LLMProvider;
  modelName: string;
  temperature: number;
  maxTokens?: number;
  apiKey?: string;
  baseURL?: string;
}

/**
 * 环境变量配置
 */
interface EnvConfig {
  openai: {
    apiKey?: string;
    baseURL?: string;
  };
  deepseek: {
    apiKey?: string;
    baseURL?: string;
  };
}

/**
 * 从环境变量读取配置
 */
function getEnvConfig(): EnvConfig {
  return {
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL,
    },
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    },
  };
}

/**
 * 创建 LLM 实例
 */
export function createLLM(config: LLMConfig): ChatOpenAI {
  const envConfig = getEnvConfig();

  // 获取 API Key 和 Base URL
  let apiKey: string;
  let baseURL: string | undefined;

  switch (config.provider) {
    case "openai":
      apiKey = config.apiKey || envConfig.openai.apiKey || "";
      baseURL = config.baseURL || envConfig.openai.baseURL;
      break;

    case "deepseek":
      apiKey = config.apiKey || envConfig.deepseek.apiKey || "";
      baseURL = config.baseURL || envConfig.deepseek.baseURL;
      break;

    default:
      throw new Error(`Unsupported LLM provider: ${config.provider}`);
  }

  if (!apiKey) {
    throw new Error(
      `API Key not found for provider: ${config.provider}. ` +
        `Please set ${config.provider.toUpperCase()}_API_KEY in environment variables.`,
    );
  }

  return new ChatOpenAI({
    modelName: config.modelName,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    openAIApiKey: apiKey,
    configuration: {
      baseURL: baseURL,
    },
  });
}

/**
 * LLM 配置预设
 */
export const LLMPresets = {
  /**
   * OpenAI GPT-4o
   */
  openai: (): LLMConfig => ({
    provider: "openai",
    modelName: "gpt-4o",
    temperature: 0.3,
    maxTokens: 4096,
  }),

  /**
   * OpenAI GPT-4o-mini (快速、便宜)
   */
  openai_mini: (): LLMConfig => ({
    provider: "openai",
    modelName: "gpt-4o-mini",
    temperature: 0.3,
    maxTokens: 2048,
  }),

  /**
   * DeepSeek Chat
   */
  deepseek: (): LLMConfig => ({
    provider: "deepseek",
    modelName: "deepseek-chat",
    temperature: 0.3,
    maxTokens: 4096,
  }),

  /**
   * DeepSeek Coder (代码生成专用)
   */
  deepseek_coder: (): LLMConfig => ({
    provider: "deepseek",
    modelName: "deepseek-coder",
    temperature: 0.0,
    maxTokens: 4096,
  }),
};

/**
 * 创建结构化输出的 Runnable Chain
 *
 * @param systemPrompt - 系统提示词
 * @param schema - Zod Schema
 * @param config - LLM 配置
 * @returns Runnable Chain
 *
 * @example
 * ```typescript
 * const chain = createStructuredChain(
 *   "你是意图识别助手",
 *   IntentSchema,
 *   LLMPresets.openai_balanced()
 * );
 * const result = await chain.invoke({ input: "用户输入" });
 * ```
 */
export function createStructuredChain<T extends z.ZodTypeAny>(
  systemPrompt: string,
  schema: T,
  config: LLMConfig,
) {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["human", "{input}"],
  ]);

  const llm = createLLM(config);
  const structuredLlm = llm.withStructuredOutput(schema, {
    name: "response",
  });

  return prompt.pipe(structuredLlm);
}

/**
 * 创建文本输出的 Runnable Chain
 *
 * @param systemPrompt - 系统提示词
 * @param config - LLM 配置
 * @returns Runnable Chain
 */
export function createTextChain(systemPrompt: string, config: LLMConfig) {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", systemPrompt],
    ["human", "{input}"],
  ]);

  const llm = createLLM(config);
  return prompt.pipe(llm);
}
