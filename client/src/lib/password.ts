// Mesma regra do back (server/src/utils/passwordPolicy.ts). O back SEMPRE
// valida de novo — isto aqui e so para dar retorno imediato na tela.

export const PASSWORD_MIN = 8;

export interface PasswordCheck {
  label: string;
  ok: boolean;
}

export function passwordChecks(pwd: string): PasswordCheck[] {
  return [
    { label: `Ao menos ${PASSWORD_MIN} caracteres`, ok: pwd.length >= PASSWORD_MIN },
    { label: "Letras e números", ok: /[A-Za-z]/.test(pwd) && /\d/.test(pwd) },
    { label: "Sem espaço no início ou no fim", ok: !!pwd && !/^\s|\s$/.test(pwd) },
  ];
}

export function isPasswordValid(pwd: string): boolean {
  return passwordChecks(pwd).every((c) => c.ok) && pwd.length <= 72;
}

// extrai a mensagem do back (axios) com um texto padrao
export function apiMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data
      ?.message || fallback
  );
}
