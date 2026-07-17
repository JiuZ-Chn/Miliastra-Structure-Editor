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

依据真实样例（仓库根目录 `结构体.json` / `结构体变量.json`）：

- **结构体（定义 / schema）**：带 `name`，字段含 `key`（字段名）+ `param_type` + 嵌套 `value`
- **结构体变量（实例）**：带 `structId`，`value` 为按位置排列的纯值（无字段名）

转换关系：结构体定义 → 结构体变量 = 去掉字段名、保留类型与位置值、附加 `structId`。

## 交互步骤

- **工作区**：以表单方式编辑结构体字段（字段名 / 类型 / 值 / 排序 / 增删）
- **高级数据管理**：导入 JSON（智能识别定义或变量）、实时导出结构体与结构体变量 JSON、复制 / 下载
- **变量**：查看结构体变量的按位置数据与 `structId`，实时预览变量 JSON

## 开发

```bash
cd struct-viewer
npm install
npm run dev      # 启动开发服务器 http://localhost:5173
npm run build    # 生产构建
npm test         # 运行交叉验证测试
```

## 核心代码

- `src/lib/miliastra.js`：结构体 ↔ 结构体变量 ↔ JSON 转换库
- `src/stores/workspace.js`：工作区状态与导入/导出动作
- `src/components/`：三个交互面板与参数值编辑器
- `src/lib/miliastra.test.js`：用真实样例交叉验证转换正确性
