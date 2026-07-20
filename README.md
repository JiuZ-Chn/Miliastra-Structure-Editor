# Miliastra-Tools

千星奇域（Miliastra）结构体工具集。

## 千星奇域 · 结构体编辑器（Vue 3）

一个纯前端工具，用于将千星奇域的「结构体 / 结构体变量」与 JSON 相互转换，并在网页上可视化编辑，位于 [struct-viewer/](struct-viewer/)。

参考 [ugc-struct-viewer](https://github.com/xiaomoL444/ugc-struct-viewer) 与
[在线结构体编辑器](https://tool.xiaomol444.xyz/StructViewer)。

### 功能特性

- **双向转换**：结构体（定义）↔ 结构体变量 ↔ 普通 JSON，无损互转
- **完整类型**：支持全部 23 种参数类型（标量 / 各类列表 / Struct / StructList / Dict）
- **三层工作区**：工作区（游戏存档）→ 结构体定义（高级数据管理）→ 结构体变量（自定义变量）
- **递归直接展开**：Struct、StructList 与 Dict 均在当前表格中直接展开
- **表格式编辑**：嵌套定长结构体自动拍平、分组显示，实际字段列支持自由拖拽宽度
- **批量编辑**：列表逐项编辑，StructList / Dict 支持可逆 TSV 批量导入导出
- **导入导出**：支持从文件、从 JSON 两种导入，一键导出 / 复制 / 下载
- **本地持久化**：工作区自动防抖保存到 localStorage，损坏缓存会保留 recovery 副本
- **交叉验证**：以真实样例（简单/复杂结构体、复杂结构体变量）做单元测试

### 快速开始

```bash
cd struct-viewer
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 生产构建
npm test         # 交叉验证测试
```

详见 [struct-viewer/README.md](struct-viewer/README.md)。