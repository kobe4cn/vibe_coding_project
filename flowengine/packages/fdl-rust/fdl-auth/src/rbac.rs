//! Role-based access control

use crate::jwt::Claims;
use std::collections::HashSet;

/// Permission types
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
    /// Get permissions for a role
    pub fn permissions(&self) -> HashSet<Permission> {
        let mut perms = HashSet::new();

        match self {
            Role::Viewer => {
                perms.insert(Permission::FlowRead);
                perms.insert(Permission::VersionRead);
            }
            Role::Editor => {
                perms.insert(Permission::FlowRead);
                perms.insert(Permission::FlowWrite);
                perms.insert(Permission::VersionRead);
                perms.insert(Permission::VersionWrite);
            }
            Role::Executor => {
                perms.insert(Permission::FlowRead);
                perms.insert(Permission::FlowExecute);
                perms.insert(Permission::VersionRead);
            }
            Role::Admin => {
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
                perms.insert(Permission::SystemAdmin);
                // Super admin has all permissions
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

/// Check if claims have a specific permission
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
