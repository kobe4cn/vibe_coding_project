//! 基于角色的访问控制（RBAC）
//!
//! 实现细粒度的权限控制，通过角色到权限的映射来管理访问权限。
//! 支持多角色，用户可以有多个角色，权限取并集。

use crate::jwt::Claims;
use std::collections::HashSet;

/// 权限类型
///
/// 定义了系统中所有可用的权限，包括流程、版本、管理和系统权限。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum Permission {
    // Flow permissions
    FlowRead,
    FlowWrite,
    FlowDelete,
    FlowExecute,

    // Version permissions
    VersionRead,
    VersionWrite,
    VersionDelete,

    // Admin permissions
    TenantManage,
    UserManage,
    ConfigManage,

    // System permissions
    SystemAdmin,
}

/// Role definitions
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Role {
    /// Read-only access
    Viewer,
    /// Can edit flows
    Editor,
    /// Can execute flows
    Executor,
    /// Full access to tenant resources
    Admin,
    /// System administrator
    SuperAdmin,
}

impl Role {
    /// 获取角色的权限集合
    ///
    /// 每个角色都有预定义的权限集合，采用最小权限原则。
    /// SuperAdmin 拥有所有权限，包括系统管理权限。
    pub fn permissions(&self) -> HashSet<Permission> {
        let mut perms = HashSet::new();

        match self {
            Role::Viewer => {
                // 查看者：只能读取流程和版本
                perms.insert(Permission::FlowRead);
                perms.insert(Permission::VersionRead);
            }
            Role::Editor => {
                // 编辑者：可以读取和编辑流程，但不能执行或删除
                perms.insert(Permission::FlowRead);
                perms.insert(Permission::FlowWrite);
                perms.insert(Permission::VersionRead);
                perms.insert(Permission::VersionWrite);
            }
            Role::Executor => {
                // 执行者：可以读取和执行流程，但不能编辑
                perms.insert(Permission::FlowRead);
                perms.insert(Permission::FlowExecute);
                perms.insert(Permission::VersionRead);
            }
            Role::Admin => {
                // 管理员：拥有租户内所有权限（除系统管理）
                perms.insert(Permission::FlowRead);
                perms.insert(Permission::FlowWrite);
                perms.insert(Permission::FlowDelete);
                perms.insert(Permission::FlowExecute);
                perms.insert(Permission::VersionRead);
                perms.insert(Permission::VersionWrite);
                perms.insert(Permission::VersionDelete);
                perms.insert(Permission::UserManage);
                perms.insert(Permission::ConfigManage);
            }
            Role::SuperAdmin => {
                // 超级管理员：拥有所有权限，包括系统管理
                perms.insert(Permission::SystemAdmin);
                // 显式添加所有权限，确保完整性
                for perm in [
                    Permission::FlowRead,
                    Permission::FlowWrite,
                    Permission::FlowDelete,
                    Permission::FlowExecute,
                    Permission::VersionRead,
                    Permission::VersionWrite,
                    Permission::VersionDelete,
                    Permission::TenantManage,
                    Permission::UserManage,
                    Permission::ConfigManage,
                ] {
                    perms.insert(perm);
                }
            }
        }

        perms
    }

    /// Parse role from string
    pub fn from_strs(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "viewer" => Some(Role::Viewer),
            "editor" => Some(Role::Editor),
            "executor" => Some(Role::Executor),
            "admin" => Some(Role::Admin),
            "superadmin" | "super_admin" => Some(Role::SuperAdmin),
            _ => None,
        }
    }
}

/// 检查 claims 是否具有特定权限
///
/// 遍历用户的所有角色，如果任一角色拥有该权限，则返回 true。
/// 这实现了多角色的权限并集逻辑。
pub fn has_permission(claims: &Claims, permission: Permission) -> bool {
    for role_str in &claims.roles {
        if let Some(role) = Role::from_strs(role_str)
            && role.permissions().contains(&permission)
        {
            return true;
        }
    }
    false
}

