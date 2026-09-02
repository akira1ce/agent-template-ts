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
 * 首轮：receive → intent → extract → clarify → [缺信息？wait : plan]
 *       → weather → generate → validate → reply → END
 *
 * 补充轮：complete → [缺信息？wait : plan]
 *       → weather → generate → validate → reply → END
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

  // 定义边 - 首轮流程
  graph.setEntryPoint("receive");
  graph.addEdge("receive", "identify_intent");
  graph.addEdge("identify_intent", "extract_info");
  graph.addEdge("extract_info", "check_gap");

  // 条件分支 - 信息是否完整
  graph.addConditionalEdges("clarify", shouldContinue, {
    plan: "plan",
    wait: END,
  });

  // complete 节点也需要条件判断
  graph.addConditionalEdges("complete", shouldContinue, {
    plan: "plan",
    wait: END,
  });

  // 执行链 - 信息完整后的流程
  graph.addEdge("plan", "weather");
  graph.addEdge("weather", "generate");
  graph.addEdge("generate", "validate");
  graph.addEdge("validate", "reply");
  graph.addEdge("reply", END);

  // 编译图
  return graph.compile();
}

/**
 * 默认导出的 Travel Agent 实例
 * 可以直接导入使用
 */
export const travelAgent = createTravelAgentGraph();
