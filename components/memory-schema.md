# 组件：记忆结构规范 v2.0

> AHE 组件类型：Long-term Memory
> 收益预期：+5.6pp（论文数据，最高收益！）
> v2.0 改进：SQLite → LanceDB 向量存储，加入 4 层混合记忆架构，加入衰减评分

## 记忆层级（v2.0 四层架构）

### Layer 1：快速向量召回（LanceDB）
- 存储引擎：LanceDB（嵌入向量 + 富元数据）
- 延迟目标：< 1s（语义搜索）
- 用途：日常对话的即时记忆检索
- 数据：压缩后的会话摘要 + 关键决策

### Layer 2：结构化事实（SQLite FTS5 + 元数据表）
- 存储引擎：SQLite（全文本搜索 + 结构化字段）
- 用途：精确查询（按时间、类型、实体筛选）
- 数据：用户偏好、工具配置、环境变量

### Layer 3：编译知识（KG + Wiki页面）
- 存储引擎：LanceDB（kg_nodes, kg_edges 表）+ 磁盘文件（wiki/*.md）
- 用途：深度关系查询、盲点检测
- 数据：实体/关系三元组 + 编译后的知识页面
- Grok R8结论：LanceDB 做持久化，夜间做梦时加载到内存做 Louvain 聚类

### Layer 4：技能固化（SKILL.md 文件）
- 存储：磁盘 `plugins/memory-bus/skills/` + LanceDB 索引
- 用途：可复用工作流、可验证步骤
- 数据：从成功轨迹中结晶的技能文件
- Grok R17结论：文件存磁盘（人类可读+git版本），索引存LanceDB

## 统一事件总线 Schema

### MemoryEvent 完整定义
```
{
  id: string (UUID v4),
  timestamp: ISO-8601,
  type: "user_input" | "agent_response" | "tool_call" | "tool_result" 
        | "user_feedback" | "skill_execution" | "skill_crystallized" | "system_event",
  content: string,
  embedding: float[] (automatically generated on add),
  
  metadata: {
    session_id?: string,
    importance?: 0-1 (initial guess),
    layer: "vector" | "facts" | "compiled" | "skills",
    tags: string[],
    related_ids: string[]
  },

  entities?: [
    { name: string, type: string, confidence: 0-1 }
  ],
  relations?: [
    { source: string, type: string, target: string, confidence: 0-1 }
  ],

  provenance: {
    memory_id: string,
    source_event_id?: string,
    parent_skill_id?: string
  },

  compression_info: {
    light_compressed: boolean (sync, in-add),
    deep_compressed: boolean (async, n8n),
    original_tokens?: number,
    compressed_tokens?: number
  },

  routing_hints: {
    preferred_layer?: "vector" | "facts" | "compiled" | "skills",
    query_pattern?: string
  }
}
```

## 衰减评分公式（Grok R4 完整版）

```
S(t) = Base_Importance 
     × exp(-λ × days_since_last_access)           // RecencyDecay
     × (1 + 0.5 × log(1 + access_count))          // FrequencyBoost
     × (1 + 0.3 × utility_score)                   // UtilityBoost
     × (1 + 0.1 × success_streak - 0.2 × failure_streak)  // StreakModifier
     × (1 + 0.2 × graph_centrality)                // GraphBoost (from KG)
```

其中：
- λ（衰减率）= 基础 0.05/天，成功任务下调到 0.02，失败任务上调到 0.10
- utility_score = 此记忆被用于解决任务的次数 / 总访问次数
- graph_centrality = 在KG中与其他节点的连接密度

**剪枝阈值**：S(t) < 0.1 → 归档到 colder storage；0.1 ≤ S(t) < 0.3 → 可选加载；S(t) ≥ 0.3 → 始终可检索

## 技能结晶流程（Grok R11/R12 生产版）

### crystallize_skill 工作流
1. 接收 `trajectory_id`，加载 Memory Bus 中对应事件
2. 提取成功步骤（type="tool_call" 且无后续失败反馈）
3. 运行 LLM prompt（见 `components/skill-crystallizer-prompt.md`）
4. 生成 SKILL.md，验证模板完整性
5. 存盘 + LanceDB 索引 + git add

### 技能发现流程
1. `memory_query(intent, { layer: "skills" })` → 语义搜索
2. 按 success_count DESC 排序
3. 加载 top-3 SKILL.md 到 agent 上下文
4. 如果 S(t) < 0.3 的技能参与结果，降权处理

## 夜间做梦流程（Grok R3 全版）

触发：n8n cron（每天 02:00 CST）或 heartbeat 空闲检测

```
Phase 0：Snapshot（创建会话快照，标记 importance）
Phase 1：Light Compression（内存总线内同步压缩）
Phase 2：Entity/Relation Extraction → KG Update（kg_nodes + kg_edges）
Phase 3：Clustering + Synthesis（Louvain + wiki 编译）
Phase 4：Skill Crystallization（批量审查当日轨迹）
Phase 5：Pruning + Decay（计算所有记忆的 S(t)，剪枝低于阈值的）
Phase 6：Indexing + Cache Pre-computation（Rebuild向量索引、预计算查询）
Phase 7：Linting + Health Checks（断链检测、盲点标记、日志报告）
```

### 压缩策略（Grok R7 两级压缩）
- **Light compression（同步）**：memory_add 时立即执行，快速启发式 + 小模型总结
- **Deep compression（异步）**：n8n 触发，TokenJuice 风格深度压缩（批量 + 重试），完成后更新 LanceDB 记录

## 记忆写入规则

### 必须写入的场景
- 用户说"记住"/"remember" → 立即 memory_add（importance=0.9）
- 做了重要决策 → memory_add（importance=0.7）
- 任务成功 → memory_add（type="skill_execution"）
- 任务失败 → memory_add（type="user_feedback"）+ 触发 Failure Analysis

### 写入原则（v2.0）
1. **每条事件带实体**：entities[] 必填，至少1个
2. **溯源链不断**：provenance 字段记录来源事件ID
3. **两层压缩**：同步先压一次，异步深处再压一次
4. **初始重要性可以后续重估**：夜梦时会自动调整

## 进化记录

### 2026-05-17 v2.0 升级
- 加入 LanceDB 为 L1 存储引擎（替换 SQLite-only 方案）
- 加入 Memory Bus 统一事件 Schema
- 加入衰减评分公式（Grok R4 完整版）
- 加入技能结晶 + 夜间做梦流程
- 加入两级压缩策略（Light sync + Deep async via n8n）
- 加入 KG 编译 + Louvain 聚类（LanceDB 持久、内存算法）
- Grok R8结论：KG nodes/edges 存 LanceDB，夜间做梦时加载到内存运算
- Grok R17结论：SKILL.md 存磁盘，索引存 LanceDB；UUID 为主键；先 bulk 编译后 per-skill
