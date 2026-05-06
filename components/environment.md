# 组件：环境知识

> AHE 组件类型：Middleware / Environment
> 收益预期：+2.2pp（论文数据）
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

## 进化记录

<!-- AHE 进化修改在此追加 -->
