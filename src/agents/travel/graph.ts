/**
 * Travel Agent Graph - 图定义
 *
 * 遵循规范：
 * 1. 使用 LangGraph 的 StateGraph
 * 2. 清晰的节点编排流程
 * 3. 标准的条件路由模式
 * 4. 文档化的执行流程
 */

import { StateGraph, END } from "@langchain/langgraph";
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
  // 创建状态图
  const graph = new StateGraph(TravelStateAnnotation);

  // 添加所有节点
  graph.addNode("receive", receiveNode);
  graph.addNode("identify_intent", intentNode);
  graph.addNode("extract_info", extractNode);
  graph.addNode("check_gap", clarifyNode);
  graph.addNode("complete_info", completeNode);
  graph.addNode("make_plan", planNode);
  graph.addNode("query_weather", weatherNode);
  graph.addNode("generate_reply", generateNode);
  graph.addNode("validate_reply", validateNode);
  graph.addNode("send_reply", replyNode);

  // 定义路由函数：判断是首轮还是补充轮
  function routeAfterReceive(state: typeof TravelStateAnnotation.State): string {
    // 如果有 latestUserSupplement，说明是补充轮
    if (state.latestUserSupplement) {
      return "complete_info";
    }
    // 否则是首轮
    return "identify_intent";
  }

  // 定义边 - 入口点
  graph.setEntryPoint("receive");

  // 首轮 vs 补充轮的路由
  graph.addConditionalEdges("receive", routeAfterReceive, {
    identify_intent: "identify_intent",
    complete_info: "complete_info",
  });

  // 首轮流程
  graph.addEdge("identify_intent", "extract_info");
  graph.addEdge("extract_info", "check_gap");

  // 条件分支 - 信息是否完整
  graph.addConditionalEdges("check_gap", shouldContinue, {
    plan: "make_plan",
    wait: END,
  });

  // complete 节点也需要条件判断
  graph.addConditionalEdges("complete_info", shouldContinue, {
    plan: "make_plan",
    wait: END,
  });

  // 执行链 - 信息完整后的流程
  graph.addEdge("make_plan", "query_weather");
  graph.addEdge("query_weather", "generate_reply");
  graph.addEdge("generate_reply", "validate_reply");
  graph.addEdge("validate_reply", "send_reply");
  graph.addEdge("send_reply", END);

  // 编译图
  return graph.compile();
}

/**
 * 默认导出的 Travel Agent 实例
 * 可以直接导入使用
 */
export const travelAgent = createTravelAgentGraph();
