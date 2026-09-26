// Busca o endereco de um CEP no ViaCEP (preenche endereco/bairro sozinho).
// null = CEP nao encontrado; undefined = nao deu para consultar agora.
export async function lookupCep(
  cep: string
): Promise<{ address: string; province: string } | null | undefined> {
  const digits = cep.replace(/\D/g, "");
  if (digits.length !== 8) return null;
  try {
    const resp = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    if (!resp.ok) return resp.status === 400 ? null : undefined;
    const data = (await resp.json()) as {
      erro?: boolean | string;
      logradouro?: string;
      bairro?: string;
    };
    if (data.erro) return null;
    return { address: data.logradouro || "", province: data.bairro || "" };
  } catch {
    return undefined;
  }
}
