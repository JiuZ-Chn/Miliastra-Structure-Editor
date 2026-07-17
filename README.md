# Miliastra-Tools

千星奇域（Miliastra）结构体工具集。

## 千星奇域 · 结构体编辑器（Vue 3）

将千星奇域的「结构体 / 结构体变量」与 JSON 相互转换，并支持在线编辑，位于 [struct-viewer/](struct-viewer/)。

参考 [ugc-struct-viewer](https://github.com/xiaomoL444/ugc-struct-viewer) 与
[在线结构体编辑器](https://tool.xiaomol444.xyz/StructViewer)，保留「工作区 / 高级数据管理 / 变量」交互步骤。

- 结构体（定义）↔ 结构体变量 ↔ JSON 相互转换
- 在线编辑 JSON 并反向转换回千星结构
- 用真实样例（`结构体.json` / `结构体变量.json`）做交叉验证测试

### 快速开始

```bash
cd struct-viewer
npm install
npm run dev      # 开发服务器 http://localhost:5173
npm run build    # 生产构建
npm test         # 交叉验证测试
```

详见 [struct-viewer/README.md](struct-viewer/README.md)。