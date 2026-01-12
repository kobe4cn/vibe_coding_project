//! 工具服务存储层
//!
//! 定义 ToolService 和 Tool 的存储接口，支持 CRUD 操作。

use crate::error::ToolResult;
use crate::models::{Tool, ToolService, ToolType};

/// 工具服务存储 trait
///
/// 定义工具服务和工具的持久化接口。
#[async_trait::async_trait]
pub trait ToolServiceStore: Send + Sync {
    // ==================== ToolService 操作 ====================

    /// 获取所有工具服务
    async fn list_services(&self, tenant_id: &str) -> ToolResult<Vec<ToolService>>;

    /// 按类型获取工具服务
    async fn list_services_by_type(
        &self,
        tenant_id: &str,
        tool_type: ToolType,
    ) -> ToolResult<Vec<ToolService>>;

    /// 获取单个工具服务（通过 ID）
    async fn get_service(&self, tenant_id: &str, id: &str) -> ToolResult<Option<ToolService>>;

    /// 获取单个工具服务（通过代码）
    async fn get_service_by_code(
        &self,
        tenant_id: &str,
        tool_type: ToolType,
        code: &str,
    ) -> ToolResult<Option<ToolService>>;

    /// 保存工具服务（创建或更新）
    async fn save_service(&self, tenant_id: &str, service: ToolService) -> ToolResult<ToolService>;

    /// 删除工具服务
    async fn delete_service(&self, tenant_id: &str, id: &str) -> ToolResult<bool>;

    /// 启用/禁用工具服务
    async fn set_service_enabled(
        &self,
        tenant_id: &str,
        id: &str,
        enabled: bool,
    ) -> ToolResult<bool>;

    // ==================== Tool 操作 ====================

    /// 获取服务下的所有工具
    async fn list_tools(&self, tenant_id: &str, service_id: &str) -> ToolResult<Vec<Tool>>;

    /// 获取单个工具（通过 ID）
    async fn get_tool(&self, tenant_id: &str, id: &str) -> ToolResult<Option<Tool>>;

    /// 获取单个工具（通过服务 ID 和工具代码）
    async fn get_tool_by_code(
        &self,
        tenant_id: &str,
        service_id: &str,
        code: &str,
    ) -> ToolResult<Option<Tool>>;

    /// 保存工具（创建或更新）
    async fn save_tool(&self, tenant_id: &str, tool: Tool) -> ToolResult<Tool>;

    /// 删除工具
    async fn delete_tool(&self, tenant_id: &str, id: &str) -> ToolResult<bool>;

    /// 启用/禁用工具
    async fn set_tool_enabled(&self, tenant_id: &str, id: &str, enabled: bool) -> ToolResult<bool>;

    // ==================== 组合查询 ====================

    /// 根据 URI 获取工具服务和工具
    ///
    /// URI 格式: `tool-type://service-code/tool-code`
    async fn get_by_uri(
        &self,
        tenant_id: &str,
        uri: &str,
    ) -> ToolResult<Option<(ToolService, Tool)>>;
}

/// 内存工具服务存储（用于开发和测试）
#[derive(Default)]
pub struct InMemoryToolServiceStore {
    services: std::sync::RwLock<std::collections::HashMap<String, ToolService>>,
    tools: std::sync::RwLock<std::collections::HashMap<String, Tool>>,
}

impl InMemoryToolServiceStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// 生成复合键
    fn service_key(tenant_id: &str, id: &str) -> String {
        format!("{}:{}", tenant_id, id)
    }

    fn tool_key(tenant_id: &str, id: &str) -> String {
        format!("{}:{}", tenant_id, id)
    }
}

#[async_trait::async_trait]
impl ToolServiceStore for InMemoryToolServiceStore {
    async fn list_services(&self, tenant_id: &str) -> ToolResult<Vec<ToolService>> {
        let services = self.services.read().unwrap();
        Ok(services
            .values()
            .filter(|s| s.tenant_id == tenant_id)
            .cloned()
            .collect())
    }

    async fn list_services_by_type(
        &self,
        tenant_id: &str,
        tool_type: ToolType,
    ) -> ToolResult<Vec<ToolService>> {
        let services = self.services.read().unwrap();
        Ok(services
            .values()
            .filter(|s| s.tenant_id == tenant_id && s.tool_type == tool_type)
            .cloned()
            .collect())
    }

    async fn get_service(&self, tenant_id: &str, id: &str) -> ToolResult<Option<ToolService>> {
        let services = self.services.read().unwrap();
        Ok(services.get(&Self::service_key(tenant_id, id)).cloned())
    }

