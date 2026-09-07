# API 迁移方案

## 概述

将当前的 CLI 交互式 Travel Agent 迁移到 API 服务模式（如 HTTP REST API 或 WebSocket）。

## 当前架构分析

### 现有组件
```
src/agents/travel/
├── state.ts          # 状态定义（LangGraph Annotation）
├── nodes.ts          # 节点实现（业务逻辑）
├── graph.ts          # 图编排（流程控制）
└── prompts.ts        # LLM Prompts

src/examples/
└── interactive-demo.ts  # CLI 交互式界面
```

### 关键特性
- ✅ 状态持久化（通过内存保存 `currentState`）
- ✅ 多轮对话支持
- ✅ 流式输出（通过 LangChain callbacks）
- ✅ 插件系统（日志、计时、重试）

## 迁移方案

### 方案 A：REST API + Server-Sent Events (SSE)
**推荐用于：** 简单的 HTTP 集成，前端友好

#### 架构设计
```
┌─────────────┐
│   Client    │
│  (Browser)  │
└──────┬──────┘
       │ HTTP POST /api/chat
       │ (包含 conversationId, message)
       │
       ▼
┌─────────────────────────┐
│    API Server (NestJS)  │
│  ┌──────────────────┐   │
│  │ ChatController   │   │
│  └────────┬─────────┘   │
│           │             │
│  ┌────────▼─────────┐   │
│  │ ConversationMgr  │   │
│  │ (状态存储)       │   │
│  └────────┬─────────┘   │
│           │             │
│  ┌────────▼─────────┐   │
│  │ TravelAgent      │   │
│  │ (LangGraph)      │   │
│  └────────┬─────────┘   │
│           │             │
└───────────┼─────────────┘
            │ SSE Stream
            ▼
       ┌─────────┐
       │ Client  │
       └─────────┘
```

#### 核心改动

**1. 状态管理**
```typescript
// src/api/services/conversation-manager.ts

import { TravelState } from "@agents/travel/state.js";

interface ConversationSession {
  id: string;
  state: Partial<TravelState>;
  createdAt: Date;
  lastActivityAt: Date;
}

export class ConversationManager {
  private sessions = new Map<string, ConversationSession>();
  
  // 创建新会话
  createSession(): string {
    const id = crypto.randomUUID();
    this.sessions.set(id, {
      id,
      state: {},
      createdAt: new Date(),
      lastActivityAt: new Date(),
    });
    return id;
  }
  
  // 获取会话状态
  getSession(id: string): ConversationSession | undefined {
    return this.sessions.get(id);
  }
  
  // 更新会话状态
  updateSession(id: string, state: Partial<TravelState>): void {
    const session = this.sessions.get(id);
    if (session) {
      session.state = state;
      session.lastActivityAt = new Date();
    }
  }
  
  // 清理过期会话（TTL: 30分钟）
  cleanupExpiredSessions(): void {
    const now = Date.now();
    const TTL = 30 * 60 * 1000; // 30分钟
    
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt.getTime() > TTL) {
        this.sessions.delete(id);
      }
    }
  }
}
```

**2. API Controller**
```typescript
// src/api/controllers/chat.controller.ts

import { Controller, Post, Body, Sse, MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { travelAgent } from '@agents/travel/graph.js';
import { ConversationManager } from '../services/conversation-manager.js';

interface ChatRequest {
  conversationId?: string;  // 可选，首次为空
  message: string;
}

interface ChatResponse {
  conversationId: string;
  message?: string;         // 信息不完整时的追问
  reply?: string;           // 最终回复
  information?: object;     // 收集到的信息
  completed: boolean;       // 是否完成
}

@Controller('api/chat')
export class ChatController {
  constructor(private conversationMgr: ConversationManager) {}
  
  @Sse('stream')
  chatStream(@Body() request: ChatRequest): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      this.handleChat(request, subscriber).catch((err) => {
        subscriber.error(err);
      });
    });
  }
  
  private async handleChat(
    request: ChatRequest,
    subscriber: any,
  ): Promise<void> {
    // 1. 获取或创建会话
    let conversationId = request.conversationId;
    if (!conversationId) {
      conversationId = this.conversationMgr.createSession();
    }
    
    const session = this.conversationMgr.getSession(conversationId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // 2. 准备输入状态
    const inputState = {
      ...session.state,
      rawInput: request.message,
      latestUserSupplement: session.state.informationGap ? request.message : null,
    };
    
    // 3. 创建流式回调
    const streamCallback = {
      handleLLMNewToken(token: string) {
        subscriber.next({
          data: { type: 'token', content: token },
        });
      },
    };
    
    // 4. 调用 agent
    const result = await travelAgent.invoke(inputState, {
      callbacks: [streamCallback],
    });
    
    // 5. 更新会话状态
    this.conversationMgr.updateSession(conversationId, result);
    
    // 6. 发送最终响应
    const response: ChatResponse = {
      conversationId,
      completed: result.informationGap?.readyToContinue ?? false,
      information: result.information,
    };
    
    if (result.informationGap?.readyToContinue) {
      response.reply = result.reply;
    } else {
      response.message = result.informationGap?.nextQuestion;
    }
    
    subscriber.next({ data: { type: 'done', ...response } });
    subscriber.complete();
  }
}
```

