# DDD 迁移指南

如果你有基于旧版本（全局 Prompt）创建的 Agent，这里是迁移到 DDD 架构的指南。

## 为什么要迁移？

**DDD 方式的优势：**
- ✅ 领域自治 - 每个 Agent 独立演化
- ✅ 内聚性强 - Prompt 和业务逻辑放在一起
- ✅ 易于维护 - 修改一个领域不影响其他领域
- ✅ 团队协作 - 避免全局文件冲突
- ✅ 清晰边界 - 领域边界明确

## 迁移步骤

### Step 1: 在领域目录创建 `prompts.ts`

```bash
# 假设你的 Agent 在 src/agents/my-agent/
cd src/agents/my-agent
touch prompts.ts
```

### Step 2: 从全局 Prompt 文件复制相关 Prompt

**旧结构（src/prompts/index.ts）：**
```typescript
export const MY_AGENT_INTENT_PROMPT = `...`;
export const MY_AGENT_EXTRACT_PROMPT = `...`;
export const MY_AGENT_CLARIFY_PROMPT = `...`;
```

**新结构（src/agents/my-agent/prompts.ts）：**
```typescript
/**
 * My Agent Prompts
 * 领域的 Prompt 定义
 */

export const INTENT_PROMPT = `...`;  // 去掉前缀
export const EXTRACT_PROMPT = `...`;
export const CLARIFY_PROMPT = `...`;
```

### Step 3: 更新节点文件的导入

**旧方式（src/agents/my-agent/nodes.ts）：**
```typescript
import {
  MY_AGENT_INTENT_PROMPT,
  MY_AGENT_EXTRACT_PROMPT,
} from "../../prompts/index.js";
```

**新方式（src/agents/my-agent/nodes.ts）：**
```typescript
import {
  INTENT_PROMPT,
  EXTRACT_PROMPT,
} from "./prompts.js";  // 从本领域导入
```

### Step 4: 更新 Prompt 使用

**旧方式：**
```typescript
const chain = createStructuredChain(
  MY_AGENT_INTENT_PROMPT,  // 带前缀
  IntentSchema
);
```

**新方式：**
```typescript
const chain = createStructuredChain(
  INTENT_PROMPT,  // 去掉前缀
  IntentSchema
);
```

### Step 5: 在领域 index.ts 中导出 Prompt

**src/agents/my-agent/index.ts：**
```typescript
export * from "./state.js";
export * from "./nodes.js";
export * from "./graph.js";
export * from "./prompts.js";  // 添加这一行
```

### Step 6: 删除全局 Prompt 文件中的相关内容

如果所有 Agent 都迁移完成，可以删除全局 Prompt 文件：

```bash
rm src/prompts/index.ts
```

或者保留 `src/core/prompts.ts` 作为 Prompt 模式和最佳实践的参考。

## 迁移示例

### 完整示例：Travel Agent

**旧结构：**
```
src/
├── prompts/
│   └── index.ts
│       ├── TRAVEL_INTENT_PROMPT
│       ├── TRAVEL_EXTRACT_PROMPT
│       ├── TRAVEL_CLARIFY_PROMPT
│       └── ...
│
└── agents/
    └── travel/
        ├── state.ts
        ├── nodes.ts        # import from "../../prompts"
        ├── graph.ts
        └── index.ts
```

**新结构：**
```
src/
├── core/
│   └── prompts.ts         # Prompt 模式和最佳实践
│
└── agents/
    └── travel/
        ├── state.ts
        ├── nodes.ts       # import from "./prompts"
        ├── graph.ts
        ├── prompts.ts     # Travel 领域的 Prompt
        └── index.ts
```

## 批量迁移脚本

如果你有多个 Agent 需要迁移，可以使用这个脚本：

```bash
#!/bin/bash
# migrate-to-ddd.sh

AGENT_DIR=$1

if [ -z "$AGENT_DIR" ]; then
  echo "Usage: ./migrate-to-ddd.sh src/agents/my-agent"
  exit 1
fi

# 创建 prompts.ts
touch "$AGENT_DIR/prompts.ts"

# 添加头部注释
cat > "$AGENT_DIR/prompts.ts" << EOF
/**
 * $(basename $AGENT_DIR) Agent Prompts
 * 领域的 Prompt 定义
 *
 * DDD 原则：
 * - Prompt 是领域知识的一部分，应该和领域逻辑放在一起
 */

// TODO: 从全局 Prompt 文件复制相关 Prompt 到这里
EOF

echo "✅ 已创建 $AGENT_DIR/prompts.ts"
echo "📝 请手动完成以下步骤："
echo "  1. 将全局 Prompt 文件中的相关 Prompt 复制到 prompts.ts"
echo "  2. 更新 nodes.ts 的导入：from './prompts.js'"
echo "  3. 在 index.ts 中导出：export * from './prompts.js'"
```

使用方式：

```bash
chmod +x migrate-to-ddd.sh
./migrate-to-ddd.sh src/agents/my-agent
```

## 迁移检查清单

- [ ] 在领域目录创建 `prompts.ts`
- [ ] 复制相关 Prompt 到 `prompts.ts`
- [ ] 去掉 Prompt 名称前缀
- [ ] 更新 `nodes.ts` 的导入路径
- [ ] 更新 Prompt 使用（去掉前缀）
- [ ] 在 `index.ts` 中导出 `prompts.ts`
- [ ] 测试 Agent 功能正常
- [ ] 删除全局 Prompt 文件中的相关内容

## 常见问题

### Q: 迁移后，其他 Agent 如何引用我的 Prompt？

A: 不应该跨领域引用 Prompt。如果确实需要共享，说明：
1. 这个 Prompt 不是领域特定的，应该放在 `core/prompts.ts` 作为通用模式
2. 或者两个 Agent 应该合并成一个领域

### Q: 有些 Prompt 是通用的，应该放在哪里？

A: 通用的 Prompt **模式**和**最佳实践**放在 `core/prompts.ts`，但不要放具体的 Prompt 内容。例如：

```typescript
// core/prompts.ts - 通用模式
export function createIntentPromptTemplate(domain: string) {
  return `你是 ${domain} 的意图识别节点...`;
}

// agents/travel/prompts.ts - 具体 Prompt
export const INTENT_PROMPT = createIntentPromptTemplate("出差准备 Agent");
```

### Q: 迁移后，如何保证 Prompt 的一致性？

A: 
1. 使用 `core/prompts.ts` 中的模板函数
2. 在 Code Review 时检查 Prompt 质量
3. 建立 Prompt 的最佳实践文档

### Q: 旧的全局 Prompt 文件要删除吗？

A: 
- 如果所有 Agent 都迁移完成，可以删除
- 或者保留 `core/prompts.ts` 作为参考
- 不要保留 `src/prompts/index.ts` 这样的全局文件

## 迁移好处验证

迁移完成后，你应该能感受到：

1. **修改 Prompt 更方便**
   - 找到领域目录，直接修改 `prompts.ts`
   - 不用在 900 行的全局文件中搜索

2. **团队协作更顺畅**
   - 不同的人开发不同的 Agent 不会冲突
   - 代码审查时，修改范围清晰

3. **领域边界更清晰**
   - 每个 Agent 的所有内容都在一个目录
   - 删除 Agent 时，直接删除目录

4. **可维护性更强**
   - Prompt 和业务逻辑在一起，容易同步修改
   - 领域知识集中，新人上手快

---

**完成迁移，拥抱 DDD！** 🚀
