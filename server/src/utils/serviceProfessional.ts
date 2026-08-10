import { Types } from "mongoose";

// Regra: um profissional PODE executar o servico se
// - o servico nao restringe profissionais (lista vazia = todos), OU
// - o profissional esta na lista de profissionais do servico.
//
// serviceProfessionals: Service.professionals (array de ObjectId)
// professional: id escolhido (ou null quando estabelecimento sem equipe)
export const professionalDoesService = (
  serviceProfessionals: Types.ObjectId[] | undefined,
  professional: Types.ObjectId | null
): boolean => {
  const list = serviceProfessionals ?? [];
  // servico sem restricao => qualquer profissional (ou nenhum) serve
  if (list.length === 0) return true;
  // servico restrito mas sem profissional escolhido => nao serve
  if (!professional) return false;
  return list.some((id) => id.toString() === professional.toString());
};