# AHE v2.0 Skill — 融合内存总线自进化系统

## 概述

AHE v2.0 是基于 **Unified Memory Bus + Skill Crystallization** 的下一代自进化框架。
核心理念来自 20 轮 Grok 设计评审 + GitHub 竞品对比：
- **v1.0 弱项**：7组件独立但缺乏互联数据流，失败分析靠 LLM 临时判断
- **v2.0 方案**：所有任务数据通过 Memory Bus 统一存储，由 Skill Crystallizer 自动固化经验
- **v2.0 优势**：每次任务不仅记录失败，更**自动结晶成功过程**为可复用技能

**这是给我自己用的，不是给用户用的。**

## 架构总览

```
任务执行 → Memory Bus (memory_add)
    ↓
成功轨迹 → Skill Crystallizer → 生成 SKILL.md → 存盘 + LanceDB索引
    ↓                   
失败轨迹 → Failure Analysis → 识别受损组件 → AHE 变异操作符
    ↓
夜间做梦 → Bulk Compilation → KG更新 + Decay打分 + 缓存预计算
```

## 触发条件

### 条件1：每个任务结束后（自动触发）

无论成功或失败，任务完成后调用 `memory_add` 记录轨迹。
- 成功 → 自动触发 Skill Crystallizer（从轨迹提取可复用步骤为 SKILL.md）
- 失败 → 触发 Failure Analysis，激活 AHE 变异操作符

### 条件2：心跳期间（定期触发）

触发信号：
- 心跳轮询，无紧急任务
- 距离上次进化 > 24小时
- 距离上次 dreaming > 8小时

执行步骤：
1. 读取 LanceDB 中上次 dreaming 之后的新事件
2. 如果新事件 > 20 条，触发轻量 dreaming（仅 Phase 1-2-4）
3. 记录 dreaming 时间戳

### 条件3：每周审查（cron触发）

触发信号：每周日 03:00 定时任务

执行步骤：
1. 运行完整夜景 dreaming 全流程（Phase 0-7）
2. 更新组件文件 + git commit 所有夜间产生的技能/知识
3. 汇总本周进化成果到 CHANGELOG.md

## 7个确定性变异操作符（AHE核心）

v2.0 不再让 LLM 临时决定改什么。每次失败后选择以下一个操作符：

| # | 操作符 | 作用目标 | 触发条件 |
|---|--------|---------|---------|
| 1 | CREATE_SKILL | skills-registry.md | 成功轨迹可复用 |
| 2 | MODIFY_SKILL | 已有 SKILL.md | 技能执行部分失败 |
| 3 | ADJUST_TOOL_POLICY | tool-policies.md | 工具调用入口错误 |
| 4 | UPDATE_ENV_KNOWLEDGE | environment.md | 环境/代理/路径变化 |
| 5 | CHANGE_WORKFLOW | workflow-patterns.md | 流程步骤遗漏/多余 |
| 6 | PRUNE_LOW_UTILITY | memory-schema.md | 低效记忆规则 |
| 7 | RESTRUCTURE_MEMORY | memory-schema.md | 记忆区分度下降 |

LLM 角色仅限于：分析失败 → 建议操作符编号 → 生成操作内容 → 由 AHE 引擎通过评分决定是否应用。

## Memory Bus 接口

### memory_add(event: MemoryEvent)
记录单个事件。包含：type, content, metadata, entities[], relations[], provenance。

### memory_query(intent: string, filters?: QueryFilter): MemoryResult[]
语义搜索 + 元数据过滤。返回按相关性+重要性衰减加权排序的结果。

### memory_get(id: string): MemoryEvent
按 ID 获取单个事件及其完整上下文。

### crystallize_skill(trajectory_id: string): SkillDefinition
从成功轨迹中提取 SKILL.md。LLM prompt 模板见 components/skill-crystallizer-prompt.md。

## 技能发现机制

存储策略（Grok R17结论）：
- **SKILL.md 文件存磁盘**（`plugins/memory-bus/skills/`），人类可读 + git可追踪
- **索引元数据存 LanceDB**（text + vector），支持语义搜索
- **UUID 为主键**，content hash 做去重

