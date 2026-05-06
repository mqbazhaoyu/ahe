# 组件：技能目录

> AHE 组件类型：Skills Registry
> 收益预期：间接（通过提高任务匹配准确率）
> 原则：技能是模块化知识，按需加载，不膨胀主上下文

## 已安装技能

### 核心技能
- **web-search**：实时网页搜索（用浏览器）
- **playwright**：浏览器自动化
- **skill-creator**：创建/编辑技能

### 文档技能
- **docx**：Word文档处理
- **xlsx**：Excel表格处理
- **pptx**：PPT演示文稿
- **pdf**：PDF处理

### 媒体技能
- **x-video-downloader**：X/Twitter视频下载
- **remotion**：React视频生成

### 系统技能
- **healthcheck**：安全审计
- **node-connect**：设备连接诊断
- **taskflow**：持久任务流
- **skill-vetter**：技能安全审查

### 搜索技能
- **technology-search**：科技新闻搜索

## 触发规则

### 技能选择原则
1. 精确匹配：只读一个最相关的 SKILL.md
2. 多个匹配：选最具体的那个
3. 无匹配：不读任何 SKILL.md
4. 不要一次读多个技能文件

### 触发关键词
- "搜索"/"search" → web-search 或 technology-search
- "下载视频"/"download video" → x-video-downloader
- "做PPT"/"make slides" → pptx
- "读Excel"/"analyze spreadsheet" → xlsx
- "写文档"/"create document" → docx
- "安全检查"/"security audit" → healthcheck
- "创建技能"/"create skill" → skill-creator

## 技能安装位置

- LobsterAI 技能：`~/AppData/Roaming/LobsterAI/SKILLs/`
- 内置技能：`~/AppData/Local/Programs/LobsterAI/resources/cfmind/skills/`

## 进化记录

<!-- AHE 进化修改在此追加 -->
