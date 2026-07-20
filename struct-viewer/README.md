# Miliastra-Structure-Editor

将千星奇域的「结构体 / 结构体变量」与 JSON 相互转换，并在网页上可视化编辑。

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
工作区（游戏存档，彼此独立，结构体索引可在不同存档重复）
  ├─ 高级数据管理：该存档内的多个「结构体定义」（新建/导入/导出）
  └─ 自定义变量：基于结构体定义创建的多个「结构体变量」
```

编辑器采用**递归直接展开 + 表格拍平**：复杂类型不再跳转页面，Struct、StructList 与 Dict 都在当前位置继续展开：

- **标量**（整数/浮点/布尔/向量…）：内联直接编辑
- **标量列表**：逐项增删和编辑，Vector3List 使用三轴输入
- **嵌套 Struct**：递归拍平成分组列，字段类型使用中文名称
- **结构体列表**：表格网格（复制/移动/删除）+ 可逆 TSV 批量文本
- **字典**：键值表格（唯一键、复制/移动/删除）+ 标量字典 TSV
- **表格列宽**：拖动任意实际字段表头右边缘自由调整
- **整体 JSON**：底部可编辑整体 JSON，整段粘贴替换后原地回写

变量按结构体索引绑定结构体定义，字段名从定义读取；定义字段变化会原子迁移到绑定变量。工作区自动防抖写入 localStorage，损坏缓存会保留 recovery 副本。

## 使用提示

- **导入方式**：结构体定义与结构体变量均支持「从文件导入」和「从 JSON 导入」两种。
- **结构体索引需手动填写**：导入或新建定义后不会自动生成索引；索引仅允许数字，并且在同一工作区内必须唯一。
- **变量绑定定义**：导入变量时，当前存档必须已存在相同结构体索引的定义；字段数量、位置类型和复合值形状均会严格校验。
- **字典键唯一**：复制字典条目时自动生成 `_1`、`_2` 后缀；JSON / TSV 导入也会拒绝重复键。
- **TSV 安全性**：支持 Tab、换行和引号转义；列表以 JSON 数组保存，解析失败时整批拒绝且不覆盖原数据。

## 开发

```bash
cd struct-viewer
npm install
npm run dev      # 启动开发服务器 http://localhost:5173
npm run build    # 生产构建
npm test         # 运行交叉验证测试
```

## 核心代码

- `src/lib/miliastra.js`：结构体 ↔ 变量 ↔ JSON 转换与严格校验（含 23 种类型元数据）
- `src/lib/flatten.js`：嵌套 Struct 拍平、路径读写和递归默认值
- `src/lib/tabular.js`：StructList / Dict / 变量表共享的无损 TSV codec
- `src/stores/workspace.js`：三层状态、schema 迁移、绑定关系和持久化恢复
- `src/components/FrameView.vue`：Struct / StructList / Dict 递归表格编辑器
- `src/directives/resizableColumns.js`：经典表格列宽拖拽指令
- `src/**/*.test.js`：转换、拍平、TSV、缓存与 store 一致性回归测试
