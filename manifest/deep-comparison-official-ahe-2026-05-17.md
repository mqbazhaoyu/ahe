# 深度对比：AHE（官方）vs AHE（我们）

> 分析日期：2026-05-17  
> 仓库：[Curry09/agentic-harness-engineering](https://github.com/china-qijizhifeng/agentic-harness-engineering)  
> 共同基础：arXiv:2604.25850 论文

---

## 一、概况

| 维度 | 官方 AHE（Curry09） | 我们的 AHE（mqbazhaoyu） |
|------|---------------------|-------------------------|
| 语言 | Python 98.9%（evolve.py 3000+ 行主循环） | TypeScript（MemoryBus 563 行核心） |
| 定位 | **学术实验框架**，论文官方实现 | **个人生产部署**，OpenClaw 插件生态 |
| 成熟度 | 完整可运行，有真实 benchmark 结果 | v2.1.0-alpha，核心功能有，未跑过完整闭环 |
| Star/Fork | 192 / 22 | 刚起步 |
| 沙盒 | E2B（远程云沙盒，SaaS 或自建集群） | 本地 Windows + LanceDB（不需要远程） |
| 评测框架 | Harbor（Terminal-Bench 2） | 未集成（依赖 OpenClaw 评测体系） |
| 许可证 | MIT | MIT |
| 论文效果 | Terminal-Bench 2 pass@1 69.7% → 77.0% | 未跑过 benchmark |

---

## 二、架构对比

### 官方 AHE（evolve.py）

核心循环：`evaluate → analyze → improve`

```
Phase 1: Harbor 评测（E2B 沙盒并发运行）
  ├── 多 trial 重试（k rollouts per task）
  ├── pass@k 统计（Chen et al. 无偏估计）
  └── 任务稳定性追踪（稳定通过/稳定失败/不稳定）

Phase 2: 分析层
  ├── Agent Debugger（~10M token trace → 结构化报告）
  ├── 9 状态交叉迭代变化矩阵（flipped/regressed/stable 等）
  ├── 异常类型聚类分析
  ├── 变更归因评估（预测 vs 实际）
  └── 最佳版本追踪 + auto-rollback

Phase 3: 进化
  ├── Best-of-N 并行探索（最多 N 个变体并行进化）
  ├── git worktree 隔离（每变体独立 workspace）
  ├── 变体交叉评估 → 胜者 merge
  └── 跨变体调试分析

Phase 4: 验证
  └── Post-evolve 多数据集验证
```

### 我们的 AHE（MemoryBus + Skills）

```
memory_add（摄入 → 污染评分 → LanceDB 持久化）
memory_query（关键词+语义搜索 → S'(t) 排序）
memory_get（按 UUID 检索）
crystallize_skill（轨迹 → SKILL.md）
  ├── LLM 模式（CrystallizePrompt）
  └── 模板模式（buildSkillMarkdown）
```

---

## 三、我们比他们优秀的地方

### 1. 🛡️ 数据污染防御（独家护城河）

> **他们的状态：完全没有**
>
> 官方 AHE 没有任何数据污染防御机制。Agent Debugger 的分析直接注入 Evolve Agent，不做任何可信度验证。LLM 产生的幻觉分析会直接成为下一次进化的依据。

我们的实现：
- 4 维污染评分：S'(t) = S(t) × (1-C)
- C = w₁×来源可信度 + w₂×幻觉概率 + w₃×时间衰减 + w₄×来源深度
- 1=0.4 来源 + 0.3 幻觉 + 0.15 新鲜度 + 0.15 深度)
- 3 级隔离：clean → suspicious（≥0.2）→ isolated（≥0.5）→ purged（≥0.8）
- 每次 query 自动排除 isolated/purged 事件

**意义**：在官方 AHE 中，如果 Agent Debugger 分析错了一个任务的根因，这个错误会被固化到 workspace 并持续污染后续迭代。我们没有这个问题。

### 2. 🧠 技能结晶（Skill Crystallization）

> **他们的状态：没有独立的技能抽象**
>
> 官方 AHE 的 Evolve Agent 每次都重新分析整个 workspace，没有提取可复用技能的概念。

我们的实现：
- `crystallize_skill(trajectory) → SKILL.md` 完整闭环
- 支持 LLM 生成（CrystallizePrompt）和模板生成两种模式
- 技能注册表 + LanceDB 索引 + 磁盘持久化
- 第一个结晶技能：grok-architecture-collaboration（7 条原则 + 对话模板 + 踩坑记录）

**意义**：我们先把"怎么跟外部 LLM 协作"这件事本身结晶成了技能。下次我不需要强哥提醒效率就高了。

### 3. 🔧 部署门槛——不需要云端沙盒

> **他们的状态：必须用 E2B**

官方 AHE 依赖 E2B 远程沙盒（SaaS 需付费，自建需运维）。还需要 tmux、Python 3.13+、uv 包管理器。

我们的实现：
- 本地 Windows 直接跑，不需要远程沙盒
- 依赖极简：Node.js + LanceDB + TypeScript
- LanceDB 内嵌模式，零配置持久化
- 整个系统在 OpenClaw 内部运行，不需要外部 sandbox

**意义**：强哥不需要注册 E2B、不需要配云服务，在自己的电脑上就能跑完整的 AHE。

### 4. 🎯 用户 UX 方向

> **他们的状态：完全为学术实验设计**

官方 AHE 的操作方式是 CLI + YAML 配置 + tmux 分屏。输出是 Markdown 报告和 YAML 分数表。

我们的方向：
- 在 OpenClaw 内作为插件运行，用户通过自然语言交互
- 不需要写 YAML 配置，直接说"分析今天的失败"
- 技能发现自动注入上下文

