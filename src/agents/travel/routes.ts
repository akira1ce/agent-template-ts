/**
 * Travel Agent Routes - 路由判断函数
 *
 * 集中管理所有的条件路由逻辑：
 * - routeAfterReceive: 判断是首轮还是补充轮
 * - shouldContinue: 判断信息是否完整，是否继续执行
 */

import type { TravelState } from "./state.js";

/**
 * 路由函数：判断是首轮还是补充轮
 * 用于 receive 节点后的条件分支
 *
 * @param state - 当前状态
 * @returns "complete_info" | "identify_intent"
 */
export function routeAfterReceive(state: TravelState): string {
  // 如果有 latestUserSupplement，说明是补充轮
  if (state.latestUserSupplement) {
    return "complete_info";
  }
  // 否则是首轮
  return "identify_intent";
}

/**
 * 条件判断：信息是否完整，是否继续执行
 * 用于 check_gap 和 complete_info 节点后的条件分支
 *
 * @param state - 当前状态
 * @returns "plan" | "wait"
 */
export function shouldContinue(state: TravelState): string {
  if (state.informationGap?.readyToContinue) {
    return "plan";
  }
  return "wait";
}
