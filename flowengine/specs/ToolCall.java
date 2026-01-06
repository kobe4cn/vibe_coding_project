package cn.com.lianwei.msf.dynamic.tool;

import cn.com.lianwei.msf.core.options.ConfigOptions;
import cn.com.lianwei.msf.core.utils.ConnString;
import cn.com.lianwei.msf.dynamic.schema.tool.ToolSpec;

import java.util.Map;

/**
 * 工具调用请求，参见msf工程文档: .doc/tool/tool-service.md
 *
 * @param type 工具类型，如：mcp, svc, api, db, agent等。
 * @param code 工具标识，如：baidu_map/map_ip_location, crm.mongo.order/page
 * @param opts 工具配置，指定工具调用所需的配置项，如：重试次数、超时等。
 * @param args 参数信息，调用工具所需的参数定义。默认应包含tenantId及buCode，以支持多租户运行。
 * @author Han
 * @since 2025-12-25 15:20:23
 */
public record ToolCall(String type,
                       String code,
                       ConfigOptions opts,
                       Map<String, Object> args) {

    public static ToolCall of(String uri) {
        var toolUri = ConnString.of(uri);
        return new ToolCall(
            toolUri.getScheme(),
            toolUri.fullPath(),
            toolUri.options(),
            null
        );
    }

    /**
     * 执行工具调用请求
     *
     * @param type 工具类型
     * @param code 工具标识
     * @param opts 工具配置
     * @param args 参数信息
     * @return 执行结果
     */
    public static Object exec(String type,
                              String code,
                              ConfigOptions opts,
                              Map<String, Object> args) {
        var service = ToolCallServices.load(type);
        return service.exec(new ToolCall(type, code, opts, args));
    }

    /**
     * 获取工具定义
     *
     * @param tenantId 租户标识
     * @param buCode   业务单元
     * @param type     工具类型
     * @param code     工具标识
     * @return 工具定义
     */
    public static ToolSpec spec(String tenantId, String buCode, String type, String code) {
        var service = ToolCallServices.load(type);
        return service.spec(tenantId, buCode, code);
    }

    public ToolCall args(Map<String, Object> args) {
        return new ToolCall(type, code, opts, args);
    }

    public Object exec() {
        return exec(type, code, opts, args);
    }

    public Object exec(Map<String, Object> args) {
        return exec(type, code, opts, args);
    }

    public String tenantId() {
        return (String) args.get(ToolCallOptions.TENANT_ID.key());
    }

    public String buCode() {
        return (String) args.get(ToolCallOptions.BU_CODE.key());
    }

}
