// Validacao dos dados da conta de recebimento do afiliado (os mesmos que o
// Asaas exige para abrir a subconta). No modelo "deferred" a subconta so e
// aberta no 1o indicado pagante — entao validamos TUDO no cadastro, para o
// erro nao aparecer so la na frente (ex.: "O CEP informado e invalido").

export const onlyDigits = (v: unknown): string =>
  String(v ?? "").replace(/\D/g, "");

function validCpf(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

function validCnpj(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (len: number) => {
    const weights =
      len === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cnpj[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return calc(12) === Number(cnpj[12]) && calc(13) === Number(cnpj[13]);
}

// idade minima (Asaas exige titular maior de idade)
function isAdult(birthDate: string): boolean {
  const d = new Date(`${birthDate}T12:00:00`);
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 18 && age <= 120;
}

// Consulta o CEP no ViaCEP. true = existe; false = nao existe; null = nao deu
// para consultar (servico fora) -> nao bloqueia o cadastro.
export async function cepExists(cep: string): Promise<boolean | null> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!resp.ok) return resp.status === 400 ? false : null;
    const data = (await resp.json()) as { erro?: boolean | string };
    return !data.erro;
  } catch {
    return null;
  }
}

export interface ReceivingData {
  cpfCnpj?: string;
  phone?: string;
  birthDate?: string;
  postalCode?: string;
  address?: string;
  addressNumber?: string;
  province?: string;
}

// Devolve a mensagem de erro (para o usuario) ou null se esta tudo certo.
export async function validateReceivingData(
  d: ReceivingData
): Promise<string | null> {
  const doc = onlyDigits(d.cpfCnpj);
  if (!doc) return "Informe o CPF ou CNPJ.";
  const isCnpj = doc.length > 11;
  if (isCnpj ? !validCnpj(doc) : !validCpf(doc)) {
    return isCnpj ? "CNPJ inválido. Confira os números." : "CPF inválido. Confira os números.";
  }
  const phone = onlyDigits(d.phone);
  if (phone.length < 10 || phone.length > 11) {
    return "Telefone inválido. Informe com DDD (ex.: 38 99999-9999).";
  }
  if (!isCnpj) {
    if (!d.birthDate) return "Informe sua data de nascimento.";
    if (!isAdult(d.birthDate)) {
      return "Data de nascimento inválida. É preciso ter 18 anos ou mais.";
    }
  }
  if (!d.postalCode || !d.address || !d.addressNumber || !d.province) {
    return "Preencha o endereço completo (CEP, endereço, número e bairro).";
  }
  const cepOk = await cepExists(d.postalCode);
  if (cepOk === false) {
    return "CEP não encontrado. Confira o CEP informado.";
  }
  return null;
}
