# 组件：环境知识 v2.0

> AHE 组件类型：Middleware / Environment
> 收益预期：+2.2pp（论文数据）
> v2.0 改进：加入 LanceDB 存储路径 + 技能磁盘路径 + plugin 目录 + n8n 端点
> 原则：环境知识是硬结构，换了模型照样好使

## 代理配置

### Clash 代理
- 地址：http://127.0.0.1:7890
- 用途：访问 Twitter/X、GitHub 等需要代理的网站
- 注意：web_fetch 默认不走代理，需要配置

### SSRF 修复
- 问题：OpenClaw 的 web_fetch 可能被 SSRF 保护拦截
- 修复脚本：`D:\longxiaqiang\tools\scripts\fix-ssrf-proxy.py`
- 临时方案：用 browser 工具替代 web_fetch

## 文件系统

### 工作空间
- 主目录：`D:\longxiaqiang\`
- 工具目录：`D:\longxiaqiang\tools\`
- 项目目录：`D:\longxiaqiang\强哥项目\`
- 一世独尊：`D:\longxiaqiang\一世独尊\`

### 搜索工具
- es.exe (Everything)：`D:\longxiaqiang\tools\skills\es\es.exe`
- Everything 必须在运行中（任务栏右下角）
- 找文件先试 es.exe，不要用 Get-ChildItem

### 常用脚本
- fix-ssrf-proxy.py：`D:\longxiaqiang\tools\scripts\fix-ssrf-proxy.py`
- xleas：`D:\longxiaqiang\tools\scripts\xleas\`
- toutiao-reader CDP脚本：`D:\longxiaqiang\tools\scripts\toutiao-reader.js`

## 系统特性

### PowerShell
- 用法：直接执行，不用 cmd /c 包装
- 注意：mkdir 不支持多路径参数，用 New-Item

### 网络
- 强哥的机器需要代理才能访问外网
- pbs.twimg.com (Twitter CDN) 可能超时
- GitHub 可以直连

### 时间
- 时区：Asia/Shanghai (UTC+8)
- 心跳间隔：~30分钟
- 深夜（23:00-08:00）除非紧急否则不打扰

## v2.0 新增：AHE 存储路径

### Memory Bus
- 主数据库：`D:\longxiaqiang\tools\ahe\data\memory-bus.lancedb\`
- 向量索引：LanceDB 内嵌（无需单独服务）
- SQLite 数据库：`D:\longxiaqiang\tools\ahe\data\facts.db`

### 技能存储
- 静态技能：`~/AppData/Roaming/LobsterAI/SKILLs/`（LobsterAI 内置）
- 结晶技能：`D:\longxiaqiang\tools\ahe\plugins\memory-bus\skills\`
- 技能索引：LanceDB `skills_index` 表

### KG 存储（推迟到 Month 2）
- kg_nodes 表：LanceDB（持久化）
- kg_edges 表：LanceDB（持久化）
- 夜间做梦时加载到内存做 Louvain 聚类

###插件目录
- Memory Bus 入口：`D:\longxiaqiang\tools\ahe\plugins\memory-bus\index.ts`
- 类型定义：`D:\longxiaqiang\tools\ahe\plugins\memory-bus\types.ts`
- 嵌入函数：`D:\longxiaqiang\tools\ahe\plugins\memory-bus\embed.ts`
- 技能结晶：`D:\longxiaqiang\tools\ahe\plugins\memory-bus\crystallize.ts`

### n8n 编排
- n8n 端点（假设）：`http://localhost:5678/webhook/ahe-{workflow-name}`
- 夜间做梦触发：n8n cron → memory-bus internal hook → 启动 Phase 0-7
- 深度压缩：n8n webhook → compressor plugin → 更新 LanceDB 记录

## 进化记录

### 2026-05-17 v2.0 升级
- 加入 LanceDB 存储路径（主数据库 + 技能索引 + KG 表）
- 加入技能磁盘路径（静态 + 结晶）
- 加入 plugin 目录结构（memory-bus 入口 + 类型 + 嵌入 + 结晶）
- 加入 n8n 编排端点
- 保留所有 v1.0 环境知识（代理/文件系统/系统特性）