**3. 前端集成示例**
```typescript
// client/chat-client.ts

class ChatClient {
  private conversationId?: string;
  
  async sendMessage(
    message: string,
    onToken: (token: string) => void,
    onComplete: (response: ChatResponse) => void,
  ): Promise<void> {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: this.conversationId,
        message,
      }),
    });
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const text = decoder.decode(value);
      const lines = text.split('\n\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          
          if (data.type === 'token') {
            onToken(data.content);
          } else if (data.type === 'done') {
            this.conversationId = data.conversationId;
            onComplete(data);
          }
        }
      }
    }
  }
  
  reset(): void {
    this.conversationId = undefined;
  }
}
```

---

### 方案 B：WebSocket
**推荐用于：** 需要双向实时通信的场景

#### 架构设计
```typescript
// src/api/gateways/chat.gateway.ts

import { WebSocketGateway, WebSocketServer, SubscribeMessage } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway()
export class ChatGateway {
  @WebSocketServer()
  server: Server;
  
  private conversationMgr = new ConversationManager();
  
  @SubscribeMessage('chat:start')
  handleStart(client: Socket): void {
    const conversationId = this.conversationMgr.createSession();
    client.emit('chat:session', { conversationId });
  }
  
  @SubscribeMessage('chat:message')
  async handleMessage(
    client: Socket,
    payload: { conversationId: string; message: string },
  ): Promise<void> {
    const session = this.conversationMgr.getSession(payload.conversationId);
    if (!session) {
      client.emit('chat:error', { message: 'Session not found' });
      return;
    }
    
    const inputState = {
      ...session.state,
      rawInput: payload.message,
      latestUserSupplement: session.state.informationGap ? payload.message : null,
    };
    
    const streamCallback = {
      handleLLMNewToken(token: string) {
        client.emit('chat:token', { token });
      },
    };
    
    const result = await travelAgent.invoke(inputState, {
      callbacks: [streamCallback],
    });
    
    this.conversationMgr.updateSession(payload.conversationId, result);
    
    client.emit('chat:complete', {
      completed: result.informationGap?.readyToContinue ?? false,
      reply: result.reply,
      nextQuestion: result.informationGap?.nextQuestion,
      information: result.information,
    });
  }
  
  @SubscribeMessage('chat:reset')
  handleReset(client: Socket, payload: { conversationId: string }): void {
    this.conversationMgr.updateSession(payload.conversationId, {});
    client.emit('chat:reset-done');
  }
}
```

---

### 方案 C：GraphQL Subscriptions
**推荐用于：** 已有 GraphQL 架构的项目

#### Schema
```graphql
type Query {
  conversation(id: ID!): Conversation
}

type Mutation {
  startConversation: Conversation!
  sendMessage(conversationId: ID!, message: String!): MessageResult!
  resetConversation(conversationId: ID!): Boolean!
}

type Subscription {
  messageStream(conversationId: ID!): StreamEvent!
}

type Conversation {
  id: ID!
  state: ConversationState
  createdAt: DateTime!
}

type MessageResult {
  conversationId: ID!
  completed: Boolean!
  reply: String
  nextQuestion: String
  information: JSON
}

union StreamEvent = TokenEvent | CompleteEvent

type TokenEvent {
  token: String!
}

type CompleteEvent {
  result: MessageResult!
}
```

---

## 状态持久化选项

### 选项 1：内存存储（开发/小规模）
```typescript
// 当前方案，使用 Map
private sessions = new Map<string, ConversationSession>();
```
**优点：** 简单快速
**缺点：** 重启丢失，无法水平扩展

