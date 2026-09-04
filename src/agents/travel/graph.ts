/**
 * Travel Agent Graph - 图定义
 *
 * 遵循规范：
 * 1. 使用 LangGraph 的 StateGraph
 * 2. 清晰的节点编排流程
 * 3. 标准的条件路由模式
 * 4. 文档化的执行流程
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { TravelStateAnnotation } from "./state.js";
import {
  receiveNode,
  intentNode,
  extractNode,
  clarifyNode,
  completeNode,
  planNode,
  weatherNode,
  generateNode,
  validateNode,
  replyNode,
  shouldContinue,
} from "./nodes.js";

/**
 * 创建 Travel Agent 图
 *
 * 执行流程：
 * 首轮：receive → identify_intent → extract_info → check_gap → [缺信息？wait : make_plan]
 *       → query_weather → generate_reply → validate_reply → send_reply → END
 *
 * 补充轮：receive → complete_info → [缺信息？wait : make_plan]
 *       → query_weather → generate_reply → validate_reply → send_reply → END
 *
 * @returns 编译后的可执行图
 */
export function createTravelAgentGraph() {
  // 定义路由函数：判断是首轮还是补充轮
  function routeAfterReceive(state: typeof TravelStateAnnotation.State): string {
    // 如果有 latestUserSupplement，说明是补充轮
    if (state.latestUserSupplement) {
      return "complete_info";
    }
    // 否则是首轮
    return "identify_intent";
  }

  // 创建状态图并链式添加所有节点
  const graph = new StateGraph(TravelStateAnnotation)
    .addNode("receive", receiveNode)
    .addNode("identify_intent", intentNode)
    .addNode("extract_info", extractNode)
    .addNode("check_gap", clarifyNode)
    .addNode("complete_info", completeNode)
    .addNode("make_plan", planNode)
    .addNode("query_weather", weatherNode)
    .addNode("generate_reply", generateNode)
    .addNode("validate_reply", validateNode)
    .addNode("send_reply", replyNode)
    // 定义边 - 入口点：START 连接到 receive
    .addEdge(START, "receive")
    // 首轮 vs 补充轮的路由
    .addConditionalEdges("receive", routeAfterReceive, {
      identify_intent: "identify_intent",
      complete_info: "complete_info",
    })
    // 首轮流程
    .addEdge("identify_intent", "extract_info")
    .addEdge("extract_info", "check_gap")
    // 条件分支 - 信息是否完整
    .addConditionalEdges("check_gap", shouldContinue, {
      plan: "make_plan",
      wait: END,
    })
    // complete 节点也需要条件判断
    .addConditionalEdges("complete_info", shouldContinue, {
      plan: "make_plan",
      wait: END,
    })
    // 执行链 - 信息完整后的流程
    .addEdge("make_plan", "query_weather")
    .addEdge("query_weather", "generate_reply")
    .addEdge("generate_reply", "validate_reply")
    .addEdge("validate_reply", "send_reply")
    .addEdge("send_reply", END);

  // 编译图
  return graph.compile();
}

/**
 * 默认导出的 Travel Agent 实例
 * 可以直接导入使用
 */
export const travelAgent = createTravelAgentGraph();
