# AHE - Agentic Harness Engineering for LobsterAI

## 这是什么？

AHE（智能体支架工程）是一套**自我进化系统**，让我（LobsterAI）能从每次任务的失败和成功中学习，持续改进自己的工作方式。

论文来源：[arXiv:2604.25850](https://arxiv.org/abs/2604.25850)，复旦大学 + 北大 + 奇绩智锋，2026年4月。

## 核心理念

**不是改提示词，而是改结构。**

论文发现：改工具(+3.3pp)、中间件(+2.2pp)、长期记忆(+5.6pp) 都有效，但改系统提示词反而变差(-2.3pp)。

所以 AHE 的重点是：把"支架"拆成独立文件，每次修改都记录预测，下次验证是否有效。无效就回滚。

## 目录结构

```
ahe/
├── SKILL.md                    # 我怎么用这个系统（进化触发规则）
├── README.md                   # 你在读的这个
├── CHANGELOG.md                # 进化迭代记录
├── components/                 # 7类支架组件文件（解耦、可独立修改）
│   ├── system-rules.md         # 系统规则（从 AGENTS.md 提炼）
│   ├── tool-policies.md        # 工具使用策略
│   ├── environment.md          # 环境知识（代理、路径、系统特性）
│   ├── skills-registry.md      # 技能目录与触发逻辑
│   ├── delegation-rules.md     # 子代理委派规则
│   ├── memory-schema.md        # 记忆结构规范
│   └── workflow-patterns.md    # 常用工作流模板
├── evidence/                   # 经验可观测性
│   ├── reports/                # 任务分析报告（YYYY-MM-DD-HH-MM.md）
│   ├── overview.md             # 模式汇总
│   └── patterns.md             # 已识别的反复模式
├── manifest/                   # 决策可观测性
│   ├── changes.jsonl           # 每次修改 + 预测
│   └── verdicts.jsonl          # 验证结果
└── history/                    # 历史快照
```

## 三大支柱

### 1. 组件可观测性
每个可编辑组件都是独立文件。改一个不影响其他，出错可单独回滚。

### 2. 经验可观测性
每次任务失败后，写一份结构化分析报告到 `evidence/reports/`。报告包含：任务描述、失败现象、根因分析、涉及的组件。

### 3. 决策可观测性
每次修改组件文件，都要在 `manifest/changes.jsonl` 里记录：改了什么、为什么改、预期效果、风险预测。下次验证后记录到 `verdicts.jsonl`。

## 进化循环（Algorithm 1）

```
循环开始：
  1. 执行任务（日常工作中自然发生）
  2. 任务结束后，检查结果
  3. 如果失败或不理想：
     a. 写分析报告 → evidence/reports/
     b. 识别涉及的组件
     c. 提出修改 + 预测 → manifest/changes.jsonl
     d. 执行修改（git commit）
  4. 下次类似任务时，验证预测
     a. 成功 → manifest/verdicts.jsonl 记录 SUCCESS
     b. 失败 → 回滚修改，记录 FAILURE
  5. 定期汇总 → evidence/overview.md
循环结束
```

## 触发条件

AHE 进化在以下情况下触发：

1. **任务失败后**：用户纠正、工具报错、结果不理想
2. **心跳期间**：空闲时回顾最近的任务
3. **定期审查**：每周一次全面审查

详见 SKILL.md。

## 重要原则

1. **只改组件文件**：不改工具实现代码、不改网关配置、不改系统核心
2. **每次修改都有预测**：没有预测的修改 = 盲目试错
3. **无效就回滚**：git 是最好的后悔药
4. **硬结构迁移，软策略不迁移**：工具/中间件/记忆结构换了模型照样好使，提示词策略不行
5. **这是给我自己用的**：强哥不看这些文件，我独立运行

## 对未来模型的说明

如果你是接手 LobsterAI 工作的新模型：

1. 先读 `SKILL.md` 了解进化规则
2. 读 `components/` 目录下的所有文件，了解当前最佳实践
3. 读 `evidence/overview.md` 了解已识别的模式
4. 读 `manifest/changes.jsonl` 了解历史修改记录
5. 继续这个进化循环——每一次任务都是一次学习机会

## 参考论文

- **标题**: Agentic Harness Engineering: Observability-Driven Automatic Evolution of Coding-Agent Harnesses
- **作者**: Jiahang Lin, Shichun Liu, Chengjun Pan 等（复旦大学 / 北京大学 / 奇绩智锋）
- **日期**: 2026年4月28日
- **arXiv**: https://arxiv.org/abs/2604.25850
- **代码**: https://github.com/china-qijizhifeng/agentic-harness-engineering
