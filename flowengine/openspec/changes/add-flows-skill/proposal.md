# Change: 创建 flows Claude Skill 支持生成 FDL/GML/Tool-Service YAML

## Why
- 需要一份标准化的 Claude skill，帮助快速产出符合 fdl-spec、gml-spec、tool-service 规范的 YAML，便于 flowengine 导入并转换为流程画布。

## What Changes
- 设计并落地名为 `flows` 的 Claude skill（frontmatter、说明、引用资源），明确触发场景与使用流程。
- 提供可复用的参考说明，指导如何依据 `@specs/fdl-spec.md`、`@specs/gml-spec.md`、`@specs/tool-service.md` 生成合法 YAML。
- 规划校验与打包流程，确保 skill 可直接用于后续自动化。

## Impact
- Affected specs: flows-skill（新增）
- Affected code: 新增技能资源目录（计划位于 `skills/flows` 或等效路径）及相关文档/参考文件
