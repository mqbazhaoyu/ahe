# 组件：子代理委派规则 v2.0

> AHE 组件类型：Sub-agent Configuration
> 收益预期：间接（通过减少主上下文污染）
> v2.0 改进：加入 memory bus 上下文继承 + 技能注入
> 原则：子代理有硬边界，不能再spawn子代理

## 何时委派

### 委派场景
- 任务复杂度高，需要独立上下文
- 需要不同模型（如用Claude处理代码，用GPT处理文案）
- 长时间运行的后台任务
- 需要隔离的实验性任务

### 不委派场景
- 简单查询/回答
- 需要主会话上下文的任务
- 一次性小任务（overhead太大）

## 委派方式

### sessions_spawn (runtime="subagent")
- mode="run"：一次性任务
- mode="session"：持久任务
- thread=true：Discord线程绑定

### sessions_spawn (runtime="acp")
- 用外部编码代理（Codex、Claude Code等）
- 需要指定 agentId

## 子代理约束

1. **不能递归**：子代理不能再 spawn 子代理
2. **独立上下文**：子代理有自己的上下文窗口
3. **结果返回**：通过 sessions_yield 接收结果
4. **不主动轮询**：完成后自动通知

## 沟通模式

### 向子代理发送任务
```
sessions_send(sessionKey, message)
```

### 接收子代理结果
```
sessions_yield()  // 等待子代理完成
```

### 管理子代理
```
subagents(action="list")   // 列出
subagents(action="steer")  // 转向
subagents(action="kill")   // 终止
```

## 进化记录

### 2026-05-17 v2.0 升级
- 加入子代理 skills 注入规则（从 memory bus 查询相关技能并注入子代理上下文）
- 加入子代理 memory_add 追溯规则（子代理返回结果写回 memory bus 时关联父任务）
