// User-related types and enums
// The actual user table is defined in auth.ts (shared with BetterAuth)

export const UserRoles = {
  ADMIN: "admin",
  EDITOR: "editor",
  USER: "user",
} as const;

export type UserRole = (typeof UserRoles)[keyof typeof UserRoles];

export function isAdmin(role: string): boolean {
  return role === UserRoles.ADMIN;
}

export function isEditor(role: string): boolean {
  return role === UserRoles.ADMIN || role === UserRoles.EDITOR;
}

export function canCreateContent(role: string): boolean {
  return isEditor(role);
}

export function canApproveContent(role: string): boolean {
  return isAdmin(role);
}

export function canManageUsers(role: string): boolean {
  return isAdmin(role);
}
