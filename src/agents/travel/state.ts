/**
 * Travel Agent State - 状态定义
 *
 * 遵循规范：
 * 1. 继承 BaseAgentState
 * 2. 使用 Annotation.Root 定义状态
 * 3. 为每个字段添加清晰的注释
 * 4. 使用 Zod Schema 定义复杂类型
 */

import { Annotation } from "@langchain/langgraph";
import { BaseAgentState, Intent, InformationGap } from "@core/state.js";
import { z } from "zod";
import type { WeatherResult } from "@tools/weather.js";

/**
 * 出差信息 Schema
 */
export const TravelInformationSchema = z.object({
  destination: z.string().nullable().describe("目的地城市"),
  duration: z.number().nullable().describe("停留时长（天数）"),
  purpose: z.string().nullable().describe("出差目的"),
  startDate: z.string().nullable().describe("出发日期"),
});

export type TravelInformation = z.infer<typeof TravelInformationSchema>;

/**
 * 计划结果 Schema
 */
export const PlanSchema = z.object({
  tasks: z.array(z.string()).describe("任务列表"),
  toolsNeeded: z.array(z.string()).describe("需要的工具"),
  order: z.array(z.string()).describe("执行顺序"),
});

export type Plan = z.infer<typeof PlanSchema>;

/**
 * 验证结果 Schema
 */
export const ValidationSchema = z.object({
  isValid: z.boolean().describe("是否合格"),
  issues: z.array(z.string()).describe("发现的问题"),
  suggestions: z.array(z.string()).describe("改进建议"),
});

export type Validation = z.infer<typeof ValidationSchema>;

/**
 * Travel Agent 状态定义
 *
 * 使用 Annotation.Root 继承 BaseAgentState
 */
export const TravelStateAnnotation = Annotation.Root({
  ...BaseAgentState.spec,

  /**
   * 当前处理的输入（可能是原始输入或补充输入）
   */
  input: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 意图识别结果
   */
  userIntent: Annotation<Intent | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 提取的出差信息
   */
  information: Annotation<TravelInformation | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 信息缺口分析
   */
  informationGap: Annotation<InformationGap | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 用户最新补充的信息
   */
  latestUserSupplement: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 执行计划
   */
  plan: Annotation<Plan | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 天气查询结果
   */
  weather: Annotation<WeatherResult | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 生成的回复
   */
  generatedReply: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 验证结果
   */
  validation: Annotation<Validation | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 最终回复
   */
  reply: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
});

/**
 * Travel Agent 状态类型（从 Annotation 推导）
 */
export type TravelState = typeof TravelStateAnnotation.State;
