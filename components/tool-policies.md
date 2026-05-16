# 组件：工具使用策略 v2.0

> AHE 组件类型：Tool Policies
> 收益预期：+3.3pp（论文数据）
> v2.0 改进：加入 memory_bus 工具策略 + 技能结晶流程 + n8n 编排规则
> 原则：工具策略是硬结构，换了模型照样好使

## web_fetch

### 适用场景
- 抓取静态HTML页面
- 获取API返回的JSON
- 下载文本文件

### 不适用场景
- X/Twitter 帖子（纯客户端渲染，抓不到正文）
- X 文章页（`x.com/i/article/xxx`，纯SPA）
- 需要登录的页面
- 需要JS交互的页面

### X/Twitter 替代方案
1. **vxtwitter API**：`https://api.vxtwitter.com/{username}/status/{id}` → JSON格式，能拿到正文、媒体URL、点赞数等
2. **浏览器工具**：`browser` + profile="user" + target="host" → 用强哥的Chrome（有DokoBot），能渲染SPA
3. **不要用**：直接 web_fetch x.com、nitter、GitHub API 硬爬

### 提取模式选择
- `text`：API返回JSON时用
- `markdown`：需要正文结构时用

## browser

### 两种模式
- **默认（不指定profile）**：OpenClaw沙盒浏览器，无扩展，无登录
- **profile="user" + target="host"**：强哥的Chrome，有DokoBot，有登录态

### 使用原则
- 需要登录态/SPA渲染 → profile="user" + target="host"
- 简单页面截图/交互 → 默认沙盒
- X/Twitter 必须用 profile="user"

### 已知问题
- Chrome MCP 可能连接失败（Chrome未启动/调试端口未开）
- 失败时回退到 web_fetch 或 vxtwitter API

## exec

### 常用路径
- es.exe：`D:\longxiaqiang\tools\skills\es\es.exe`
- ffmpeg：`D:\longxiaqiang\tools\skills\x-video-downloader\ffmpeg-8.1\bin\ffmpeg.exe`
- Python：系统 PATH

### 原则
- 长命令直接执行，不用 cmd /c 包装
- 长运行任务用 background + process 模式
- 删除操作先确认

## image

### 适用场景
- 分析图片内容
- OCR文字识别
- 图片描述

### 不适用场景
- Twitter CDN图片（pbs.twimg.com，网络可能超时）
- 需要高分辨率分析的场景

## sessions_spawn

### 使用场景
- 复杂任务需要独立上下文
- 需要不同模型处理的任务
- 长时间运行的后台任务

### 原则
- 不要用它替代 cron 定时任务
- 不要用它替代 subagents 管理
- 用 mode="run" 做一次性任务，mode="session" 做持久任务

## cron

### 使用场景
- 定时提醒
- 定期检查任务
- 周期性报告、夜间做梦调度

### 原则
- 一次性提醒用 schedule.kind="at"
- 周期任务用 schedule.kind="cron"
- sessionTarget="isolated" 时才能用 delivery 配置
- 不要用 wrapper payload
- **v2.0 新增**：夜间做梦任务建议 schedule.kind="cron"，expr="0 2 * * *"（每天 02:00）

## v2.0 新增：Memory Bus 工具组

### memory_add(event: MemoryEvent)
- 每个任务结束后调用（成功或失败都要记录）
- event.type 必须是合法值：user_input/agent_response/tool_call/tool_result/user_feedback/skill_execution/skill_crystallized/system_event
- entities[] 至少填 1 个
- provenance 不可断裂

### memory_query(intent: string, filters?: QueryFilter)
- 查询前先判断意图类型 → 选择合适的 layer 路由
- layer_hints 指导引擎跳过不相关层
- 不要对同一查询重复调用多 layer — 让引擎自动做 fusion

### memory_get(id: string)
- 用于加载轨迹或技能详情
- 不要在循环中批量调用 — 用 memory_query 代替

### crystallize_skill(trajectory_id: string)
- 不能被 LLM 直接调用 → 只能由 AHE 自动触发或系统调用
- 等待 LLM 生成 SKILL.md 后验证模板完整性再存储

## v2.0 新增：n8n 编排规则

### 适用场景
- 夜间做梦全流程调度（Phase 0-7）
- 外部数据 ingestion → memory bus
- 深度压缩（async TokenJuice）
- 周期性编译/Linting
- 人工审批工作流

### 不适用场景
- 热路径（memory_add/memory_query）— 必须直接在 OpenClaw plugin 层执行
- 技能发现（memory_query layer="skills"）— 延迟敏感

### n8n → OpenClaw 消息格式
```
// n8n webhook POST 到 OpenClaw memory-bus 端点
{
  "action": "memory_add",
  "event": { /* 标准的 MemoryEvent */ },
  "source": "n8n-workflow-{name}"
}
```

## 进化记录

### 2026-05-17 v2.0 升级
- 加入 Memory Bus 工具组策略（memory_add/query/get/crystallize_skill）
- 加入 n8n 编排规则（适用/不适用场景清晰分离）
- 加入 cron 夜间做梦调度建议
- 保留所有 v1.0 工具策略（已验证可用）
