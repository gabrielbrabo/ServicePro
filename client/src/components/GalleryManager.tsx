import { useEffect, useState, useCallback } from "react";
import { galleryApi, GalleryItem } from "../api/gallery";
import { professionalApi, Professional } from "../api/professional";
import { catalogApi, Service } from "../api/catalog";
import { subscriptionApi, GallerySpace } from "../api/subscription";
import { ImageUpload } from "./ImageUpload";
import { GallerySpaceModal } from "./GallerySpaceModal";

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

  // espaco de armazenamento (single=1, antes/depois=2)
  const [space, setSpace] = useState<GallerySpace | null>(null);
  const [buyingSpace, setBuyingSpace] = useState(false);

  // formulário
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<"ba" | "single">("ba");
  const [beforeUrl, setBeforeUrl] = useState("");
  const [afterUrl, setAfterUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
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

  // situacao do espaco (so o dono recebe; equipe/erro -> null, sem trava no front)
  const loadSpace = useCallback(() => {
    subscriptionApi
      .gallery(establishmentId)
      .then(setSpace)
      .catch(() => setSpace(null));
  }, [establishmentId]);

  useEffect(() => {
    load();
    loadSpace();
    professionalApi
      .list(establishmentId)
      .then(setProfessionals)
      .catch(() => setProfessionals([]));
    catalogApi
      .byEstablishment(establishmentId)
      .then(setServices)
      .catch(() => setServices([]));
  }, [load, loadSpace, establishmentId]);

  const resetForm = () => {
    setBeforeUrl("");
    setAfterUrl("");
    setPhotoUrl("");
    setTitle("");
    setDescription("");
    setProfessionalId("");
    setServiceId("");
  };

  const submit = async () => {
    if (kind === "single" ? !photoUrl : !beforeUrl || !afterUrl) {
      setError(
        kind === "single"
          ? "Envie a foto."
          : "Envie as duas fotos: antes e depois."
      );
      return;
    }
    // trava de espaco: single ocupa 1, antes/depois ocupa 2
    const cost = kind === "ba" ? 2 : 1;
    if (space && space.remaining < cost) {
      if (space.isOwner) {
        setBuyingSpace(true);
      } else {
        setError(
          "Sem espaço na galeria. Peça ao dono para adicionar um pacote de espaço."
        );
      }
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const created = await galleryApi.create(establishmentId, {
        kind,
        beforeUrl: kind === "ba" ? beforeUrl : undefined,
        afterUrl: kind === "ba" ? afterUrl : undefined,
        photoUrl: kind === "single" ? photoUrl : undefined,
        title: title.trim() || undefined,
        description: description.trim() || undefined,
        professionalId: professionalId || undefined,
        serviceId: serviceId || undefined,
      });
      setItems((list) => [created, ...list]);
      resetForm();
      setShowForm(false);
      loadSpace();
    } catch (e: unknown) {
      const resp = (
        e as { response?: { status?: number; data?: { needSpace?: boolean } } }
      )?.response;
      // backend barrou por falta de espaco -> abre a compra de pacote
      if (resp?.status === 403 && resp?.data?.needSpace) {
        loadSpace();
        if (space?.isOwner) {
          setBuyingSpace(true);
        } else {
          setError(
            "Sem espaço na galeria. Peça ao dono para adicionar um pacote de espaço."
          );
        }
      } else {
        setError("Não foi possível salvar o registro.");
      }
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
      loadSpace(); // remover libera espaco (apaga do S3)
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

      {/* uso do espaco de armazenamento */}
      {space && (
        <div className="mb-4 rounded-xl border border-ink/10 bg-white p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              <span className="text-ink/70">Espaço de fotos: </span>
              <span className="font-semibold text-ink">
                {space.used} de {space.max} usados
              </span>
              <span className="text-ink/50">
                {" "}
                · {space.remaining} livre{space.remaining !== 1 ? "s" : ""}
              </span>
            </div>
            {space.isOwner && (
              <button
                onClick={() => setBuyingSpace(true)}
                className="rounded-lg border border-teal-500/40 px-3 py-1.5 text-xs font-semibold text-teal-600 transition hover:bg-teal-500/10"
              >
                + Adicionar espaço
              </button>
            )}
          </div>
          {/* barra de uso */}
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/10">
            <div
              className={`h-full rounded-full ${
                space.remaining <= 0 ? "bg-red-500" : "bg-teal-500"
              }`}
              style={{
                width: `${Math.min(100, (space.used / space.max) * 100)}%`,
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-ink/50">
            Foto normal usa 1 espaço · antes e depois usa 2. Você tem{" "}
            {space.singles} foto{space.singles !== 1 ? "s" : ""} e {space.bas}{" "}
            antes/depois.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Formulário */}
      {showForm && (
        <div className="mb-6 rounded-2xl border border-ink/10 bg-white p-5">
          <h3 className="font-display text-lg font-bold text-ink">
            Novo registro
          </h3>

          {/* tipo: antes/depois ou foto normal */}
          <div className="mt-3 flex gap-2">
            {(
              [
                ["ba", "Antes e depois"],
                ["single", "Foto normal"],
              ] as ["ba" | "single", string][]
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
                  kind === k
                    ? "border-teal-500 bg-teal-500 text-white"
                    : "border-ink/15 bg-white text-ink/70 hover:border-teal-500"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {kind === "ba" ? (
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
          ) : (
            <div className="mt-4">
              <ImageUpload
                value={photoUrl}
                onChange={setPhotoUrl}
                folder="galeria"
                label="Foto"
                hint="JPG, PNG ou WEBP, até 5 MB."
              />
            </div>
          )}

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

          {/* aviso de espaco deste tipo (single=1, antes/depois=2) */}
          {space && (
            <p
              className={`mt-4 rounded-lg px-3 py-2 text-xs font-medium ${
                space.remaining < (kind === "ba" ? 2 : 1)
                  ? "bg-amber-400/10 text-amber-700"
                  : "bg-sand/60 text-ink/60"
              }`}
            >
              {kind === "ba"
                ? "Antes e depois usa 2 espaços."
                : "Foto normal usa 1 espaço."}{" "}
              Você tem {space.remaining} livre
              {space.remaining !== 1 ? "s" : ""} de {space.max}.
              {space.remaining < (kind === "ba" ? 2 : 1) &&
                (space.isOwner
                  ? " Adicione um pacote de espaço para publicar."
                  : " Peça ao dono para adicionar um pacote de espaço.")}
            </p>
          )}

          <button
            onClick={submit}
            disabled={
              saving ||
              (kind === "single" ? !photoUrl : !beforeUrl || !afterUrl)
            }
            className="mt-4 h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-50"
          >
            {saving
              ? "Salvando..."
              : space &&
                  space.isOwner &&
                  space.remaining < (kind === "ba" ? 2 : 1)
                ? "Adicionar espaço e publicar"
                : "Publicar na galeria"}
          </button>
        </div>
      )}

      {buyingSpace && space && (
        <GallerySpaceModal
          establishmentId={establishmentId}
          space={space}
          onClose={() => setBuyingSpace(false)}
          onPurchased={loadSpace}
        />
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
              {item.kind === "single" ? (
                /* foto normal */
                <div className="relative">
                  <img
                    src={item.photoUrl}
                    alt={item.title || "Foto"}
                    className="h-44 w-full object-cover"
                  />
                </div>
              ) : (
                /* antes / depois lado a lado */
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
              )}

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