### 选项 2：Redis（推荐生产环境）
```typescript
import Redis from 'ioredis';

export class RedisConversationManager {
  private redis: Redis;
  
  async saveSession(id: string, state: Partial<TravelState>): Promise<void> {
    await this.redis.setex(
      `conversation:${id}`,
      30 * 60, // TTL: 30分钟
      JSON.stringify(state),
    );
  }
  
  async getSession(id: string): Promise<Partial<TravelState> | null> {
    const data = await this.redis.get(`conversation:${id}`);
    return data ? JSON.parse(data) : null;
  }
}
```

### 选项 3：数据库（持久化需求）
```typescript
// 使用 TypeORM 或 Prisma

@Entity()
export class Conversation {
  @PrimaryColumn()
  id: string;
  
  @Column('jsonb')
  state: Partial<TravelState>;
  
  @Column()
  createdAt: Date;
  
  @Column()
  lastActivityAt: Date;
}
```

---

## 迁移步骤

### 阶段 1：核心改造（1-2天）
1. ✅ 创建 `ConversationManager` 服务
2. ✅ 实现 REST API Controller 或 WebSocket Gateway
3. ✅ 调整状态管理逻辑（从 CLI 到 API）
4. ✅ 保持 `travel agent` 核心逻辑不变

### 阶段 2：流式输出优化（1天）
1. ✅ 实现 SSE 或 WebSocket 流式推送
2. ✅ 测试 callback 机制
3. ✅ 处理异常和超时

### 阶段 3：持久化与扩展（1-2天）
1. ✅ 接入 Redis 或数据库
2. ✅ 添加会话清理机制
3. ✅ 添加监控和日志

### 阶段 4：测试与部署（1天）
1. ✅ API 集成测试
2. ✅ 前端集成测试
3. ✅ 性能测试
4. ✅ 部署到生产环境

---

## 代码组织建议

```
src/
├── agents/
│   └── travel/          # 保持不变
│       ├── state.ts
│       ├── nodes.ts
│       ├── graph.ts
│       └── prompts.ts
│
├── api/                 # 新增 API 层
│   ├── controllers/
│   │   └── chat.controller.ts
│   ├── gateways/
│   │   └── chat.gateway.ts
│   ├── services/
│   │   ├── conversation-manager.ts
│   │   └── redis-conversation-manager.ts
│   ├── dto/
│   │   ├── chat-request.dto.ts
│   │   └── chat-response.dto.ts
│   └── api.module.ts
│
├── examples/            # 保留用于测试
│   ├── interactive-demo.ts
│   └── multi-turn-demo.ts
│
└── main.ts             # API 服务入口
```

---

## 技术栈建议

### 后端框架
- **NestJS**（推荐）：企业级、模块化、TypeScript 原生支持
- **Express + TypeScript**：轻量、灵活
- **Fastify**：高性能

### 状态存储
- **Redis**（推荐）：快速、支持 TTL、易于扩展
- **PostgreSQL + JSONB**：需要持久化时
- **MongoDB**：文档存储，灵活

### 前端集成
- **SSE**：单向流式，浏览器原生支持
- **WebSocket**：双向通信，需要库支持
- **GraphQL Subscriptions**：适合已有 GraphQL 的项目

---

## 关键注意事项

### 1. 状态一致性
- 确保 `latestUserSupplement` 的正确设置
- 多轮对话时状态要完整传递

### 2. 超时处理
```typescript
const timeout = setTimeout(() => {
  subscriber.error(new Error('Timeout'));
}, 30000); // 30秒超时

// 完成后清除
clearTimeout(timeout);
```

### 3. 错误处理
```typescript
try {
  const result = await travelAgent.invoke(...);
} catch (error) {
  subscriber.next({
    data: { type: 'error', message: error.message },
  });
  subscriber.complete();
}
```

### 4. 并发控制
```typescript
// 使用 bull 队列处理高并发
import Queue from 'bull';

const chatQueue = new Queue('chat', {
  redis: { host: 'localhost', port: 6379 },
});

chatQueue.process(async (job) => {
  return await travelAgent.invoke(job.data.state);
});
```

---

## 示例项目结构

可以参考这个启动模板：
```bash
git clone https://github.com/your-org/agent-api-template
cd agent-api-template
npm install
npm run dev
```

---

## 总结

**最小改动迁移：**
1. 核心 agent 代码（`agents/travel/`）**不需要改动**
2. 只需要添加 API 层（`api/`）来管理会话和处理请求
3. 用 Redis 或内存存储代替 CLI 的状态变量

**推荐方案：**
- **开发阶段**：REST + SSE + 内存存储
- **生产环境**：REST + SSE + Redis + NestJS

**迁移工作量：** 约 3-5 天（包含测试）
