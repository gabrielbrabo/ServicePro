// Politica de senha usada nos fluxos de redefinicao e troca de senha.
// O cadastro continua aceitando o minimo antigo (6) para nao quebrar contas
// existentes; senhas NOVAS definidas por aqui seguem a regra mais forte.

export const PASSWORD_MIN = 8;
// bcrypt ignora tudo depois de 72 bytes: acima disso a senha "parece" maior
// mas nao e — melhor recusar do que enganar o usuario.
export const PASSWORD_MAX = 72;

// retorna a mensagem de erro, ou null se a senha for aceita
export const validatePassword = (pwd: unknown): string | null => {
  if (typeof pwd !== "string" || !pwd) return "Informe a nova senha";
  if (pwd.length < PASSWORD_MIN)
    return `A senha precisa ter ao menos ${PASSWORD_MIN} caracteres`;
  if (Buffer.byteLength(pwd, "utf8") > PASSWORD_MAX)
    return `A senha pode ter no maximo ${PASSWORD_MAX} caracteres`;
  if (!/[A-Za-z]/.test(pwd) || !/\d/.test(pwd))
    return "A senha precisa ter letras e numeros";
  if (/^\s|\s$/.test(pwd))
    return "A senha nao pode comecar nem terminar com espaco";
  return null;
};
