import { useEffect, useState } from "react";
import { professionalApi, Professional } from "../api/professional";
import { AvailabilityEditor } from "./AvailabilityEditor";

export function AgendaTab({
  establishmentId,
  myProfessionalId = null,
}: {
  establishmentId: string;
  myProfessionalId?: string | null;
}) {
  const [pros, setPros] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const isEmployee = !!myProfessionalId;

  useEffect(() => {
    // funcionario so edita a propria agenda: nao precisa carregar a equipe
    if (isEmployee) {
      setSelected(myProfessionalId);
      setLoading(false);
      return;
    }

    setLoading(true);
    professionalApi
      .list(establishmentId) // só ativos
      .then((list) => {
        setPros(list);
        if (list.length > 0) setSelected(list[0]._id);
        else setSelected(null);
      })
      .catch(() => {
        setPros([]);
        setSelected(null);
      })
      .finally(() => setLoading(false));
  }, [establishmentId, isEmployee, myProfessionalId]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 text-ink/50">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink/20 border-t-teal-500" />
        Carregando...
      </div>
    );
  }

  // FUNCIONARIO: edita direto a propria agenda, sem seletor
  if (isEmployee && selected) {
    return (
      <div>
        <p className="mb-4 text-sm text-ink/60">
          Configure aqui o seu expediente. Os clientes só poderão agendar com
          você nos horários definidos.
        </p>
        <AvailabilityEditor
          key={selected}
          establishmentId={establishmentId}
          professional={selected}
        />
      </div>
    );
  }

  // DONO sem equipe: agenda geral do estabelecimento (comportamento atual)
  if (pros.length === 0) {
    return <AvailabilityEditor establishmentId={establishmentId} />;
  }

  // DONO com equipe: seletor de profissional + agenda do escolhido
  return (
    <div>
      <div className="mb-6">
        <label className="mb-2 block text-sm font-medium text-ink">
          Configurando a agenda de:
        </label>
        <div className="flex flex-wrap gap-2">
          {pros.map((p) => (
            <button
              key={p._id}
              onClick={() => setSelected(p._id)}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
                selected === p._id
                  ? "bg-teal-500 text-white"
                  : "bg-white text-ink/70 ring-1 ring-ink/10 hover:bg-sand"
              }`}
            >
              {p.photo ? (
                <img
                  src={p.photo}
                  alt={p.name}
                  className="h-5 w-5 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/20 text-xs font-bold text-teal-700">
                  {p.name.charAt(0).toUpperCase()}
                </span>
              )}
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <AvailabilityEditor
          key={selected}
          establishmentId={establishmentId}
          professional={selected}
        />
      )}
    </div>
  );
}