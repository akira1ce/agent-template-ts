/**
 * Travel Agent Nodes - 节点实现
 *
 * 遵循规范：
 * 1. 每个节点函数遵循标准签名
 * 2. 使用 LangChain 的 Runnable 机制
 * 3. 通过 createStructuredChain 调用 LLM
 * 4. 使用插件系统添加日志、计时、重试等功能
 *
 * DDD 原则：
 * - Prompt 从本领域的 prompts.ts 导入，而非全局 prompts
 */

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
import { AgentRuntime } from "@core/runtime.js";
import {
  LoggerPlugin,
  TimingPlugin,
  RetryPlugin,
} from "@core/plugins/index.js";
import dedent from "dedent";

/**
 * 创建 Travel Agent 的 Runtime
 * 配置全局插件：日志、计时、重试
 */
const runtime = new AgentRuntime<TravelState>()
  .use(new LoggerPlugin({ logState: false, logResult: false }))
  .use(new TimingPlugin({ slowThreshold: 3000 }))
  .use(new RetryPlugin({ maxRetries: 2, retryDelay: 1000 }));

/**
 * 接收节点 - 处理原始输入
 */
export const receiveNode = runtime.node(
  async (state, config?) => ({
    input: state.rawInput,
  }),
  { displayName: "receive" },
);

/**
 * 意图识别节点
 */
export const intentNode = runtime.node(
  async (state, config?) => {
    const chain = createStructuredChain(
      INTENT_PROMPT,
      IntentSchema,
      LLMPresets.deepseek(),
    );

    const userIntent = await chain.invoke({ input: state.input! }, config);

    return { userIntent };
  },
  { displayName: "identify_intent" },
);

/**
 * 信息抽取节点
 */
export const extractNode = runtime.node(
  async (state, config?) => {
    const chain = createStructuredChain(
      EXTRACT_PROMPT,
      TravelInformationSchema,
      LLMPresets.deepseek(),
    );

    const information = await chain.invoke({ input: state.input! }, config);

    return { information };
  },
  { displayName: "extract_info" },
);

/**
 * 信息澄清节点
 */
export const clarifyNode = runtime.node(
  async (state, config?) => {
    const chain = createStructuredChain(
      CLARIFY_PROMPT,
      InformationGapSchema,
      LLMPresets.deepseek(),
    );

    const contextInfo = dedent`
      用户意图：${JSON.stringify(state.userIntent, null, 2)}
      已提取信息：${JSON.stringify(state.information, null, 2)}
    `;

    const informationGap = await chain.invoke({ input: contextInfo }, config);

    return { informationGap };
  },
  { displayName: "check_gap" },
);

/**
 * 信息补全节点
 */
export const completeNode = runtime.node(
  async (state, config?) => {
    // 重新抽取补充信息
    const extractChain = createStructuredChain(
      EXTRACT_PROMPT,
      TravelInformationSchema,
      LLMPresets.deepseek(),
    );

    const newInfo = await extractChain.invoke(
      { input: state.latestUserSupplement! },
      config,
    );

    // 合并信息
    const mergedInfo = {
      destination:
        newInfo.destination || state.information?.destination || null,
      duration: newInfo.duration || state.information?.duration || null,
      purpose: newInfo.purpose || state.information?.purpose || null,
      startDate: newInfo.startDate || state.information?.startDate || null,
    };

    // 重新判断信息缺口
    const clarifyChain = createStructuredChain(
      CLARIFY_PROMPT,
      InformationGapSchema,
      LLMPresets.deepseek(),
    );

    const contextInfo = dedent`
      用户意图：${JSON.stringify(state.userIntent, null, 2)}
      已提取信息：${JSON.stringify(mergedInfo, null, 2)}
    `;

    const informationGap = await clarifyChain.invoke(
      { input: contextInfo },
      config,
    );

    return {
      information: mergedInfo,
      informationGap,
      input: state.latestUserSupplement,
    };
  },
  { displayName: "complete_info" },
);

/**
 * 计划生成节点
 */
export const planNode = runtime.node(
  async (state, config?) => {
    const chain = createStructuredChain(
      PLAN_PROMPT,
      PlanSchema,
      LLMPresets.deepseek(),
    );

    const contextInfo = dedent`
      用户意图：${JSON.stringify(state.userIntent, null, 2)}
      完整信息：${JSON.stringify(state.information, null, 2)}
    `;

    const plan = await chain.invoke({ input: contextInfo }, config);

    return { plan };
  },
  { displayName: "make_plan" },
);

/**
 * 天气查询节点
 */
export const weatherNode = runtime.node(
  async (state, config?) => {
    if (!state.information?.destination) {
      throw new Error("Destination is required for weather node");
    }

    const weather = await queryWeather(state.information.destination);

    return { weather };
  },
  {
    displayName: "query_weather",
    disablePlugins: ["retry"], // 天气查询不重试
  },
);

/**
 * 结果生成节点
 * 支持流式输出
 */
export const generateNode = runtime.node(
  async (state, config?) => {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", GENERATE_PROMPT],
      ["human", "{input}"],
    ]);

    const llm = createLLM(LLMPresets.deepseek());
    const chain = prompt.pipe(llm);

    const contextInfo = dedent`
      用户需求：${JSON.stringify(state.userIntent, null, 2)}
      收集信息：${JSON.stringify(state.information, null, 2)}
      ${state.weather ? `天气情况：${JSON.stringify(state.weather, null, 2)}` : ""}
    `;

    // 使用 stream 来支持流式输出
    const stream = await chain.stream({ input: contextInfo }, config);
    let generatedReply = "";

    for await (const chunk of stream) {
      const token = chunk.content as string;
      generatedReply += token;
    }

    return { generatedReply };
  },
  { displayName: "generate_reply" },
);

/**
 * 结果验证节点
 */
export const validateNode = runtime.node(
  async (state, config?) => {
    const chain = createStructuredChain(
      VALIDATE_PROMPT,
      ValidationSchema,
      LLMPresets.deepseek(),
    );

    const contextInfo = dedent`
      生成的回复：
      ${state.generatedReply}

      用户原始需求：
      ${JSON.stringify(state.userIntent, null, 2)}
    `;

    const validation = await chain.invoke({ input: contextInfo }, config);

    return { validation };
  },
  { displayName: "validate_reply" },
);

/**
 * 回复节点
 */
export const replyNode = runtime.node(
  async (state, config?) => {
    // 简单处理：直接返回生成的回复
    // 如果验证失败，可以在这里添加重新生成的逻辑
    return {
      reply: state.generatedReply,
    };
  },
  { displayName: "send_reply" },
);