/// Require a specific permission
pub fn require_permission(claims: &Claims, permission: Permission) -> crate::AuthResult<()> {
    if has_permission(claims, permission) {
        Ok(())
    } else {
        Err(crate::AuthError::InsufficientPermissions)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_parsing() {
        assert_eq!(Role::from_strs("viewer"), Some(Role::Viewer));
        assert_eq!(Role::from_strs("editor"), Some(Role::Editor));
        assert_eq!(Role::from_strs("executor"), Some(Role::Executor));
        assert_eq!(Role::from_strs("admin"), Some(Role::Admin));
        assert_eq!(Role::from_strs("superadmin"), Some(Role::SuperAdmin));
        assert_eq!(Role::from_strs("super_admin"), Some(Role::SuperAdmin));
        assert_eq!(Role::from_strs("ADMIN"), Some(Role::Admin)); // case insensitive
        assert_eq!(Role::from_strs("unknown"), None);
    }

    #[test]
    fn test_viewer_permissions() {
        let perms = Role::Viewer.permissions();
        assert!(perms.contains(&Permission::FlowRead));
        assert!(perms.contains(&Permission::VersionRead));
        assert!(!perms.contains(&Permission::FlowWrite));
        assert!(!perms.contains(&Permission::FlowDelete));
    }

    #[test]
    fn test_editor_permissions() {
        let perms = Role::Editor.permissions();
        assert!(perms.contains(&Permission::FlowRead));
        assert!(perms.contains(&Permission::FlowWrite));
        assert!(perms.contains(&Permission::VersionRead));
        assert!(perms.contains(&Permission::VersionWrite));
        assert!(!perms.contains(&Permission::FlowDelete));
    }

    #[test]
    fn test_executor_permissions() {
        let perms = Role::Executor.permissions();
        assert!(perms.contains(&Permission::FlowRead));
        assert!(perms.contains(&Permission::FlowExecute));
        assert!(perms.contains(&Permission::VersionRead));
        assert!(!perms.contains(&Permission::FlowWrite));
    }

    #[test]
    fn test_admin_permissions() {
        let perms = Role::Admin.permissions();
        assert!(perms.contains(&Permission::FlowRead));
        assert!(perms.contains(&Permission::FlowWrite));
        assert!(perms.contains(&Permission::FlowDelete));
        assert!(perms.contains(&Permission::FlowExecute));
        assert!(perms.contains(&Permission::UserManage));
        assert!(perms.contains(&Permission::ConfigManage));
        assert!(!perms.contains(&Permission::TenantManage));
        assert!(!perms.contains(&Permission::SystemAdmin));
    }

    #[test]
    fn test_superadmin_permissions() {
        let perms = Role::SuperAdmin.permissions();
        assert!(perms.contains(&Permission::SystemAdmin));
        assert!(perms.contains(&Permission::TenantManage));
        assert!(perms.contains(&Permission::FlowRead));
        assert!(perms.contains(&Permission::FlowWrite));
        assert!(perms.contains(&Permission::FlowDelete));
    }

    #[test]
    fn test_has_permission() {
        let claims = Claims {
            sub: "user-1".to_string(),
            tenant_id: "tenant-1".to_string(),
            bu_code: "BU001".to_string(),
            roles: vec!["editor".to_string()],
            iat: 0,
            exp: 0,
            iss: "test".to_string(),
        };

        assert!(has_permission(&claims, Permission::FlowWrite));
        assert!(!has_permission(&claims, Permission::FlowDelete));
    }

    #[test]
    fn test_has_permission_multiple_roles() {
        let claims = Claims {
            sub: "user-1".to_string(),
            tenant_id: "tenant-1".to_string(),
            bu_code: "BU001".to_string(),
            roles: vec!["viewer".to_string(), "executor".to_string()],
            iat: 0,
            exp: 0,
            iss: "test".to_string(),
        };

        assert!(has_permission(&claims, Permission::FlowRead));
        assert!(has_permission(&claims, Permission::FlowExecute));
        assert!(!has_permission(&claims, Permission::FlowWrite));
    }

    #[test]
    fn test_require_permission_success() {
        let claims = Claims {
            sub: "user-1".to_string(),
            tenant_id: "tenant-1".to_string(),
            bu_code: "BU001".to_string(),
            roles: vec!["admin".to_string()],
            iat: 0,
            exp: 0,
            iss: "test".to_string(),
        };

        assert!(require_permission(&claims, Permission::FlowWrite).is_ok());
    }

    #[test]
    fn test_require_permission_failure() {
        let claims = Claims {
            sub: "user-1".to_string(),
            tenant_id: "tenant-1".to_string(),
            bu_code: "BU001".to_string(),
            roles: vec!["viewer".to_string()],
            iat: 0,
            exp: 0,
            iss: "test".to_string(),
        };

        assert!(require_permission(&claims, Permission::FlowWrite).is_err());
    }
}
