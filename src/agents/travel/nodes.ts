/**
 * Travel Agent Nodes - 节点实现
 *
 * 遵循规范：
 * 1. 每个节点函数遵循标准签名
 * 2. 使用 LangChain 的 Runnable 机制
 * 3. 通过 createStructuredChain 调用 LLM
 * 4. 使用装饰器添加日志和验证
 *
 * DDD 原则：
 * - Prompt 从本领域的 prompts.ts 导入，而非全局 prompts
 */

import type { RunnableConfig } from "@langchain/core/runnables";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { TravelState } from "./state.js";
import {
  TravelInformationSchema,
  PlanSchema,
  ValidationSchema,
} from "./state.js";
import { IntentSchema, InformationGapSchema } from "@core/state.js";
import { createStructuredChain, createLLM, LLMPresets } from "@core/llm.js";
import {
  INTENT_PROMPT,
  EXTRACT_PROMPT,
  CLARIFY_PROMPT,
  PLAN_PROMPT,
  GENERATE_PROMPT,
  VALIDATE_PROMPT,
} from "./prompts.js";
import { queryWeather } from "@tools/weather.js";
import { withLogging } from "@core/nodes.js";

/**
 * 接收节点 - 处理原始输入
 */
async function _receiveNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  return {
    input: state.rawInput,
  };
}

export const receiveNode = withLogging(_receiveNode, "receive");

/**
 * 意图识别节点
 */
async function _intentNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  const chain = createStructuredChain(
    INTENT_PROMPT,
    IntentSchema,
    LLMPresets.deepseek()
  );

  const userIntent = await chain.invoke({ input: state.input! }, config);

  return { userIntent };
}

export const intentNode = withLogging(_intentNode, "identify_intent");

/**
 * 信息抽取节点
 */
async function _extractNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  const chain = createStructuredChain(
    EXTRACT_PROMPT,
    TravelInformationSchema,
    LLMPresets.deepseek()
  );

  const information = await chain.invoke({ input: state.input! }, config);

  return { information };
}

export const extractNode = withLogging(_extractNode, "extract_info");

/**
 * 信息澄清节点
 */
async function _clarifyNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  const chain = createStructuredChain(
    CLARIFY_PROMPT,
    InformationGapSchema,
    LLMPresets.deepseek()
  );

  const contextInfo = `
用户意图：${JSON.stringify(state.userIntent, null, 2)}
已提取信息：${JSON.stringify(state.information, null, 2)}
  `.trim();

  const informationGap = await chain.invoke({ input: contextInfo }, config);

  return { informationGap };
}

export const clarifyNode = withLogging(_clarifyNode, "check_gap");

/**
 * 信息补全节点
 */
async function _completeNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  // 重新抽取补充信息
  const extractChain = createStructuredChain(
    EXTRACT_PROMPT,
    TravelInformationSchema,
    LLMPresets.deepseek()
  );

  const newInfo = await extractChain.invoke(
    { input: state.latestUserSupplement! },
    config
  );

  // 合并信息
  const mergedInfo = {
    destination: newInfo.destination || state.information?.destination || null,
    duration: newInfo.duration || state.information?.duration || null,
    purpose: newInfo.purpose || state.information?.purpose || null,
    startDate: newInfo.startDate || state.information?.startDate || null,
  };

  // 重新判断信息缺口
  const clarifyChain = createStructuredChain(
    CLARIFY_PROMPT,
    InformationGapSchema,
    LLMPresets.deepseek()
  );

  const contextInfo = `
用户意图：${JSON.stringify(state.userIntent, null, 2)}
已提取信息：${JSON.stringify(mergedInfo, null, 2)}
  `.trim();

  const informationGap = await clarifyChain.invoke({ input: contextInfo }, config);

  return {
    information: mergedInfo,
    informationGap,
    input: state.latestUserSupplement,
  };
}

export const completeNode = withLogging(_completeNode, "complete_info");

/**
 * 计划生成节点
 */
async function _planNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  const chain = createStructuredChain(
    PLAN_PROMPT,
    PlanSchema,
    LLMPresets.deepseek()
  );

  const contextInfo = `
用户意图：${JSON.stringify(state.userIntent, null, 2)}
完整信息：${JSON.stringify(state.information, null, 2)}
  `.trim();

  const plan = await chain.invoke({ input: contextInfo }, config);

  return { plan };
}

export const planNode = withLogging(_planNode, "make_plan");

/**
 * 天气查询节点
 */
async function _weatherNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  if (!state.information?.destination) {
    throw new Error("Destination is required for weather node");
  }

  const weather = await queryWeather(state.information.destination);

  return { weather };
}

export const weatherNode = withLogging(_weatherNode, "query_weather");

/**
 * 结果生成节点
 */
async function _generateNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  const prompt = ChatPromptTemplate.fromMessages([
    ["system", GENERATE_PROMPT],
    ["human", "{input}"],
  ]);

  const llm = createLLM(LLMPresets.deepseek());
  const chain = prompt.pipe(llm);

  const contextInfo = `
用户需求：${JSON.stringify(state.userIntent, null, 2)}
收集信息：${JSON.stringify(state.information, null, 2)}
${state.weather ? `天气情况：${JSON.stringify(state.weather, null, 2)}` : ""}
  `.trim();

  const result = await chain.invoke({ input: contextInfo }, config);
  const generatedReply = result.content as string;

  return { generatedReply };
}

export const generateNode = withLogging(_generateNode, "generate_reply");

/**
 * 结果验证节点
 */
async function _validateNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  const chain = createStructuredChain(
    VALIDATE_PROMPT,
    ValidationSchema,
    LLMPresets.deepseek()
  );

  const contextInfo = `
生成的回复：
${state.generatedReply}

用户原始需求：${JSON.stringify(state.userIntent, null, 2)}
  `.trim();

  const validation = await chain.invoke({ input: contextInfo }, config);

  return { validation };
}

export const validateNode = withLogging(_validateNode, "validate_reply");

/**
 * 回复节点
 */
async function _replyNode(
  state: TravelState,
  config?: RunnableConfig
): Promise<Partial<TravelState>> {
  // 简单处理：直接返回生成的回复
  // 如果验证失败，可以在这里添加重新生成的逻辑
  return {
    reply: state.generatedReply,
  };
}

export const replyNode = withLogging(_replyNode, "send_reply");

/**
 * 条件判断：是否继续执行
 */
export function shouldContinue(state: TravelState): string {
  if (state.informationGap?.readyToContinue) {
    return "plan";
  }
  return "wait";
}
