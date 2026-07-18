# 千星奇域 · 结构体编辑器（Vue 3）

将千星奇域的「结构体 / 结构体变量」与 JSON 相互转换，并支持在线编辑。
参考 [ugc-struct-viewer](https://github.com/xiaomoL444/ugc-struct-viewer) 与
[在线结构体编辑器](https://tool.xiaomol444.xyz/StructViewer)，保留「工作区 / 高级数据管理 / 变量」交互步骤。

## 技术栈

- Vue 3 (`<script setup>`)
- Vite 6
- Pinia（状态管理）
- Vitest（单元测试，含真实样例交叉验证）

## 数据模型

依据真实样例（`src/samples/simple-struct.json` / `complex-struct.json` / `complex-variable.json`）：

- **结构体（定义 / schema）**：带 `name`，字段含 `key`（字段名）+ `param_type` + 嵌套 `value`
- **结构体变量（实例）**：带 `structId`，`value` 为按位置排列的纯值（无字段名）

转换关系：结构体定义 → 结构体变量 = 去掉字段名、保留类型与位置值、附加 `structId`。
支持全部 23 种参数类型（标量 / 列表 / Struct / StructList / Dict）。

## 交互模型（三层）

```
工作区（游戏存档，彼此独立，structId 可重复）
  ├─ 高级数据管理：该存档内的多个「结构体定义」（导入/导出/示例）
  └─ 自定义变量：基于结构体定义创建的多个「结构体变量」
```

编辑器采用**面包屑钻取**：每层只显示当前字段，复杂类型（列表/Struct/StructList/Dict）显示摘要并可钻入：

- **标量**（整数/浮点/布尔/向量…）：内联直接编辑
- **标量列表**：表单 ↔ 批量文本（每行一项，可与 Excel/记事本互贴）
- **结构体列表**：表格网格（整行复制）+ 批量文本 TSV（与 Excel 整块互贴）
- **字典**：键值表格 + 标量字典的键\t值批量文本
- **整体 JSON**：底部可编辑整体 JSON，整段粘贴替换后原地回写

变量按 `structId` 绑定结构体定义，字段名从定义读取；工作区自动 localStorage 持久化。

## 开发

```bash
cd struct-viewer
npm install
npm run dev      # 启动开发服务器 http://localhost:5173
npm run build    # 生产构建
npm test         # 运行交叉验证测试
```

## 核心代码

- `src/lib/miliastra.js`：结构体 ↔ 结构体变量 ↔ JSON 转换库（含全 23 种类型元数据）
- `src/stores/workspace.js`：工作区/定义/变量 三层状态与导入导出、localStorage 持久化
- `src/components/`：DefinitionsPanel / VariablesPanel / FieldEditor（面包屑）/ FrameView（分型编辑）/ ScalarValue
- `src/lib/miliastra.test.js`：用真实样例交叉验证转换正确性
