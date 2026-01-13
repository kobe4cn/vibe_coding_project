# FDL 要点速查

- 顶层：`flow.name/desp/args/vars/node`，缩进统一 4 空格，注释用 `#`。  
- `args`：`in/out/defs`，可简写 `out: string`；可空 `?`，数组 `Type[]`，默认值 `= <expr>`。  
- 变量：节点输出自动以 `id` 命名；`vars` 可定义全局变量。  
- 节点通用字段：`name`、`exec`（工具调用）、`args`（GML 入参）、`with`（GML 输出整形）、`only`（执行条件）、`next`（后继，多值逗号）、`fail`（异常跳转）。  
- 起始/终止：未被指向者为起始；无 `next/then/else` 为终止；引擎在所有终止节点完成后结束。  
- 子流程：`each/loop` 的内部 `node` 遵循同级作用域规则，禁止跨层 `next`。
