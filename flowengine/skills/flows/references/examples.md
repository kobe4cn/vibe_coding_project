# 最小可用流程示例

```yaml
flow:
    name: 客户视图构建
    desp: 拉取客户信息与订单数量并合并
    args:
        in:
            customerId: string
        out:
            id: string
            name: string
            orders: int
    node:
        customer:
            name: 获取客户基础信息
            exec: api://crm-service/customer
            args: id = customerId
            next: orderCount

        orderCount:
            name: 获取订单数量
            exec: db://ec.mysql.order/count
            args: exps = `customerId = ${customerId}`
            next: merge

        merge:
            name: 合并结果
            with: |
                id    = customer.id
                name  = customer.name
                orders = orderCount
```

> 提示：节点可并行（未被依赖者自动并行）；必要时在节点上添加 `only` 作为条件，`fail` 处理异常跳转。