加载优先级：
1. LanceDB 语义搜索 → 找到匹配的 skill_id
2. 从磁盘加载对应 SKILL.md
3. 按 `success_count` DESC 排序返回 top-3

## 分析报告模板（v2.0增强版）

文件名：`evidence/reports/YYYY-MM-DD-HH-MM.md`

```markdown
# 任务分析报告

## 基本信息
- 时间：YYYY-MM-DD HH:MM
- 任务描述：[简述]
- 结果：SUCCESS / FAILURE / PARTIAL

## 轨迹摘要
- 步骤数：[N]
- 工具调用：[列表]
- 成功步骤：[列表]
- 失败步骤：[列表]

## 失败分析（仅FAILURE/PARTIAL）
- 现象：[用户看到了什么问题]
- 根因：[为什么会出问题]
- 涉及组件：[列出受影响的7类组件之一]
- 推荐操作符：[1-7]

## 成功结晶（仅SUCCESS）
- 是否可结晶：[Y/N]
- 结晶触发关键词：[]
- 核心过程摘要：[从轨迹提炼的关键步骤]

## 预测
- 如果应用操作符 [X]，预期：[效果]
- 风险：[可能的副作用]
- 回滚条件：[什么情况下应该回滚]
```

## 变更记录格式（v2.0增强版）

```json
{
  "timestamp": "2026-05-17T02:00:00+08:00",
  "iteration": 1,
  "operator": "CREATE_SKILL",
  "component": "skills-registry",
  "evidence": "evidence/reports/2026-05-17-01-45.md",
  "change": "从成功轨迹结晶了新技能：X文章批量分析",
  "skill_id": "a1b2c3d4-...",
  "prediction": {
    "expected_effect": "下次分析X文章时跳过手动判断，直接复制工作流",
    "skill_reuse_rate_target": ">0.5 on similar tasks",
    "at_risk": "X页面结构变化可能导致技能过时"
  }
}
```

## 组件修改规则（v2.0增强版）

1. **每次只改一个组件文件**
2. **先读后改，保留历史**
3. **git commit = 操作符 + 证据引用**
4. **预测可验证**：下次类似任务自动比对预测 vs 实际
5. **高成功技能受保护**：`success_count >= 5` 的技能需要人工确认才能修改
6. **衰减分 < 0.1 自动归档**：任务中不再加载低效技能

## 进化优先级（v2.0数据驱动）

按 Grok R10/R17 综合结论排序：
1. **Skill Crystallization** → `skills-registry.md` + 磁盘 SKILL.md（本周 MVP）
2. **Memory Bus Schema** → `memory-schema.md`（LanceDB + vector + 混合存储）
3. **Provenance Linking** → 每个事件关联来源和实体
4. **KG Compiler** → entity/relation 提取 + 4-signal 打分（R8结论：LanceDB存储）
5. **Decay Scoring** → `S(t) = Base × RecencyDecay × UtilityBoost × StreakModifier`（R4公式）
6. **Full AHE Evolution Engine** → 7操作符 + sandbox实验 + 自动回滚

## 里程碑（v2.1路线图）

- [x] Week 0：Grok 25轮设计评审完成（2026-05-17）
- [x] Week 0：tag v1.0.0 + v2.0.0-alpha + 创建 v2.0 分支 + 数据污染防御设计
- [ ] Week 1：Memory Bus 插件实现 + Skill Crystallizer + Provenance Depth Tracking
- [ ] Week 2：第一次完整进化循环（失败→操作符→验证）+ 三级隔离机制上线
- [ ] Month 1：积累 20+ 结晶技能，Skill Reuse Rate > 0.3
- [ ] Month 2：KG Compiler + Decay Scoring + 多模型对抗验证 pipeline
- [ ] Month 3：Full AHE 进化引擎（7操作符 + sandbox实验）

### 数据污染防御专项里程碑
- [x] 公式设计：S'(t) = S(t) × (1 - C)，4因子加权
- [x] isolation 三级：clean → suspicious → isolated → purged
- [x] immune 四策略：DELETE / CORRECT / FLAG / DEGRADE
- [x] 二阶防御：多模型 ensemble + 确定性规则 ground truth
- [ ] Week 1：Provenance depth 自动追踪上线（代价最小，收益最大）
- [ ] Month 2：Multi-model adversarial validation pipeline
