type UserClaims = Record<string, unknown> & {
  sub?: string;
  email?: string;
  permissions?: unknown;
};

function parseList(value?: string): string[] {
  if (!value) return [];

  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

function getClaimArray(claims: Record<string, unknown>, key: string): string[] {
  const raw = claims[key];

  if (Array.isArray(raw)) {
    return raw.map((value) => String(value));
  }

  if (typeof raw === 'string') {
    return raw.split(/\s+/).filter(Boolean);
  }

  return [];
}

export function isAdminUser(user?: UserClaims | null): boolean {
  if (!user) return false;

  const allowedEmails = parseList(process.env.ADMIN_EMAILS);
  const allowedSubs = parseList(process.env.ADMIN_SUBS);
  const adminRole = process.env.AUTH0_ADMIN_ROLE;
  const adminPermission = process.env.AUTH0_ADMIN_PERMISSION;
  const rolesClaim = process.env.AUTH0_ROLES_CLAIM || 'roles';

  const hasEmailPolicy = allowedEmails.length > 0;
  const hasSubPolicy = allowedSubs.length > 0;
  const hasRolePolicy = Boolean(adminRole);
  const hasPermissionPolicy = Boolean(adminPermission);

  if (!hasEmailPolicy && !hasSubPolicy && !hasRolePolicy && !hasPermissionPolicy) {
    return false;
  }

  const email = String(user.email || '').toLowerCase();
  const sub = String(user.sub || '').toLowerCase();
  const roles = getClaimArray(user, rolesClaim);
  const permissions = getClaimArray(user, 'permissions');

  if (hasSubPolicy && (!sub || !allowedSubs.includes(sub))) {
    return false;
  }

  if (hasEmailPolicy && (!email || !allowedEmails.includes(email))) {
    return false;
  }

  const isAllowedByEmail = hasEmailPolicy && Boolean(email) && allowedEmails.includes(email);
  const isAllowedBySub = hasSubPolicy && Boolean(sub) && allowedSubs.includes(sub);
  const isAllowedByRole = hasRolePolicy && roles.includes(adminRole as string);
  const isAllowedByPermission = hasPermissionPolicy && permissions.includes(adminPermission as string);

  return isAllowedByEmail || isAllowedBySub || isAllowedByRole || isAllowedByPermission;
}
