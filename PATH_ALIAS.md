# 路径别名使用说明

## 配置

在 `tsconfig.json` 中已配置：

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@core/*": ["src/core/*"],
      "@tools/*": ["src/tools/*"],
      "@agents/*": ["src/agents/*"]
    }
  }
}
```

## 使用方式

### 1. 核心模块 (@core/*)

```typescript
// ❌ 旧方式
import { createStructuredChain } from "../../core/llm.js";
import { IntentSchema } from "../../core/state.js";
import { withLogging } from "../../core/nodes.js";

// ✅ 新方式
import { createStructuredChain } from "@core/llm.js";
import { IntentSchema } from "@core/state.js";
import { withLogging } from "@core/nodes.js";
```

### 2. 工具模块 (@tools/*)

```typescript
// ❌ 旧方式
import { queryWeather } from "../../tools/weather.js";

// ✅ 新方式
import { queryWeather } from "@tools/weather.js";
```

### 3. Agent 模块 (@agents/*)

```typescript
// ❌ 旧方式
import { travelAgent } from "../agents/travel/graph.js";

// ✅ 新方式
import { travelAgent } from "@agents/travel/graph.js";
```

### 4. 根目录 (@/*)

```typescript
// ✅ 可以使用 @/ 访问 src 下的任何文件
import { something } from "@/some/path/file.js";
```

## 优势

1. **清晰** - 一眼看出导入的是哪个模块
2. **简洁** - 不需要 `../../..` 这样的相对路径
3. **稳定** - 移动文件时不需要更新导入路径
4. **IDE 支持** - 自动补全和跳转仍然有效

## 最佳实践

### 领域内导入

在同一个领域内，使用相对路径：

```typescript
// src/agents/travel/nodes.ts
import { INTENT_PROMPT } from "./prompts.js";  // ✅ 相对路径
import { TravelState } from "./state.js";       // ✅ 相对路径
```

### 跨模块导入

跨模块导入使用别名：

```typescript
// src/agents/travel/nodes.ts
import { IntentSchema } from "@core/state.js";     // ✅ 别名
import { queryWeather } from "@tools/weather.js"; // ✅ 别名
```

## 常用路径映射

| 别名 | 实际路径 | 用途 |
|------|---------|------|
| `@core/*` | `src/core/*` | 核心规范模块 |
| `@tools/*` | `src/tools/*` | 共享工具 |
| `@agents/*` | `src/agents/*` | Agent 领域 |
| `@/*` | `src/*` | 任意 src 下的文件 |

## 注意事项

1. **文件扩展名** - 保留 `.js` 扩展名（TypeScript ESM 要求）
2. **IDE 配置** - 大部分 IDE 会自动识别 `tsconfig.json` 中的 paths
3. **运行时** - `tsx` 和 `ts-node` 都支持路径别名
