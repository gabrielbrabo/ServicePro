import { IEstablishment } from "../models/Establishment";
import { User } from "../models/User";

// ---------------------------------------------------------------------------
// Garante que o DONO exista como profissional agendavel.
//
// No modelo, "profissional agendavel" (professionals[]) e "quem tem acesso"
// (members[]) sao coisas distintas. O dono sempre esteve em members[], mas nao
// em professionals[] — por isso sumia da lista de escolha ao agendar assim que
// entravam outros profissionais.
//
// Este helper cria (se ainda nao existir) um professional vinculado ao dono,
// usando o nome do proprio perfil do dono. E idempotente: se ja existe um
// professional com linkedUser === owner, nao faz nada.
//
// IMPORTANTE: NAO salva o documento — quem chama decide quando persistir (para
// permitir agrupar com outras mudancas numa unica gravacao). Retorna true se
// criou algo novo (sinal para o chamador salvar), false se nada mudou.
// ---------------------------------------------------------------------------
export const ensureOwnerProfessional = async (
  est: IEstablishment
): Promise<boolean> => {
  const ownerId = est.owner.toString();

  // ja existe um profissional vinculado ao dono?
  const already = est.professionals.some(
    (p) => p.linkedUser && p.linkedUser.toString() === ownerId
  );
  if (already) return false;

  // nome e foto vem do perfil do dono (o perfil e a fonte da verdade)
  const owner = await User.findById(est.owner).select("name avatar");
  const name = owner?.name?.trim() || "Responsavel";

  est.professionals.push({
    name,
    photo: owner?.avatar || "",
    specialties: [],
    active: true,
    linkedUser: est.owner,
  } as never);

  return true;
};