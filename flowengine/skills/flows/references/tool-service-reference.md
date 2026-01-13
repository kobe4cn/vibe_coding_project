# tool-service URI 速查

- 格式：`<type>://<service-id>/<tool-id>?options`，常用 `timeout`、`max-attempts`；DB 需带 `type`/方法。  
- 常见类型：`api://`、`svc://`、`mcp://`、`db://`、`oss://`、`mq://`、`mail://`、`sms://`、`flow://`、`agent://`。  
- DB 方法：`take|list|page|stream|count|create|modify|delete|save|bulk|native`。  
- OSS/MQ 示例：  
  - `oss://minio/upload/reports/${date}/report.json`（或 args.operation='upload'）  
  - `mq://rabbitmq/publish/customer.events`（或 args.operation='publish'）  
- 流程/智能体：`flow://sample-flow`，`agent://sample-agent`。保持 `exec` 与注册表一致。
