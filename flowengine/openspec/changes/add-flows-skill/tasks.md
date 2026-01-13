## 1. 需求澄清与范围
- [x] 1.1 对齐 flows skill 触发场景与输出目标，确认需覆盖的 YAML 类型（FDL 流程、GML 片段、tool-service URI 约定）。
- [x] 1.2 盘点现有规范文件（`specs/fdl-spec.md`、`specs/gml-spec.md`、`specs/tool-service.md`）中必须纳入技能提示的要点。

## 2. 技能设计与资料整理
- [x] 2.1 创建 `skills/flows` 目录，完成 SKILL.md frontmatter（name/description）与核心使用指引草稿。
- [x] 2.2 编写参考资料（references/）总结 FDL、GML、tool-service 关键格式与常见模板，避免重复长文。
- [x] 2.3 在 SKILL.md 中串联参考文件、生成流程提示、示例 YAML 片段，确保能够指导 flowengine 识别并转换画布。

## 3. 交付与验证
- [x] 3.1 自查生成流程示例（至少一个完整流程、一个工具调用节点示例），确保符合规范并可被 flowengine 导入。
- [x] 3.2 运行必要的验证/打包（如 `scripts/package_skill.py skills/flows` 或等效步骤），修正发现的问题。
- [x] 3.3 更新变更记录，准备提交评审。