    async fn get_service_by_code(
        &self,
        tenant_id: &str,
        tool_type: ToolType,
        code: &str,
    ) -> ToolResult<Option<ToolService>> {
        let services = self.services.read().unwrap();
        Ok(services
            .values()
            .find(|s| s.tenant_id == tenant_id && s.tool_type == tool_type && s.code == code)
            .cloned())
    }

    async fn save_service(
        &self,
        tenant_id: &str,
        mut service: ToolService,
    ) -> ToolResult<ToolService> {
        service.tenant_id = tenant_id.to_string();
        service.updated_at = Some(chrono::Utc::now());
        if service.created_at.is_none() {
            service.created_at = Some(chrono::Utc::now());
        }

        let mut services = self.services.write().unwrap();
        services.insert(Self::service_key(tenant_id, &service.id), service.clone());
        Ok(service)
    }

    async fn delete_service(&self, tenant_id: &str, id: &str) -> ToolResult<bool> {
        let mut services = self.services.write().unwrap();
        let removed = services.remove(&Self::service_key(tenant_id, id)).is_some();

        // 同时删除服务下的所有工具
        if removed {
            let mut tools = self.tools.write().unwrap();
            tools.retain(|_, t| t.service_id != id);
        }

        Ok(removed)
    }

    async fn set_service_enabled(
        &self,
        tenant_id: &str,
        id: &str,
        enabled: bool,
    ) -> ToolResult<bool> {
        let mut services = self.services.write().unwrap();
        if let Some(service) = services.get_mut(&Self::service_key(tenant_id, id)) {
            service.enabled = enabled;
            service.updated_at = Some(chrono::Utc::now());
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn list_tools(&self, _tenant_id: &str, service_id: &str) -> ToolResult<Vec<Tool>> {
        let tools = self.tools.read().unwrap();
        Ok(tools
            .values()
            .filter(|t| t.service_id == service_id)
            .cloned()
            .collect())
    }

    async fn get_tool(&self, tenant_id: &str, id: &str) -> ToolResult<Option<Tool>> {
        let tools = self.tools.read().unwrap();
        Ok(tools.get(&Self::tool_key(tenant_id, id)).cloned())
    }

    async fn get_tool_by_code(
        &self,
        _tenant_id: &str,
        service_id: &str,
        code: &str,
    ) -> ToolResult<Option<Tool>> {
        let tools = self.tools.read().unwrap();
        Ok(tools
            .values()
            .find(|t| t.service_id == service_id && t.code == code)
            .cloned())
    }

    async fn save_tool(&self, tenant_id: &str, mut tool: Tool) -> ToolResult<Tool> {
        tool.updated_at = Some(chrono::Utc::now());
        if tool.created_at.is_none() {
            tool.created_at = Some(chrono::Utc::now());
        }

        let mut tools = self.tools.write().unwrap();
        tools.insert(Self::tool_key(tenant_id, &tool.id), tool.clone());
        Ok(tool)
    }

    async fn delete_tool(&self, tenant_id: &str, id: &str) -> ToolResult<bool> {
        let mut tools = self.tools.write().unwrap();
        Ok(tools.remove(&Self::tool_key(tenant_id, id)).is_some())
    }

    async fn set_tool_enabled(&self, tenant_id: &str, id: &str, enabled: bool) -> ToolResult<bool> {
        let mut tools = self.tools.write().unwrap();
        if let Some(tool) = tools.get_mut(&Self::tool_key(tenant_id, id)) {
            tool.enabled = enabled;
            tool.updated_at = Some(chrono::Utc::now());
            Ok(true)
        } else {
            Ok(false)
        }
    }

    async fn get_by_uri(
        &self,
        tenant_id: &str,
        uri: &str,
    ) -> ToolResult<Option<(ToolService, Tool)>> {
        // 解析 URI: tool-type://service-code/tool-code
        let parsed = crate::parse_tool_uri(uri)?;

        let tool_type = ToolType::from_strs(&parsed.tool_type).ok_or_else(|| {
            crate::error::ToolError::InvalidUri(format!("Unknown tool type: {}", parsed.tool_type))
        })?;

        let path_parts: Vec<&str> = parsed.path.split('/').collect();
        if path_parts.len() < 2 {
            return Err(crate::error::ToolError::InvalidUri(format!(
                "Invalid URI path: {}",
                parsed.path
            )));
        }

        let service_code = path_parts[0];
        let tool_code = path_parts[1];

        // 查找服务
        let service = self
            .get_service_by_code(tenant_id, tool_type, service_code)
            .await?;

        if let Some(service) = service {
            // 查找工具
            let tool = self
                .get_tool_by_code(tenant_id, &service.id, tool_code)
                .await?;

            if let Some(tool) = tool {
                return Ok(Some((service, tool)));
            }
        }

        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{ApiConfig, ToolArgs, ToolServiceConfig};

    #[tokio::test]
    async fn test_inmemory_service_crud() {
        let store = InMemoryToolServiceStore::new();

        let config = ToolServiceConfig::Api(ApiConfig {
            base_url: "https://api.example.com".to_string(),
            auth: None,
            default_headers: std::collections::HashMap::new(),
            timeout_ms: 30000,
            retry: None,
        });

        let service = ToolService::new(ToolType::Api, "crm", "CRM 服务", config, "tenant-1");
        let service_id = service.id.clone();

        // 保存
        let saved = store.save_service("tenant-1", service).await.unwrap();
        assert_eq!(saved.code, "crm");

        // 获取
        let fetched = store.get_service("tenant-1", &service_id).await.unwrap();
        assert!(fetched.is_some());
        assert_eq!(fetched.unwrap().name, "CRM 服务");

        // 列表
        let list = store.list_services("tenant-1").await.unwrap();
        assert_eq!(list.len(), 1);

        // 按类型列表
        let api_list = store
            .list_services_by_type("tenant-1", ToolType::Api)
            .await
            .unwrap();
        assert_eq!(api_list.len(), 1);

        // 删除
        let deleted = store.delete_service("tenant-1", &service_id).await.unwrap();
        assert!(deleted);

        let fetched = store.get_service("tenant-1", &service_id).await.unwrap();
        assert!(fetched.is_none());
    }

    #[tokio::test]
    async fn test_inmemory_tool_crud() {
        let store = InMemoryToolServiceStore::new();

        let config = ToolServiceConfig::Api(ApiConfig {
            base_url: "https://api.example.com".to_string(),
            auth: None,
            default_headers: std::collections::HashMap::new(),
            timeout_ms: 30000,
            retry: None,
        });

        let service = ToolService::new(ToolType::Api, "crm", "CRM 服务", config, "tenant-1");
        let service_id = service.id.clone();
        store.save_service("tenant-1", service).await.unwrap();

        // 创建工具
        let mut tool = Tool::new("customer_list", "客户列表");
        tool.service_id = service_id.clone();
        tool.args = ToolArgs::default();
        let tool_id = tool.id.clone();

        // 保存
        let saved = store.save_tool("tenant-1", tool).await.unwrap();
        assert_eq!(saved.code, "customer_list");

        // 获取
        let fetched = store.get_tool("tenant-1", &tool_id).await.unwrap();
        assert!(fetched.is_some());

        // 按代码获取
        let by_code = store
            .get_tool_by_code("tenant-1", &service_id, "customer_list")
            .await
            .unwrap();
        assert!(by_code.is_some());

        // 列表
        let list = store.list_tools("tenant-1", &service_id).await.unwrap();
        assert_eq!(list.len(), 1);

        // 删除
        let deleted = store.delete_tool("tenant-1", &tool_id).await.unwrap();
        assert!(deleted);
    }

    #[tokio::test]
    async fn test_get_by_uri() {
        let store = InMemoryToolServiceStore::new();

        let config = ToolServiceConfig::Api(ApiConfig {
            base_url: "https://api.example.com".to_string(),
            auth: None,
            default_headers: std::collections::HashMap::new(),
            timeout_ms: 30000,
            retry: None,
        });

        let service = ToolService::new(ToolType::Api, "crm", "CRM 服务", config, "tenant-1");
        let service_id = service.id.clone();
        store.save_service("tenant-1", service).await.unwrap();

        let mut tool = Tool::new("customer_list", "客户列表");
        tool.service_id = service_id;
        store.save_tool("tenant-1", tool).await.unwrap();

        // 通过 URI 获取
        let result = store
            .get_by_uri("tenant-1", "api://crm/customer_list")
            .await
            .unwrap();
        assert!(result.is_some());

        let (service, tool) = result.unwrap();
        assert_eq!(service.code, "crm");
        assert_eq!(tool.code, "customer_list");

        // 不存在的 URI
        let not_found = store
            .get_by_uri("tenant-1", "api://unknown/unknown")
            .await
            .unwrap();
        assert!(not_found.is_none());
    }
}
