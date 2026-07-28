# Pi/PD 引用清理任务列表

## 已完成
- [x] 修改 src/main/ 中的环境变量和路径引用
- [x] 修改 src/renderer/src/config/ 中的扩展名称
- [x] 修改 src/renderer/src/components/terminal/ 中的主题名称
- [x] 修改 src/main/prompts/ 中的模板名称
- [x] 修改 docs-site/index.md 中的引用
- [x] 修改 tests/extensionManagerWsl.test.mjs
- [x] 修改 scripts/test-pi-process-start.mjs → test-sd-process-start.mjs

## 待修复
- [ ] tests/ 目录中的测试文件（.pi/ 路径引用）
  - [ ] tests/agentManagerWslPaths.test.mjs
  - [ ] tests/agentListDisplay.test.mjs
  - [ ] tests/sessionScannerSubagents.test.mjs
  - [ ] tests/piProcessWsl.test.mjs → 重命名为 sdProcessWsl.test.mjs
  - [ ] tests/piLocator.test.mjs → 重命名为 sdLocator.test.mjs
  - [ ] tests/pi-deck-nul-redirect-fix.test.ts → 重命名为 sd-deck-nul-redirect-fix.test.ts
  - [ ] tests/extensionManagerWsl.test.mjs（还有残留）
- [ ] src/renderer/src/previewApi.ts（pi-desktop 引用）
- [ ] src/shared/types.ts（pi-global, project-pi 等）
- [ ] src/shared/ipc.ts（test-pi-proxy）
- [ ] src/renderer/src/ConfigModal.tsx（PiSkillLocation 类型）
- [ ] src/renderer/src/config/providerHeaders.ts（pi-coding-agent 标签）
- [ ] src/renderer/src/components/app/ 中的 CSS 类名（pd- 前缀）
  - [ ] SettingsModal.tsx（setting-pd-wsl-config）
  - [ ] AppParts.tsx（pd-mermaid, pd-desktop, setting-pd-path-*）
  - [ ] agentListDisplay.ts（pd-subagents 注释）
- [ ] src/main/migration/PiDeckMigration.ts（pd-desktop 引用，保留用于迁移逻辑）
- [ ] 运行 typecheck 验证
- [ ] 运行测试验证
