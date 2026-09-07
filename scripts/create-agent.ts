#!/usr/bin/env node
/**
 * Create Agent CLI
 * 快速创建新的 Agent 模板
 */

import * as readline from "readline";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface AgentConfig {
  name: string;
  description: string;
  features: string[];
}

// ANSI 颜色
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function log(message: string, color: keyof typeof colors = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function toCamelCase(str: string): string {
  const pascal = toPascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

// ============ 模板生成函数 ============

function generateStateTemplate(config: AgentConfig): string {
  const pascalName = toPascalCase(config.name);
  const hasMultiTurn = config.features.includes("multi-turn");

  return `/**
 * ${pascalName} Agent State - 状态定义
 */

import { Annotation } from "@langchain/langgraph";
import { BaseAgentState } from "@core/state.js";
import { z } from "zod";

/**
 * ${config.description} - 数据模型
 */
export const ${pascalName}DataSchema = z.object({
  // TODO: 定义你的数据字段
  field1: z.string().nullable().describe("字段1描述"),
  field2: z.number().nullable().describe("字段2描述"),
});

export type ${pascalName}Data = z.infer<typeof ${pascalName}DataSchema>;

/**
 * ${pascalName} Agent 状态定义
 */
export const ${pascalName}StateAnnotation = Annotation.Root({
  ...BaseAgentState.spec,

  /**
   * 当前处理的输入
   */
  input: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),

  /**
   * 提取的数据
   */
  data: Annotation<${pascalName}Data | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
${
  hasMultiTurn
    ? `
  /**
   * 用户补充的信息（多轮对话）
   */
  latestUserSupplement: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
`
    : ""
}
  /**
   * 最终回复
   */
  reply: Annotation<string | null>({
    reducer: (prev, next) => next ?? prev,
    default: () => null,
  }),
});

/**
 * ${pascalName} Agent 状态类型
 */
export type ${pascalName}State = typeof ${pascalName}StateAnnotation.State;
`;
}

function generateNodesTemplate(config: AgentConfig): string {
  const pascalName = toPascalCase(config.name);
  const camelName = toCamelCase(config.name);
  const hasTools = config.features.includes("tools");

  return `/**
 * ${pascalName} Agent Nodes - 节点实现
 */

import { ChatPromptTemplate } from "@langchain/core/prompts";
import type { ${pascalName}State } from "./state.js";
import { ${pascalName}DataSchema } from "./state.js";
import { createStructuredChain, createLLM, LLMPresets } from "@core/llm.js";
import { EXTRACT_PROMPT, GENERATE_PROMPT } from "./prompts.js";
import { AgentRuntime } from "@core/runtime.js";
import {
  LoggerPlugin,
  TimingPlugin,
  RetryPlugin,
} from "@core/plugins/index.js";
${hasTools ? 'import { queryWeatherTool } from "@tools/weather.js";' : ""}

/**
 * 创建 ${pascalName} Agent 的 Runtime
 */
const runtime = new AgentRuntime<${pascalName}State>()
  .use(new LoggerPlugin({ logState: false, logResult: false }))
  .use(new TimingPlugin({ slowThreshold: 3000 }))
  .use(new RetryPlugin({ maxRetries: 2, retryDelay: 1000 }));

/**
 * 接收节点
 */
export const receiveNode = runtime.node(
  async (state, config?) => ({
    input: state.rawInput,
  }),
  { displayName: "receive" },
);

/**
 * 数据提取节点
 */
export const extractNode = runtime.node(
  async (state, config?) => {
    const chain = createStructuredChain(
      EXTRACT_PROMPT,
      ${pascalName}DataSchema,
      LLMPresets.deepseek(),
    );

    const data = await chain.invoke({ input: state.input! }, config);

    return { data };
  },
  { displayName: "extract_data" },
);
${
  hasTools
    ? `
/**
 * 工具调用节点（示例）
 */
export const toolNode = runtime.node(
  async (state, config?) => {
    // TODO: 调用你的工具
    const toolResult = await queryWeatherTool.invoke({
      destination: state.data?.field1 || "北京",
    });

    return { toolResult };
  },
  { displayName: "call_tool" },
);
`
    : ""
}
/**
 * 生成回复节点
 */
export const generateNode = runtime.node(
  async (state, config?) => {
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", GENERATE_PROMPT],
      ["human", "{input}"],
    ]);

    const llm = createLLM(LLMPresets.deepseek());
    const chain = prompt.pipe(llm);

    const contextInfo = \`
用户输入：\${state.input}
提取数据：\${JSON.stringify(state.data, null, 2)}
    \`.trim();

    // 使用 stream 来支持流式输出
    const stream = await chain.stream({ input: contextInfo }, config);
    let reply = "";

    for await (const chunk of stream) {
      const token = chunk.content as string;
      reply += token;
    }

    return { reply };
  },
  { displayName: "generate_reply" },
);

/**
 * 回复节点
 */
export const replyNode = runtime.node(
  async (state, config?) => ({
    reply: state.reply,
  }),
  { displayName: "send_reply" },
);
`;
}

function generateGraphTemplate(config: AgentConfig): string {
  const pascalName = toPascalCase(config.name);
  const camelName = toCamelCase(config.name);
  const hasTools = config.features.includes("tools");

  return `/**
 * ${pascalName} Agent Graph - 图定义
 */

import { StateGraph, START, END } from "@langchain/langgraph";
import { ${pascalName}StateAnnotation } from "./state.js";
import {
  receiveNode,
  extractNode,${hasTools ? "\n  toolNode," : ""}
  generateNode,
  replyNode,
} from "./nodes.js";

/**
 * 创建 ${pascalName} Agent 图
 */
export function create${pascalName}AgentGraph() {
  const graph = new StateGraph(${pascalName}StateAnnotation)
    .addNode("receive", receiveNode)
    .addNode("extract_data", extractNode)${
      hasTools ? '\n    .addNode("call_tool", toolNode)' : ""
    }
    .addNode("generate_reply", generateNode)
    .addNode("send_reply", replyNode)
    // 定义边
    .addEdge(START, "receive")
    .addEdge("receive", "extract_data")${
      hasTools
        ? '\n    .addEdge("extract_data", "call_tool")\n    .addEdge("call_tool", "generate_reply")'
        : '\n    .addEdge("extract_data", "generate_reply")'
    }
    .addEdge("generate_reply", "send_reply")
    .addEdge("send_reply", END);

  return graph.compile();
}

/**
 * 默认导出的 ${pascalName} Agent 实例
 */
export const ${camelName}Agent = create${pascalName}AgentGraph();
`;
}

function generatePromptsTemplate(config: AgentConfig): string {
  const pascalName = toPascalCase(config.name);

  return `/**
 * ${pascalName} Agent Prompts
 */

/**
 * 数据提取 Prompt
 */
export const EXTRACT_PROMPT = \`
你是一个数据提取助手。

从用户输入中提取关键信息，以结构化的方式返回。

注意：
- 只提取明确提到的信息
- 没有提到的字段返回 null
- 保持信息的准确性
\`;

/**
 * 回复生成 Prompt
 */
export const GENERATE_PROMPT = \`
你是一个智能助手 - ${config.description}。

根据提取的数据，生成友好、专业的回复。

要求：
- 语言简洁清晰
- 提供有价值的建议
- 保持专业和友好的语气
\`;
`;
}

function generateIndexTemplate(config: AgentConfig): string {
  const pascalName = toPascalCase(config.name);
  const camelName = toCamelCase(config.name);

  return `/**
 * ${pascalName} Agent
 * ${config.description}
 */

export { ${camelName}Agent, create${pascalName}AgentGraph } from "./graph.js";
export { ${pascalName}StateAnnotation } from "./state.js";
export type { ${pascalName}State, ${pascalName}Data } from "./state.js";
`;
}

function generateTestTemplate(config: AgentConfig): string {
  const pascalName = toPascalCase(config.name);
  const camelName = toCamelCase(config.name);

  return `/**
 * ${pascalName} Agent Tests
 */

import { describe, it, expect } from "vitest";
import { createAgentTester } from "@core/testing/index.js";
import { ${camelName}Agent } from "../graph.js";
import type { ${pascalName}State } from "../state.js";

describe("${pascalName} Agent", () => {
  const tester = createAgentTester<${pascalName}State>(${camelName}Agent);

  describe("基础功能", () => {
    it("应该正确处理输入", async () => {
      const result = await tester.testSingleTurn(
        { rawInput: "测试输入" },
        {
          outputFields: ["data", "reply"],
          assertions: (result) => {
            expect(result.data).toBeDefined();
            expect(result.reply).toBeDefined();
          },
        },
      );

      expect(result.reply).toBeTruthy();
    });
  });

  describe("性能测试", () => {
    it("响应时间应该在合理范围内", async () => {
      const stats = await tester.benchmark(
        { rawInput: "测试输入" },
        { iterations: 3, warmup: 1 },
      );

      console.log(\`平均响应时间: \${stats.avg.toFixed(0)}ms\`);
      expect(stats.avg).toBeLessThan(15000);
    });
  });
});
`;
}

function generateReadmeTemplate(config: AgentConfig): string {
  const pascalName = toPascalCase(config.name);

  return `# ${pascalName} Agent

${config.description}

## 功能特性

${config.features.map((f) => `- ${f}`).join("\n")}

## 使用方法

\`\`\`typescript
import { ${toCamelCase(config.name)}Agent } from "@agents/${config.name}/index.js";

const result = await ${toCamelCase(config.name)}Agent.invoke({
  rawInput: "你的输入",
});

console.log(result.reply);
\`\`\`

## 测试

\`\`\`bash
npm test -- src/agents/${config.name}
\`\`\`

## 开发

1. 修改 \`prompts.ts\` 定义 Prompts
2. 修改 \`state.ts\` 定义数据结构
3. 修改 \`nodes.ts\` 实现业务逻辑
4. 修改 \`graph.ts\` 编排流程
5. 添加测试到 \`__tests__/\`
`;
}

// ============ 主函数 ============

async function main() {
  console.log("\n" + "=".repeat(60));
  log("🤖 Create Agent - 快速创建新的 Agent", "cyan");
  console.log("=".repeat(60) + "\n");

  // 收集配置
  const name = await prompt("Agent 名称 (kebab-case, 例如: customer-service): ");
  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
    log("❌ 名称格式不正确，请使用 kebab-case (例如: customer-service)", "yellow");
    process.exit(1);
  }

  const description = await prompt("Agent 描述 (例如: 智能客服助手): ");
  if (!description) {
    log("❌ 描述不能为空", "yellow");
    process.exit(1);
  }

  console.log("\n选择功能特性 (输入数字，多个用逗号分隔，例如: 1,2,3):");
  console.log("  1. 多轮对话 (multi-turn)");
  console.log("  2. 工具调用 (tools)");
  console.log("  3. 流式输出 (streaming)");

  const featuresInput = await prompt("\n你的选择: ");
  const selectedIndexes = featuresInput.split(",").map((s) => s.trim());

  const featureMap: Record<string, string> = {
    "1": "multi-turn",
    "2": "tools",
    "3": "streaming",
  };

  const features = selectedIndexes
    .map((idx) => featureMap[idx])
    .filter(Boolean);

  if (features.length === 0) {
    log("⚠️  未选择任何特性，将创建基础 Agent", "yellow");
  }

  const config: AgentConfig = {
    name,
    description,
    features,
  };

  // 确认
  console.log("\n" + "-".repeat(60));
  log("📋 配置确认:", "blue");
  console.log(`  名称: ${config.name}`);
  console.log(`  描述: ${config.description}`);
  console.log(`  特性: ${config.features.join(", ") || "无"}`);
  console.log("-".repeat(60));

  const confirm = await prompt("\n确认创建？(y/n): ");
  if (confirm.toLowerCase() !== "y") {
    log("❌ 已取消", "yellow");
    process.exit(0);
  }

  // 创建目录
  const agentDir = path.join(process.cwd(), "src", "agents", config.name);

  if (fs.existsSync(agentDir)) {
    log(`❌ Agent "${config.name}" 已存在`, "yellow");
    process.exit(1);
  }

  fs.mkdirSync(agentDir, { recursive: true });
  fs.mkdirSync(path.join(agentDir, "__tests__"), { recursive: true });

  // 生成文件
  log("\n📝 生成文件...", "blue");

  const files = [
    { name: "state.ts", content: generateStateTemplate(config) },
    { name: "nodes.ts", content: generateNodesTemplate(config) },
    { name: "graph.ts", content: generateGraphTemplate(config) },
    { name: "prompts.ts", content: generatePromptsTemplate(config) },
    { name: "index.ts", content: generateIndexTemplate(config) },
    { name: "README.md", content: generateReadmeTemplate(config) },
    {
      name: "__tests__/" + config.name + ".test.ts",
      content: generateTestTemplate(config),
    },
  ];

  for (const file of files) {
    const filePath = path.join(agentDir, file.name);
    fs.writeFileSync(filePath, file.content, "utf8");
    log(`  ✓ ${file.name}`, "green");
  }

  // 完成
  console.log("\n" + "=".repeat(60));
  log(`✅ Agent "${config.name}" 创建成功！`, "green");
  console.log("=".repeat(60));

  console.log(`\n📁 位置: ${agentDir}`);
  console.log("\n📚 下一步:");
  console.log(`  1. 修改 Prompts: src/agents/${config.name}/prompts.ts`);
  console.log(`  2. 定义数据结构: src/agents/${config.name}/state.ts`);
  console.log(`  3. 实现业务逻辑: src/agents/${config.name}/nodes.ts`);
  console.log(`  4. 运行测试: npm test -- src/agents/${config.name}`);
  console.log("");
}

main().catch((error) => {
  console.error("\n❌ 错误:", error.message);
  process.exit(1);
});
