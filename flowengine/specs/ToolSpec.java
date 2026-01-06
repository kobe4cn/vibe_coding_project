package cn.com.lianwei.msf.dynamic.schema.tool;

import cn.com.lianwei.msf.core.options.ConfigOptions;
import cn.com.lianwei.msf.domain.model.Field;

/**
 * 工具规格定义接口，用于被AI Agent作为工具进行调用。
 * <p>示例工具定义YAML：</p>
 * <pre>
 * code: api://flow.api.customer_view
 * name: 客户订单查询
 * desp: 根据客户标识与订单起始时间，获取客户基本信息及其订单列表。
 * args:
 *     defs:
 *         Order:                # 订单对象
 *             id: string        # 订单ID
 *             items: Item[]     # 订单明细列表
 *             quantity: int     # 商品总数量
 *             amount: decimal   # 订单总金额
 *         Item:                 # 订单明细对象
 *             sku: string       # SKU编码
 *             quantity: int     # 购买数量
 *     in:
 *         customerId: string    # 客户ID
 *         from: date?           # 订单起始时间（可选）
 *     out:
 *         id: string            # 客户ID
 *         name: string          # 客户姓名
 *         regTime: date         # 注册时间
 *         orders: Order[]       # 订单列表
 * </pre>
 *
 * @author Han
 * @since 2025-12-24 17:17:33
 */
public class ToolSpec {

    @Field(name = "工具类型", description = "如：mcp, svc, api, db, agent等。")
    protected String type;

    @Field(name = "工具标识", description = "如：baidu_map/map_ip_location, crm.mongo.order/page")
    protected String code;

    @Field(name = "工具名称")
    protected String name;

    @Field(name = "工具描述")
    protected String desp;

    @Field(name = "参数定义")
    protected ToolArgs args;

    @Field(name = "扩展配置", description = "如：api类型工具可通过此参数，放置主机、路径等信息。")
    protected ConfigOptions opts;

    public ToolSpec() {
    }

    // region setter

    public ToolSpec type(String type) {
        this.type = type;
        return this;
    }

    public ToolSpec code(String code) {
        this.code = code;
        return this;
    }

    public ToolSpec name(String name) {
        this.name = name;
        return this;
    }

    public ToolSpec desp(String desp) {
        this.desp = desp;
        return this;
    }

    public ToolSpec args(ToolArgs args) {
        this.args = args;
        return this;
    }

    public ToolSpec opts(ConfigOptions opts) {
        this.opts = opts;
        return this;
    }

    // endregion

    // region getter

    public String getType() {
        return type;
    }

    public String getCode() {
        return code;
    }

    public String getName() {
        return name;
    }

    public String getDesp() {
        return desp;
    }

    public ToolArgs getArgs() {
        return args;
    }

    public ConfigOptions getOpts() {
        return opts;
    }

    // endregion

}
