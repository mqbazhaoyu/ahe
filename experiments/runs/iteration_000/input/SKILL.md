# AHE v3.0 — 平台无关自进化框架

> **核心差异化标签**：🔌 OpenClaw 原生集成 × 🛡️ 污染防火墙 × 🧠 技能结晶  
> 基于 Grok 25+ 轮设计评审 + 官方 AHE 深度对比 + Hermes 跨平台战略  
> v3.0.0-alpha — 2026-05-17

## 概述

AHE v3.0 从 v2.x 的"文件驱动轻量版"升级为**能跑完整进化闭环的生产级系统**。

三层架构：
- **AHE Core（平台无关）**：污染防火墙 + 技能结晶 + 9状态矩阵 + 实验管理
- **AHE Adapter（适配层）**：OpenClaw / Hermes / Claude Code 适配器
- **AHE Runtime（运行时）**：CLI（`ahe evolve`）+ API + 自然语言

## v3.0 架构：四层基础设施 + L0 集成层

```
┌─────────────────────────────────────────────────────────┐
│  L0: OpenClaw Integration Layer                          │
│  事件监听  │  失败自动触发  │  技能自动注册  │  命令解析   │
├─────────────────────────────────────────────────────────┤
│  L1: MemoryBus (LanceDB) — 统一内存总线（增强）           │
│  L2: ExperimentManager — 实验管理器（状态机+事件驱动）      │
│  L3: TraceAnalyzer — 轨迹分析器（可插拔后端）              │
│  L4: ContaminationFirewall — 污染防火墙中间件（增强）       │
└─────────────────────────────────────────────────────────┘
```

## v3.0 进化循环

```
Phase 1 Evaluate（评测）→ Phase 2 Analyze（分析）→ Phase 3 Improve（进化）
     ↓                        ↓                        ↓
  实验管理                  轨迹分析                  变更引擎
  (ExperimentManager)      (TraceAnalyzer)          (7个变异操作符)
```

## 9 状态交叉迭代分析矩阵

从官方 AHE 直接移植，每次迭代后自动计算：

| 状态 | 含义 | 优先级 |
|------|------|--------|
| flipped | fail → pass | ✅ 改进成功 |
| regressed | pass → fail | 🚨 最高优先级 |
| stable_pass | pass → pass | ✅ 持续稳定 |
| stable_fail | fail → fail | ⚠ 持续失败 |
| infra_recovered | exception → pass | 🔧 基础设施恢复 |
| infra_lost | pass → exception | 🔧 基础设施丢失 |
| exception_to_fail | exception → fail | ⚠ 二次退化 |
| fail_to_exception | fail → exception | ⚠ 异常升级 |
| exception_stable | exception → exception | ❌ 持续异常 |

## 污染防火墙 2.0（中间件）

所有 MemoryBus 读写经过防火墙：
- 4维评分公式：S'(t) = S(t) × (1-C)，w₁=0.4(来源) + w₂=0.3(幻觉) + w₃=0.15(新鲜度) + w₄=0.15(深度)
- 3级隔离：clean(<0.2) → suspicious(≥0.2) → isolated(≥0.5) → purged(≥0.8)
- 多模型交叉验证：suspicious 事件用 2+ 模型重新验证
- 污染传播图：上游 contaminated → 下游自动降权
- 验证衰减：τ=7天半衰期，超时自动标记

## 技能结晶 2.0

- 自动触发（任务成功后自动结晶，不需要手动调用）
- 技能对比去重（结晶前检查是否已有类似技能）
- 技能效果追踪（记录每次复用的成功/失败）
- 技能演化链（追踪技能的完整修改历史）
- A/B 测试（同任务用老技能 vs 新技能对比）

## 触发条件

### 任务结束后（自动）
- 成功 → 自动 Skill Crystallizer 2.0
- 失败 → TraceAnalyzer 分析 + AHE 变异操作符

### 心跳期间（定期）
- 无紧急任务 + 距上次进化 > 24h
- 主动探索：分析 patterns.md 高频失败模式

### 每周审查（cron）
- 每周日 03:00 全流程 dreaming
- 更新组件 + git commit + CHANGELOG

## 文件结构

```
ahe/
├── SKILL.md                    # 本文件 — 进化规则
├── CHANGELOG.md                # 版本变更记录
├── README.md                   # 项目说明
├── LICENSE                     # MIT
├── components/                 # 7类支架组件
│   ├── environment.md
│   ├── delegation-rules.md
│   ├── memory-schema.md
│   ├── skill-crystallizer-prompt.md
│   ├── skills-registry.md
│   ├── system-rules.md
│   ├── tool-policies.md
│   └── workflow-patterns.md
├── plugins/memory-bus/         # 核心实现
│   ├── index.ts                # MemoryBus（含 computeChangeMatrix）
│   ├── types.ts                # 核心类型
│   ├── types_v3.ts             # v3.0 扩展类型
│   ├── experiment-manager.ts   # 实验管理器
│   ├── trace-analyzer.ts       # 轨迹分析器
│   ├── contamination-firewall.ts # 污染防火墙中间件
│   ├── openclaw-integration.ts # L0 集成层
│   └── skills/                 # 结晶技能
├── experiments/                # 实验管理
│   ├── configs/
│   ├── runs/
│   ├── task_history.json
│   ├── iteration_scores.yaml
│   └── best_ever.json
├── manifest/                   # 分析报告
│   ├── changes.jsonl
│   ├── verdicts.jsonl
│   ├── v3.0-evolution-plan-2026-05-17.md
│   ├── deep-comparison-official-ahe-2026-05-17.md
│   ├── competitive-analysis-2026-05-17.md
│   └── grok-10-rounds-summary-2026-05-17.md
├── evidence/
│   ├── patterns.md
│   └── reports/
└── data/lancedb/               # LanceDB 持久化
```

## 里程碑

| 里程碑 | 内容 | 目标 |
|--------|------|------|
| v3.0-alpha | 实验管理器 + 9状态矩阵 + 轨迹分析 + L0集成 | Week 2 |
| v3.0-beta | 污染防火墙2.0 + 技能结晶2.0 | Week 3 |
| v3.0-rc | 首次benchmark有正向提升 | Week 4-5 |
| v3.0 | 一键运维 + 主动探索 + A/B测试 | Month 2 |
| v4.0 | 独立npm包 + Hermes适配 + Claude适配 | TBD |
