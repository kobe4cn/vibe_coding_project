## ADDED Requirements

### Requirement: 提供 flows Claude skill 生成流程 YAML
Skill `flows` SHALL 指导生成符合 `fdl-spec`、`gml-spec` 与 `tool-service` 规范的 YAML，能够被 flowengine 直接导入并转换为流程画布。

#### Scenario: 用户请求创建流程 YAML
- **WHEN** 用户描述业务流程并要求生成可导入的流程定义
- **THEN** skill 提示使用 FDL 结构编排节点、使用 GML 填充 `args/with/sets`，并为外部调用选择符合 tool-service URI 规范的 `exec`
- **AND** 输出的 YAML 符合缩进与字段要求，包含流程元信息、节点定义及必要的输入输出参数

### Requirement: flows skill 提供规范导航与模板示例
Skill SHALL 在 SKILL 文档中明确引用 `@specs/fdl-spec.md`、`@specs/gml-spec.md`、`@specs/tool-service.md`，并提供最小可用示例与常见节点模板，方便快速落地。

#### Scenario: 用户需要确认规范细节
- **WHEN** 用户需要了解字段约束或编写参考
- **THEN** skill 指向上述规范文件或内置参考摘要，提供至少一个完整 FDL 流程示例及一个工具调用节点示例作为模板
