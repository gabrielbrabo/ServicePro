import { useEffect, useState, useCallback } from "react";
import { galleryApi, GalleryItem } from "../api/gallery";
import { professionalApi, Professional } from "../api/professional";
import { catalogApi, Service } from "../api/catalog";
import { ImageUpload } from "./ImageUpload";

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

const serviceTitle = (s: GalleryItem["service"]): string | null => {
  if (!s) return null;
  if (typeof s === "object" && "title" in s) return s.title;
  return null;
};

export function GalleryManager({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // formulário
  const [showForm, setShowForm] = useState(false);
  const [beforeUrl, setBeforeUrl] = useState("");
  const [afterUrl, setAfterUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [professionalId, setProfessionalId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    galleryApi
      .list(establishmentId, true) // dono vê inativos também
      .then(setItems)
      .catch(() => setError("Não foi possível carregar a galeria."))
      .finally(() => setLoading(false));
  }, [establishmentId]);

  useEffect(() => {
    load();
    professionalApi
      .list(establishmentId)
      .then(setProfessionals)
      .catch(() => setProfessionals([]));
    catalogApi
      .byEstablishment(establishmentId)
      .then(setServices)
      .catch(() => setServices([]));
  }, [load, establishmentId]);

  const resetForm = () => {
    setBeforeUrl("");
    setAfterUrl("");
    setTitle("");
    setDescription("");
    setProfessionalId("");
    setServiceId("");
  };

  const submit = async () => {
    if (!beforeUrl || !afterUrl) {
      setError("Envie as duas fotos: antes e depois.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await galleryApi.create(establishmentId, {
        beforeUrl,
        afterUrl,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        professionalId: professionalId || undefined,
        serviceId: serviceId || undefined,
      });
      setItems((list) => [created, ...list]);
      resetForm();
      setShowForm(false);
    } catch {
      setError("Não foi possível salvar o registro.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (item: GalleryItem) => {
    const prev = items;
    setItems((list) =>
      list.map((x) =>
        x._id === item._id ? { ...x, active: !x.active } : x
      )
    );
    try {
      await galleryApi.update(establishmentId, item._id, {
        active: !item.active,
      });
    } catch {
      setItems(prev);
      setError("Não foi possível atualizar o registro.");
    }
  };

  const remove = async (itemId: string) => {
    const prev = items;
    setItems((list) => list.filter((x) => x._id !== itemId));
    try {
      await galleryApi.remove(establishmentId, itemId);
    } catch {
      setItems(prev);
      setError("Não foi possível remover o registro.");
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink/60">
            {items.length} registro{items.length !== 1 ? "s" : ""} na galeria.
            Fotos de antes e depois aparecem na página pública do seu negócio.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          {showForm ? "Cancelar" : "+ Novo registro"}
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-display text-lg font-bold text-ink">
            Novo antes e depois
          </h3>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <ImageUpload
              value={beforeUrl}
              onChange={setBeforeUrl}
              folder="galeria"
              label="Foto ANTES"
              hint="JPG, PNG ou WEBP, até 5 MB."
            />
            <ImageUpload
              value={afterUrl}
              onChange={setAfterUrl}
              folder="galeria"
              label="Foto DEPOIS"
              hint="JPG, PNG ou WEBP, até 5 MB."
            />
          </div>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              Título (opcional)
            </span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Progressiva + corte"
              className="h-11 w-full rounded-xl border border-ink/15 px-3 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium text-ink/70">
              Descrição (opcional)
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Conte um pouco sobre o trabalho realizado"
              className="w-full rounded-xl border border-ink/15 px-3 py-2 text-sm outline-none focus:border-teal-500"
            />
          </label>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {professionals.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Profissional (opcional)
                </span>
                <select
                  value={professionalId}
                  onChange={(e) => setProfessionalId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                >
                  <option value="">Sem crédito</option>
                  {professionals.map((p) => (
                    <option key={p._id} value={p._id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {services.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-ink/70">
                  Serviço (opcional)
                </span>
                <select
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                  className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 text-sm outline-none focus:border-teal-500"
                >
                  <option value="">Nenhum</option>
                  {services.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <button
            onClick={submit}
            disabled={saving || !beforeUrl || !afterUrl}
            className="mt-5 h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Publicar na galeria"}
          </button>
        </div>
      )}

      {/* Lista */}
      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-12 text-center text-ink/50">
          Nenhum registro ainda. Publique fotos de antes e depois para mostrar
          seu trabalho.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <div
              key={item._id}
              className={`overflow-hidden rounded-2xl border bg-white ${
                item.active ? "border-ink/10" : "border-ink/10 opacity-60"
              }`}
            >
              {/* antes / depois lado a lado */}
              <div className="grid grid-cols-2">
                <div className="relative">
                  <img
                    src={item.beforeUrl}
                    alt="Antes"
                    className="h-44 w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-ink/70 px-2 py-0.5 text-xs font-medium text-white">
                    Antes
                  </span>
                </div>
                <div className="relative">
                  <img
                    src={item.afterUrl}
                    alt="Depois"
                    className="h-44 w-full object-cover"
                  />
                  <span className="absolute left-2 top-2 rounded-full bg-teal-500 px-2 py-0.5 text-xs font-medium text-white">
                    Depois
                  </span>
                </div>
              </div>

              <div className="p-4">
                {item.title && (
                  <h4 className="font-display font-bold text-ink">
                    {item.title}
                  </h4>
                )}
                {item.description && (
                  <p className="mt-1 text-sm text-ink/60">{item.description}</p>
                )}

                <p className="mt-2 text-xs text-ink/50">
                  {fmtDate(item.createdAt)}
                  {item.professionalName ? ` · ${item.professionalName}` : ""}
                  {serviceTitle(item.service)
                    ? ` · ${serviceTitle(item.service)}`
                    : ""}
                  {!item.active && " · oculto"}
                </p>

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => toggleActive(item)}
                    className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
                  >
                    {item.active ? "Ocultar" : "Exibir"}
                  </button>
                  <button
                    onClick={() => remove(item._id)}
                    className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}