import { catalogApi } from "../api/catalog";
import { professionalApi, Professional } from "../api/professional";
import { scheduleApi } from "../api/schedule";
import { useCallback, useEffect, useState } from "react";

// Alertas de cobertura equipe x servicos, para evitar que um profissional nao
// receba agendamentos por nao estar em nenhum servico, ou um servico sem
// ninguem para realiza-lo.
//
// Convencao do sistema: servico com lista de profissionais VAZIA = "todos
// fazem". Por isso um servico vazio so e "sem profissional" quando NAO ha
// nenhum profissional ativo.

interface SvcLike {
  _id: string;
  professionals?: string[];
}

// ids dos servicos que nenhum profissional ATIVO consegue realizar
export function computeServicesWithoutPro(
  services: SvcLike[],
  pros: Professional[]
): Set<string> {
  const active = pros.filter((p) => p.active);
  const activeIds = new Set(active.map((p) => p._id));
  const out = new Set<string>();
  for (const s of services) {
    const ids = s.professionals ?? [];
    const covered =
      ids.length === 0
        ? active.length > 0 // "todos fazem": coberto se ha ao menos 1 ativo
        : ids.some((id) => activeIds.has(id)); // coberto se algum marcado e ativo
    if (!covered) out.add(s._id);
  }
  return out;
}

// ids dos profissionais ATIVOS que nao estao em nenhum servico
export function computeProsWithoutService(
  services: SvcLike[],
  pros: Professional[]
): Set<string> {
  const out = new Set<string>();
  if (services.length === 0) return out; // sem servicos ainda: nao alerta por-pro

  // se existe algum servico "todos fazem", todos os ativos estao cobertos
  const anyOpen = services.some((s) => (s.professionals ?? []).length === 0);

  const assigned = new Set<string>();
  if (!anyOpen) {
    for (const s of services) {
      for (const id of s.professionals ?? []) assigned.add(id);
    }
  }

  for (const p of pros) {
    if (!p.active) continue;
    const covered = anyOpen || assigned.has(p._id);
    if (!covered) out.add(p._id);
  }
  return out;
}

// Hook para os sininhos nas abas do painel: busca servicos + profissionais e
// devolve os dois conjuntos. `dep` (ex.: a aba atual) forca recarregar quando
// muda, para o sininho refletir edicoes feitas em outra aba.
export function useCoverageAlerts(establishmentId: string, dep?: unknown) {
  const [servicesWithoutPro, setSWP] = useState<Set<string>>(new Set());
  const [prosWithoutService, setPWS] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    if (!establishmentId) return;
    Promise.all([
      catalogApi.byEstablishment(establishmentId),
      professionalApi.list(establishmentId), // ativos
    ])
      .then(([services, pros]) => {
        setSWP(computeServicesWithoutPro(services, pros));
        setPWS(computeProsWithoutService(services, pros));
      })
      .catch(() => {
        setSWP(new Set());
        setPWS(new Set());
      });
  }, [establishmentId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, dep]);

  return { servicesWithoutPro, prosWithoutService, refresh };
}

// Hook: ids dos profissionais ATIVOS sem expediente (workingHours vazio).
// Consulta a disponibilidade de cada profissional (nao ha endpoint em lote).
export function useProsWithoutSchedule(establishmentId: string, dep?: unknown) {
  const [prosWithoutSchedule, setSet] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    if (!establishmentId) return;
    professionalApi
      .list(establishmentId) // ativos
      .then(async (pros) => {
        const active = pros.filter((p) => p.active);
        const checks = await Promise.all(
          active.map((p) =>
            scheduleApi
              .getAvailability(establishmentId, p._id)
              .then((a) => ({
                id: p._id,
                has: (a.workingHours?.length ?? 0) > 0,
              }))
              // sem expediente configurado (ou erro) => tratar como "sem"
              .catch(() => ({ id: p._id, has: false }))
          )
        );
        const out = new Set<string>();
        checks.forEach((c) => {
          if (!c.has) out.add(c.id);
        });
        setSet(out);
      })
      .catch(() => setSet(new Set()));
  }, [establishmentId]);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, dep]);

  return { prosWithoutSchedule, refresh };
}