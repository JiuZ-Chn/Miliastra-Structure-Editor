# Miliastra-Structure-Editor

将千星奇域的「结构体 / 结构体变量」与 JSON 相互转换，并在网页上可视化编辑。

**在线体验：<https://jiuzx.github.io/Miliastra-Structure-Editor/>**

## 功能特性

- **双向转换**：结构体（定义）↔ 结构体变量 ↔ 普通 JSON，无损互转
- **完整类型**：支持全部 23 种参数类型（标量 / 各类列表 / Struct / StructList / Dict）
- **三层工作区**：工作区（游戏存档）→ 结构体定义（高级数据管理）→ 结构体变量（自定义变量）
- **递归直接展开**：Struct、StructList 与 Dict 均在当前表格中直接展开
- **表格式编辑**：嵌套定长结构体自动拍平、分组显示，实际字段列支持自由拖拽并自动记忆宽度
- **批量编辑**：列表逐项编辑，StructList / Dict 支持可逆 TSV 批量导入导出
- **导入导出**：支持从文件、从 JSON 两种导入，一键导出 / 复制 / 下载
- **本地持久化**：工作区自动防抖保存到 localStorage，损坏缓存会保留 recovery 副本
- **交叉验证**：以真实样例（简单/复杂结构体、复杂结构体变量）做单元测试

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
- **表格列宽**：拖动任意实际字段表头右边缘自由调整，重新展开或刷新页面后自动恢复
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
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 生产构建
npm test         # 交叉验证测试
```

## GitHub Pages

项目通过 [`.github/workflows/vite-gh-pages.yml`](.github/workflows/vite-gh-pages.yml) 使用 Node.js 和 Vite 自动构建并部署静态站点。

首次使用时，在仓库的 **Settings → Pages → Build and deployment** 中将 Source 设为 **GitHub Actions**。之后每次推送到 `github-pages`，工作流都会依次运行测试、构建并发布 `dist`；也可以在 Actions 页面手动触发。