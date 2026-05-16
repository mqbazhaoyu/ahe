# AHE 进化日志

## 迭代3：v2.1.0-alpha 功能代码 + 首次技能结晶（2026-05-17）

### 代码实现
- `plugins/memory-bus/index.ts`：MemoryBus 完整实现（memory_add/query/get/crystallize_skill）
- LanceDB 真实持久化（events/skills/kg_nodes/kg_edges 4 张表）
- 污染防御评分：S'(t) = S(t) × (1 - C)，4 维加权（w₁=0.4 来源 + w₂=0.3 幻觉 + w₃=0.15 陈旧 + w₄=0.15 深度）
- 3 级隔离：clean → suspicious → isolated
- 5 个测试场景全部通过：用户源/LLM低置信度/链式污染/语义查询/陈旧度
- TypeScript `npx tsc --noEmit` 零错误
- `.gitignore` 排除 node_modules

### 首次技能结晶
- 结晶技能：`grok-architecture-collaboration`（plugins/memory-bus/skills/grok-architecture-collaboration.md）
- 来源：2026-05-17 与 Grok 25 轮架构对话
- 内容：7 条核心原则 + 对话结构模板 + 踩坑记录 + 产出标准
- 意义：AHE 系统首次成功运行「经验 → SKILL.md」技能结晶循环

### 竞争分析
- 完整竞品分析报告：`manifest/competitive-analysis-2026-05-17.md`
- 覆盖：OpenSpace、EvoAgentX、GenericAgent、Hermes
- AHE 独特护城河：数据污染防御系统（所有竞品均缺失）

---

## 迭代2：v2.1 污染防御 + 竞争分析（2026-05-17）

### 数据污染防御系统
- Grok R21-R25 设计（5 轮）
- 污染评分公式：C = w₁×source + w₂×hallucination + w₃×staleness + w₄×depth
- 3 层检测（摄入前/结晶后/定期复检）
- 4 策略免疫响应（DELETE/CORRECT/FLAG/DEGRADE）
- 2 阶防御（多模型集成 + 确定性规则 + 人机协同）
- 识别「静默成功毒化」为最危险模式

### 竞争分析报告
- 完整分析：OpenSpace（云共享领先但无污染防御）、EvoAgentX（多智能体互补）、GenericAgent（理念最接近但无验证）、Hermes（仅提示词进化）
- 战略定位：用污染防御作为独特护城河，与 OpenSpace 合作而非竞争

---

## 迭代1：v2.0 Fusion Memory Bus（2026-05-17）

### 变更来源
- Grok 20轮设计评审（URL: https://grok.com/c/71b70411-43a5-43bc-a197-c6cf59959760）
- GitHub 竞品对比（Reflexio, TrinityClaw, Memvid, verified-capability-evolver, Membrane）
- arXiv:2604.25850 论文原始发现（改提示词 -2.3pp，改记忆结构 +5.6pp）

### 架构升级
- 从 7 组件独立文件 → Unified Memory Bus + Skill Crystallization 融合架构
- 加入 LanceDB 作为 L1 向量存储引擎（替换纯 SQLite 方案）
- 加入 4 层混合记忆：L1向量/L2事实/L3知识图谱/L4技能
- 加入衰减评分公式 S(t)（Grok R4 完整版）

### 新增组件
- `components/skill-crystallizer-prompt.md`：生产级 LLM 提示词模板（Grok R12）

### 升级组件
- `SKILL.md`：v1 论文框架 → v2 融合架构版（7操作符 + 3触发条件 + 5里程碑）
- `memory-schema.md`：静态记忆层级 → LanceDB 4层混合 + 衰减 + 夜间做梦全流程
- `skills-registry.md`：静态目录 → 动态技能生命周期（创建/发现/执行/衰减/剪枝）
- `system-rules.md`：加入 Memory Bus 调用规则 + AHE 操作符优先级 + LLM 操作限制
- `workflow-patterns.md`：从 6 模式 → 10 模式（加入漫剧制作、Memory Bus写入、夜间做梦、技能结晶）
- `tool-policies.md`：加入 memory_bus 工具组 + n8n 编排规则 + crystallize_skill 策略
- `environment.md`：加入 LanceDB 存储路径 + 技能磁盘路径 + plugin 目录 + n8n 端点

### 关键设计决策（Grok 确认）
- R2：提取算法不粘贴桌面应用 → "dramatically better"
- R6：Week 1 MVP = Skill Crystallization Pipeline
- R7：压缩分两级 — Light sync（in-add）+ Deep async（n8n）
- R8：KG 节点/边存 LanceDB，夜间做梦时加载内存做 Louvain 聚类
- R9：AHE 进化用 7 操作符确定性核心 + LLM 助手模式
- R10：Top-3 必做（总线/结晶/溯源），Top-3推迟（KG/衰减/完整AHE）
- R13：B 选项 — AHE 作为 meta-layer 通过操作符变异 memory bus
- R17：SKILL.md 存磁盘 + LanceDB 索引，UUID 主键，先 bulk 后 per-skill

### 里程碑更新
- [x] v1.0.0 baseline tagged（2026-05-17 01:46）
- [x] v2.0 分支创建（v2.0-fusion-memory-bus）
- [x] 全部 7+1 组件文件升级完成
- [ ] Week 1：Memory Bus Plugin 代码实现
- [ ] Week 2：第一次完整 AHE v2.0 进化循环

### 回退方案
- `git checkout v1.0.0` → 回到原始 7 组件骨架
- `git checkout master` → 回到去年 5 月 6 日初始化
- 所有 v2.0 变更在 v2.0-fusion-memory-bus 分支，未合并 main 前不污染主干

---

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