### 5. 🧪 实现简洁性

他们的 `evolve.py` 是 3000+ 行单体 Python 文件，包含所有逻辑。我们的核心 MemoryBus 只有 563 行 TypeScript + 精确定义的类型系统。

---

## 四、他们比我们优秀的地方

### 1. 🏆 完整的端到端验证

> **我们的状态：没有跑过完整进化循环**

官方 AHE 在 Terminal-Bench 2 上跑了 10 次迭代，pass@1 从 69.7% 提升到 77.0%。他们有：
- 真实的 benchmark 数据
- 跨模型迁移验证（4 个 base model）
- 论文级统计方法（Chen et al. pass@k 无偏估计）
- 飞书通知 + 迭代分数追踪

**我们应该做**：选一个 benchmark（可以用 OpenClaw 的评测体系），跑一次完整的 evaluate → analyze → improve 循环，拿到第一个数据点。

### 2. 📊 交叉迭代分析系统

> **我们的状态：没有**

他们的 9 状态变化矩阵非常精细：
```
flipped: fail→pass（改进成功）
regressed: pass→fail（退化，最高优先级）
rollout_improved: fail→fail 但更多 rollout 通过
rollout_regressed: fail→fail 但更少 rollout 通过
infra_recovered: exception→pass
infra_lost: pass→exception
stable_pass / stable_fail / exception_to_fail / fail_to_exception
```

**我们应该做**：把这个 9 状态矩阵引入我们的任务历史追踪。

### 3. 🔄 Best-of-N 并行进化

> **我们的状态：没有**

他们的 Best-of-N 机制用 git worktree 实现真正隔离的并行变体探索：
- N 个变体同时进化（不同策略方向）
- 并行 Harbor 评测
- 胜者 merge 到主干，败者打标签存档
- 跨变体 Agent Debugger 分析

**我们应该借鉴**：不需要完全的 git worktree 隔离（太重），但可以做一个轻量版的"并行实验"机制。

### 4. 🔍 Agent Debugger（轨迹分析）

> **我们的状态：没有**

他们的 Agent Debugger 是核心竞争力：
- 把 ~10M token 的原始 trace 压缩成结构化报告
- 支持命令级钻进（adb ask）
- timeout 轨迹的时序分析
- 跨变体对比分析

⚠️ 但注意：Agent Debugger 是**部分闭源**的——README 明确说"due to company strategy, it cannot be fully open-sourced at this time"。这意味着开源社区无法复现他们的完整流程。

**我们的方向**：可以做一个轻量版——用 Grok 的 R12 模板思路，让 LLM 直接分析轨迹。

### 5. 🧪 实验管理体系

> **我们的状态：没有**

他们有完整的：
- 实验配置继承（base.yaml + overlay）
- 实验目录结构（runs/iteration_NNN/）
- 分数追踪（iteration_scores.yaml + .md）
- 任务历史（task_history.json）
- 变更清单（change_manifest.json）
- 最佳版本（best_ever.json）
- 自动回滚机制

**我们应该做**：把实验管理标准化，至少有一个 `runs/` 目录结构。

### 6. 🏗️ Explore Agent（外部知识注入）

> **我们的状态：没有**

他们有一个独立的 explore agent，在迭代开始前搜索 GitHub/issues/web，把相关上下文注入 workspace。

**我们的方向**：可以用现有的 web-search skill + browser 工具实现。

---

## 五、核心架构哲学差异

| 方面 | 官方 AHE | 我们的 AHE |
|------|---------|-----------|
| 进化主体 | code_agent（编码智能体） | AI 助手（通用智能体） |
| 进化方式 | git commit + 文件修改 | LanceDB 写入 + 技能注册 |
| 评测方式 | Harbor + E2B 沙盒 | OpenClaw 内部评测 |
| 记忆系统 | 无独立记忆层（依赖 git 历史） | LanceDB 4 层记忆（L1-L4） |
| 污染处理 | 无 | 4 维评分 + 3 级隔离 |
| 知识复用 | 每次从零分析 | 技能结晶 + 语义搜索 |
| 并行策略 | git worktree（重隔离） | 不需要（单人场景） |

---

## 六、战略建议

### 立即可做的事

1. **选一个 benchmark 跑首次进化循环** — 用 OpenClaw 的评测能力，证明我们的 AHE 也能正向进化
2. **引入 9 状态变化矩阵** — 从他们的实现中直接移植，这是最有价值的分析工具
3. **标准化实验目录结构** — 借鉴他们的 `runs/iteration_NNN/` 模式
4. **在竞争分析报告中引用官方 AHE** — 同一个论文思路，我们是首个生产部署版本

### 中期可以做的事

5. **轻量 Agent Debugger** — 不需要他们的 adb CLI，直接用 LLM 分析轨迹
6. **Explore Agent** — 用 web-search skill 实现外部知识注入
7. **Best-of-N 轻量版** — 当前不需要完整隔离，但可以并行尝试多个进化策略

### 不要做的事

8. ❌ **不要复制 E2B 沙盒** — OpenClaw 不自带沙盒，我们不需要
9. ❌ **不要复制 Harbor** — 用 OpenClaw 生态的评测方式
10. ❌ **不要把 3000 行 evolve.py 翻译成 TypeScript** — 架构不同，只需要提取算法精华

---

## 七、一句话结论

**他们是一篇论文的正确实现；我们是同一思想的独立生产部署。两者互补而非竞争——他们证明了方法有效，我们证明了方法可以脱离学术环境运行。**

我们的护城河（污染防御 + 技能结晶）恰好是他们缺失的能力；他们的护城河（完整实验流程 + benchmark 验证）恰好是我们需要的。最佳策略：**引用他们、学习他们、超越他们。**
