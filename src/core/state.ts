/**
 * State Management - 状态管理规范
 *
 * 核心价值：
 * 1. 标准化的状态结构
 * 2. 类型安全的状态定义
 * 3. 可复用的状态模式
 */

import { Annotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { z } from "zod";

/**
 * 基础 Agent 状态注解
 * 所有 Agent 都应该继承这个基础状态
 */
export const BaseAgentState = Annotation.Root({
  /**
   * 原始用户输入
   */
  rawInput: Annotation<string>,

  /**
   * 消息历史（支持自动累加）
   */
  messages: Annotation<BaseMessage[]>({
    reducer: (prev, next) => prev.concat(next),
    default: () => [],
  }),
});

/**
 * 信息缺口 Schema - 用于多轮对话的信息补全
 */
export const InformationGapSchema = z.object({
  askUserFor: z.array(z.string()).describe("必须询问用户的信息"),
  toolInformation: z.array(z.string()).describe("需要工具查询的信息"),
  ignoredInformation: z.array(z.string()).describe("当前可以忽略的信息"),
  readyToContinue: z.boolean().describe("是否准备好继续执行"),
  nextQuestion: z.string().nullable().describe("下一个要问的问题"),
  reason: z.string().describe("当前判断的依据"),
});

export type InformationGap = z.infer<typeof InformationGapSchema>;

/**
 * 意图识别 Schema
 */
export const IntentSchema = z.object({
  intent: z.string().describe("用户当前想完成的事情"),
  goal: z.string().describe("Agent 最终需要交付的结果"),
  confidence: z.enum(["高", "中", "低"]).describe("置信度"),
});

export type Intent = z.infer<typeof IntentSchema>;

/**
 * 工具函数：创建信息完整的缺口对象
 */
export function createReadyGap(): InformationGap {
  return {
    askUserFor: [],
    toolInformation: [],
    ignoredInformation: [],
    readyToContinue: true,
    nextQuestion: null,
    reason: "信息完整",
  };
}

/**
 * 工具函数：创建需要用户补充的缺口对象
 */
export function createGapWithQuestion(
  askUserFor: string[],
  question?: string
): InformationGap {
  const defaultQuestion = question || `请补充一下：${askUserFor[0]}？`;

  return {
    askUserFor,
    toolInformation: [],
    ignoredInformation: [],
    readyToContinue: false,
    nextQuestion: defaultQuestion,
    reason: "关键信息缺失",
  };
}
