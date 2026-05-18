# AHE: Agentic Harness Engineering

> **一个能自我进化的 AI Agent 框架**  
> 论文：arXiv:2604.25850 | 许可证：AGPL-3.0 + Commercial  
> v3.1.0-phoenix-alpha — 2026-05-18

---

## 🎯 核心差异化

| 标签 | 能力 | 说明 |
|------|------|------|
| 🔌 | **OpenClaw 原生集成** | 失败自动触发进化 + 进化结果自动注册为 skill |
| 🛡️ | **污染防火墙（首家）** | 4维评分 + 3级隔离 + 污染传播图 |
| 🧠 | **技能结晶** | 任务轨迹 → 可复用技能，带版本演化和 A/B 测试 |
| 📊 | **9 状态变化矩阵** | 移植自官方 AHE，每次迭代自动分析 |
| 🔄 | **跨平台适配** | OpenClaw → Hermes → Claude Code 三层架构 |

## 🏗️ 架构

```
L0: OpenClaw Integration Layer (事件监听 + 自动触发 + 命令解析)
L1: MemoryBus (LanceDB — 统一内存总线)
L2: ExperimentManager (状态机 + 实验管理 + 自动回滚)
L3: TraceAnalyzer (可插拔后端 — LLM / 规则 / 混合)
L4: ContaminationFirewall (中间件 — 所有读写必经)
```

## 🚀 快速开始

```bash
# CLI (coming soon)
ahe status          # 查看进化状态
ahe evolve          # 触发进化循环
ahe analyze         # 分析最近失败
ahe rollback        # 回滚到上一版本
```

**OpenClaw 自然语言（当前）**：
- "AHE，分析今天的失败"
- "AHE，跑实验"
- "AHE，回滚"

## 📂 项目结构

```
ahe/
├── components/          # 7类支架组件（可观测的进化单元）
├── plugins/memory-bus/  # 核心实现
│   ├── index.ts                 # MemoryBus（含 computeChangeMatrix）
│   ├── types.ts / types_v3.ts   # 类型系统
│   ├── experiment-manager.ts    # 实验管理器
│   ├── trace-analyzer.ts        # 轨迹分析器
│   ├── contamination-firewall.ts # 污染防火墙
│   ├── openclaw-integration.ts  # L0 集成层
│   └── skills/                  # 结晶技能
├── experiments/         # 实验管理
├── manifest/            # 分析报告 + 方案文档
├── evidence/            # 证据和模式
└── data/lancedb/        # LanceDB 持久化
```

## 🛤️ 路线图

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| v2.1.0-alpha | MemoryBus + 技能结晶 + 污染防御 | ✅ |
| v3.0.0-alpha | 实验管理 + 9状态矩阵 + 轨迹分析 | ✅ |
| v3.0-beta | 污染防火墙2.0 + 技能结晶2.0 | 🚧 |
| v3.0-rc | 首次 benchmark 正向提升 | 📋 |
| v4.0 | 独立 npm 包 + 多平台适配 | 📋 |

## 📚 关键文档

- [v3.0 进化方案](manifest/v3.0-evolution-plan-2026-05-17.md) — 完整技术规划
- [官方 AHE 深度对比](manifest/deep-comparison-official-ahe-2026-05-17.md) — 与论文官方实现的差异
- [竞品分析](manifest/competitive-analysis-2026-05-17.md) — OpenSpace / EvoAgentX / GenericAgent / Hermes
- [Grok 25轮设计评审](manifest/grok-10-rounds-summary-2026-05-17.md) — 架构设计全过程

## 🔗 相关链接

- 官方 AHE（论文实现）：[github.com/china-qijizhifeng/agentic-harness-engineering](https://github.com/china-qijizhifeng/agentic-harness-engineering)
- 论文：[arXiv:2604.25850](https://arxiv.org/abs/2604.25850)

## 📄 License

**AGPL-3.0 + Commercial License Addendum**

AHE is free for **non-commercial use** — personal projects, open-source tools,
academic research, hobby tinkering. No strings attached.

If you use AHE in a **commercial product, SaaS platform, or proprietary system**,
you need a commercial license. This is how we sustain the project.

> 👉 **Short version**: Play with it, build with it, learn from it — **free**.
>   Sell it as a product or service? We need to [talk](https://github.com/mqbazhaoyu/ahe/issues).

© 2026 mqbazhaoyu
