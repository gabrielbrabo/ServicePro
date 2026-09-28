// Administradores do ServiçosPro (ferramentas internas, ex.: gerar cupons).
// Defina no Render: ADMIN_EMAILS=seu@email.com,outro@email.com
export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

