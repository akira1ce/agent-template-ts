/**
 * Prompt Patterns - Prompt 工程化模式
 *
 * 核心价值：
 * 1. 提供通用的 Prompt 模式和最佳实践
 * 2. 每个 Agent 在自己的领域模块中管理自己的 Prompt
 * 3. 这里只提供参考模板和指导原则
 *
 * DDD 原则：
 * - 领域 Prompt 属于领域逻辑，应该在 agents/xxx/prompts.ts 中管理
 * - 这里只提供通用的 Prompt 工程模式
 */

/**
 * Prompt 工程最佳实践
 */
export const PROMPT_BEST_PRACTICES = {
  /**
   * 1. 职责单一原则
   * 每个 Prompt 只负责一个节点的工作
   */
  SINGLE_RESPONSIBILITY: `
示例：
- 意图识别节点：只判断用户想做什么
- 信息抽取节点：只记录明确的事实
- 不要让一个 Prompt 做多件事
  `,

  /**
   * 2. 明确边界原则
   * 清楚告诉模型"要做什么"和"不要做什么"
   */
  CLEAR_BOUNDARIES: `
示例：
你是信息抽取节点，只记录明确的事实。

**要做的：**
- 提取用户明确提到的信息
- 未提到的返回 null

**不要做的：**
- 不要推断或猜测
- 不要判断信息是否完整
- 不要提问
  `,

  /**
   * 3. 结构化输出原则
   * 使用 Zod Schema 定义输出格式
   */
  STRUCTURED_OUTPUT: `
使用 createStructuredChain() 确保输出格式：

const chain = createStructuredChain(
  PROMPT,
  z.object({
    field1: z.string(),
    field2: z.number(),
  })
);
  `,

  /**
   * 4. 示例驱动原则
   * 在 Prompt 中提供具体示例
   */
  EXAMPLE_DRIVEN: `
**示例：**
输入："我明天去上海"
输出：{ destination: "上海", date: "明天", duration: null }

输入："停留2天"
输出：{ destination: null, date: null, duration: 2 }
  `,
};

/**
 * 通用 Prompt 模板
 *
 * 各个 Agent 可以基于这些模板创建自己的 Prompt
 */

/**
 * 意图识别模板
 */
export function createIntentPromptTemplate(domain: string, fields: string) {
  return `你是 ${domain} 的意图识别节点，只判断用户想做什么。

你的职责：
- 识别用户当前想完成的事情（intent）
- 明确 Agent 最终需要交付的结果（goal）
- 评估置信度（confidence）

请严格返回 intent、goal、confidence 三个字段。

**不要做的事情：**
- 不要抽取具体信息字段
- 不要补全事实
- 不要制定计划
- 不要调用工具

**置信度标准：**
- 高：用户意图明确，表述清晰
- 中：用户意图基本明确，但表述有歧义
- 低：用户意图不清晰，需要进一步澄清`;
}

/**
 * 信息抽取模板
 */
export function createExtractPromptTemplate(fields: string, examples: string) {
  return `你是信息抽取节点，只记录明确的事实。

你的职责：
- 从用户输入中提取关键信息字段
- 只记录用户明确提到的内容
- 对于未提到的信息返回 null

**抽取字段：**
${fields}

**重要原则：**
- 没有提到的返回 null，不要猜测
- 不要推断或补全信息
- 不要判断信息是否完整
- 不要提问

${examples}`;
}

/**
 * 信息澄清模板
 */
export function createClarifyPromptTemplate(domain: string) {
  return `你是信息澄清节点，判断信息是否完整并决定如何继续。

你的输入：
- 用户意图（intent）
- 已提取的信息（information）

你的职责：
- 判断当前信息是否足够继续执行
- 将缺失的信息分类：
  * askUserFor: 必须询问用户的信息
  * toolInformation: 可以通过工具查询的信息
  * ignoredInformation: 当前可以忽略的信息

**分类原则：**
- askUserFor: 用户特定的、工具无法查询的
- toolInformation: 通用的、工具可以查询的
- ignoredInformation: 对当前任务不重要的

**输出字段：**
- askUserFor: string[] - 必须问用户的字段列表
- toolInformation: string[] - 需要工具查询的字段
- ignoredInformation: string[] - 可忽略的字段
- readyToContinue: boolean - 是否准备好继续
- nextQuestion: string | null - 下一个要问的问题（一次只问一个）
- reason: string - 当前判断的依据

**重要原则：**
- 一次只问一个问题
- 如果 askUserFor 非空，readyToContinue 必须为 false
- 如果所有必需信息都有了，readyToContinue 为 true`;
}

/**
 * 结果生成模板
 */
export function createGeneratePromptTemplate(domain: string, requirements: string) {
  return `你是结果生成节点，生成最终回复。

你的输入：
- 用户意图和需求
- 收集的信息
- 工具查询结果

你的职责：
- 生成友好、专业的回复
- 整合所有信息
- 提供实用的建议

**输出格式：**
直接返回回复文本，不要包装在 JSON 中。

**要求：**
- 语气友好、专业
- 结构清晰（使用标题、列表）
- 信息完整
- 有实用价值
${requirements}`;
}
