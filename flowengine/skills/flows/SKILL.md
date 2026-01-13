---
name: flows
description: 基于业务描述生成或校对可导入 flowengine 的流程 YAML，涵盖 FDL 流程结构、GML 映射（args/with/sets）、以及 tool-service exec URI 规范；用于快速产出/修订流程定义、节点模板与示例。
---

# 使用指南

1) 收集信息：明确流程名称/描述、输入输出、外部工具（类型与 URI）、节点逻辑与依赖。  
2) 选择模板：优先使用本技能内的示例，按需查看参考文件。  
3) 生成 YAML：采用 4 空格缩进，顶层 `flow:`，补全 `name/desp/args` 和 `node`。保持节点 `id` 唯一，起始节点为未被指向者。  
4) 填写节点：工具节点用 `exec`（遵循 tool-service URI），`args`/`with`/`only` 使用 GML，`next`/`fail` 控制跳转。  
5) 快速自查：字段/缩进正确；GML 简洁（<5 项可单行），`exec` URI 合规；确保至少一条终止路径。

## 关键提要（速览）
- FDL：`flow.name/desp/args/vars/node`；节点支持 `exec/args/with/only/next/fail` 等，缩进 4 空格。  
- GML：单值或对象构造；多行对齐，模板字符串用反引号；临时变量用 `$`，`this` 可复用已算值。  
- tool-service：`<type>://<service-id>/<tool-id>?options`；常见类型 `api|svc|mcp|db|oss|mq|mail|sms|flow|agent`。

## 参考与模板
- 查看 `references/fdl-reference.md`：FDL 结构要点与节点字段提示。  
- 查看 `references/gml-reference.md`：常用语法、格式与返回规则。  
- 查看 `references/tool-service-reference.md`：URI 规则与常见类型示例。  
- 查看 `references/examples.md`：最小可用流程示例，含工具调用与数据整形。

## 生成步骤（推荐顺序）
- 定义元信息与参数：`flow.name/desp`，`args.in/out/defs`（必要时 `vars`）。  
- 布局节点：先列主干，再补并行/条件；确保 `next` 指向已声明或后续节点。  
- 编写 GML：入参与上游上下文可直接引用；<5 项优先单行，复杂映射用多行并对齐。  
- 校验 exec：匹配 tool-service URI；数据库操作需带 `type`/方法，OSS/MQ 等注意路径/operation。  
- 输出检查：无 Tab，缩进 4 空格；节点 `id` 唯一；起始/终止路径闭合。

## 交付物格式
- 产出单个 YAML（或内联于回复代码块），可直接被 flowengine 导入。  
- 需要附带解释时，保持简短，重点标记输入输出、关键节点、外部工具 URI。
