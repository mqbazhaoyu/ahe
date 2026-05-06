# AHE 进化日志

## 迭代0：初始化（2026-05-06）

- 创建 AHE 系统目录结构
- 初始化 7 类组件文件：
  - system-rules.md：从 AGENTS.md 提炼核心规则
  - tool-policies.md：工具使用策略（web_fetch/browser/exec 等）
  - environment.md：环境知识（代理、路径、系统特性）
  - skills-registry.md：技能目录与触发逻辑
  - delegation-rules.md：子代理委派规则
  - memory-schema.md：记忆结构规范
  - workflow-patterns.md：常用工作流模板
- 初始化证据库（evidence/）
- 初始化变更记录（manifest/）
- 建立 git 版本控制

### 种子来源
- 论文：[arXiv:2604.25850](https://arxiv.org/abs/2604.25850)
- 当前 AGENTS.md、TOOLS.md、MEMORY.md 内容
- X 帖子研究中积累的经验

### 组件基线
- system-rules.md：5条核心规则 + 不做清单 + 安全规则
- tool-policies.md：web_fetch/browser/exec/image/sessions_spawn/cron 使用策略
- environment.md：代理配置、文件系统、系统特性
- skills-registry.md：15个已安装技能的目录
- delegation-rules.md：委派场景、方式、约束
- memory-schema.md：4层记忆结构
- workflow-patterns.md：6个常用工作流模式
