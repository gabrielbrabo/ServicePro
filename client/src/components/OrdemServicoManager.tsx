import { useEffect, useMemo, useState } from "react";
import {
  serviceOrderApi,
  ServiceOrder,
  OrderStatus,
  OrderPart,
  InspectionItem,
  InspectionStatus,
  MeasureItem,
  OrderHistoryItem,
} from "../api/serviceOrder";
import { formatPrice } from "../lib/time";
import { ImageUpload } from "./ImageUpload";
import { deleteUploadByUrl } from "../api/upload";

const STATUS: { key: OrderStatus; label: string; cls: string }[] = [
  {
    key: "orcamento",
    label: "Orçamento",
    cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  },
  {
    key: "aprovado",
    label: "Aprovado",
    cls: "bg-teal-500/15 text-teal-600 dark:text-teal-100",
  },
  {
    key: "em_execucao",
    label: "Em execução",
    cls: "bg-teal-500/15 text-teal-600 dark:text-teal-100",
  },
  {
    key: "concluido",
    label: "Concluído",
    cls: "bg-teal-500/25 text-teal-700 dark:text-teal-100",
  },
  {
    key: "entregue",
    label: "Entregue",
    cls: "bg-ink/10 text-ink/60",
  },
  {
    key: "cancelado",
    label: "Cancelado",
    cls: "bg-red-500/10 text-red-600 dark:text-red-300",
  },
];
const statusMeta = (s: OrderStatus) =>
  STATUS.find((x) => x.key === s) || STATUS[0];

const emptyVehicle = () => ({
  plate: "",
  brand: "",
  model: "",
  year: "",
  km: "",
  color: "",
  nextRevisionKm: "",
  nextRevisionDate: "",
});

const emptyEquipment = () => ({
  brand: "",
  model: "",
  serial: "",
  accessories: "",
  condition: "",
});

const emptyPest = () => ({
  targetPest: "",
  products: "",
  method: "",
  nextApplication: "",
  technician: "",
});

const emptyWarranty = () => ({
  coverage: "",
  exclusions: "",
});

const emptyMeasurements = () => ({
  garment: "",
  fabric: "",
  fittingDate: "",
  items: [] as MeasureItem[],
  notes: "",
});

// medidas sugeridas ao abrir a ficha de costura
const DEFAULT_MEASURES = [
  "Busto / Tórax",
  "Cintura",
  "Quadril",
  "Ombro",
  "Comprimento",
  "Manga",
  "Perna / Gancho",
];

// itens sugeridos do checklist automotivo
const DEFAULT_INSPECTION = [
  "Pneus",
  "Freios",
  "Óleo do motor",
  "Suspensão",
  "Bateria",
  "Luzes",
  "Fluidos",
  "Filtros",
  "Correias",
  "Escapamento",
];
const INSPECTION_OPTS: { key: InspectionStatus; label: string }[] = [
  { key: "na", label: "—" },
  { key: "ok", label: "OK" },
  { key: "atencao", label: "Atenção" },
  { key: "troca", label: "Trocar" },
];

const emptyForm = () => ({
  title: "",
  clientName: "",
  clientPhone: "",
  object: "",
  reportedProblem: "",
  diagnosis: "",
  parts: [] as OrderPart[],
  laborCost: "",
  discount: "",
  status: "orcamento" as OrderStatus,
  warrantyDays: "",
  warrantyNote: "",
  photosBefore: [] as string[],
  photosAfter: [] as string[],
  notes: "",
  vehicle: emptyVehicle(),
  inspection: [] as InspectionItem[],
  equipment: emptyEquipment(),
  technicalReport: "",
  pestControl: emptyPest(),
  warranty: emptyWarranty(),
  measurements: emptyMeasurements(),
  paymentMethod: "dinheiro" as "dinheiro" | "cartao" | "pix" | "outro",
});
type FormState = ReturnType<typeof emptyForm>;

const input =
  "h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500";
const area =
  "w-full rounded-xl border border-ink/15 bg-white px-3 py-2 outline-none focus:border-teal-500";
const lbl = "mb-1 block text-sm font-medium text-ink/70";

export function OrdemServicoManager({
  establishmentId,
  showVehicle = false,
  showEquipment = false,
  showPest = false,
  showWarranty = false,
  showMeasurements = false,
}: {
  establishmentId: string;
  showVehicle?: boolean; // categoria automotiva (módulo "veiculo")
  showEquipment?: boolean; // assistência técnica (módulo "equipamento")
  showPest?: boolean; // dedetização (módulo "dedetizacao")
  showWarranty?: boolean; // refrigeração / elétrica-hidráulica (módulo "garantia")
  showMeasurements?: boolean; // costura / ajustes (módulo "medidas")
}) {
  const [orders, setOrders] = useState<ServiceOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | "new" | null>(null); // id, "new" ou fechado
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // historico do veiculo (OS anteriores da mesma placa)
  const [history, setHistory] = useState<OrderHistoryItem[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = () => {
    setLoading(true);
    serviceOrderApi
      .list(establishmentId)
      .then(setOrders)
      .catch(() => setError("Não foi possível carregar as ordens."))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [establishmentId]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const partsTotal = useMemo(
    () =>
      form.parts.reduce(
        (sum, p) => sum + (Number(p.qty) || 0) * (Number(p.unitPrice) || 0),
        0
      ),
    [form.parts]
  );
  const total = Math.max(
    0,
    partsTotal + (Number(form.laborCost) || 0) - (Number(form.discount) || 0)
  );

  const startNew = () => {
    const f = emptyForm();
    if (showVehicle)
      f.inspection = DEFAULT_INSPECTION.map((item) => ({
        item,
        status: "na" as InspectionStatus,
        note: "",
      }));
    if (showMeasurements)
      f.measurements.items = DEFAULT_MEASURES.map((name) => ({
        name,
        value: "",
      }));
    setForm(f);
    setEditing("new");
    setError("");
    setHistory([]);
    setHistoryOpen(false);
  };
  const startEdit = (o: ServiceOrder) => {
    setForm({
      title: o.title,
      clientName: o.clientName,
      clientPhone: o.clientPhone,
      object: o.object,
      reportedProblem: o.reportedProblem,
      diagnosis: o.diagnosis,
      parts: o.parts || [],
      laborCost: o.laborCost ? String(o.laborCost) : "",
      discount: o.discount ? String(o.discount) : "",
      status: o.status,
      warrantyDays: o.warrantyDays ? String(o.warrantyDays) : "",
      warrantyNote: o.warrantyNote,
      photosBefore: o.photosBefore || [],
      photosAfter: o.photosAfter || [],
      notes: o.notes,
      vehicle: {
        plate: o.vehicle?.plate ?? "",
        brand: o.vehicle?.brand ?? "",
        model: o.vehicle?.model ?? "",
        year: o.vehicle?.year ? String(o.vehicle.year) : "",
        km: o.vehicle?.km ? String(o.vehicle.km) : "",
        color: o.vehicle?.color ?? "",
        nextRevisionKm: o.vehicle?.nextRevisionKm
          ? String(o.vehicle.nextRevisionKm)
          : "",
        nextRevisionDate: o.vehicle?.nextRevisionDate ?? "",
      },
      inspection: o.inspection ?? [],
      equipment: {
        brand: o.equipment?.brand ?? "",
        model: o.equipment?.model ?? "",
        serial: o.equipment?.serial ?? "",
        accessories: o.equipment?.accessories ?? "",
        condition: o.equipment?.condition ?? "",
      },
      technicalReport: o.technicalReport ?? "",
      pestControl: {
        targetPest: o.pestControl?.targetPest ?? "",
        products: o.pestControl?.products ?? "",
        method: o.pestControl?.method ?? "",
        nextApplication: o.pestControl?.nextApplication ?? "",
        technician: o.pestControl?.technician ?? "",
      },
      warranty: {
        coverage: o.warranty?.coverage ?? "",
        exclusions: o.warranty?.exclusions ?? "",
      },
      measurements: {
        garment: o.measurements?.garment ?? "",
        fabric: o.measurements?.fabric ?? "",
        fittingDate: o.measurements?.fittingDate ?? "",
        items: o.measurements?.items ?? [],
        notes: o.measurements?.notes ?? "",
      },
      paymentMethod: o.paymentMethod ?? "dinheiro",
    });
    setEditing(o._id);
    setError("");
    setHistory([]);
    setHistoryOpen(false);
    if (showVehicle && o.vehicle?.plate) loadHistory(o.vehicle.plate);
  };
  const cancel = () => {
    setEditing(null);
    setError("");
  };

  const fmtDate = (iso: string) => {
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "2-digit",
        });
  };
  // busca as OS anteriores da mesma placa
  const loadHistory = (plate: string) => {
    setHistoryOpen(true);
    const p = plate.trim();
    if (!p) {
      setHistory([]);
      return;
    }
    setHistoryLoading(true);
    serviceOrderApi
      .history(establishmentId, p)
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  };

  const addPart = () =>
    set("parts", [...form.parts, { description: "", qty: 1, unitPrice: 0 }]);
  const updatePart = (i: number, patch: Partial<OrderPart>) =>
    set(
      "parts",
      form.parts.map((p, idx) => (idx === i ? { ...p, ...patch } : p))
    );
  const removePart = (i: number) =>
    set(
      "parts",
      form.parts.filter((_, idx) => idx !== i)
    );

  const setVehicle = (k: keyof FormState["vehicle"], v: string) =>
    set("vehicle", { ...form.vehicle, [k]: v });
  const setEquipment = (k: keyof FormState["equipment"], v: string) =>
    set("equipment", { ...form.equipment, [k]: v });
  const setPest = (k: keyof FormState["pestControl"], v: string) =>
    set("pestControl", { ...form.pestControl, [k]: v });
  const setWarranty = (k: keyof FormState["warranty"], v: string) =>
    set("warranty", { ...form.warranty, [k]: v });
  const setMeasure = (
    k: "garment" | "fabric" | "fittingDate" | "notes",
    v: string
  ) => set("measurements", { ...form.measurements, [k]: v });
  const addMeasureItem = () =>
    set("measurements", {
      ...form.measurements,
      items: [...form.measurements.items, { name: "", value: "" }],
    });
  const updateMeasureItem = (i: number, patch: Partial<MeasureItem>) =>
    set("measurements", {
      ...form.measurements,
      items: form.measurements.items.map((x, idx) =>
        idx === i ? { ...x, ...patch } : x
      ),
    });
  const removeMeasureItem = (i: number) =>
    set("measurements", {
      ...form.measurements,
      items: form.measurements.items.filter((_, idx) => idx !== i),
    });
  const addInspection = () =>
    set("inspection", [
      ...form.inspection,
      { item: "", status: "na" as InspectionStatus, note: "" },
    ]);
  const updateInspection = (i: number, patch: Partial<InspectionItem>) =>
    set(
      "inspection",
      form.inspection.map((x, idx) => (idx === i ? { ...x, ...patch } : x))
    );
  const removeInspection = (i: number) =>
    set(
      "inspection",
      form.inspection.filter((_, idx) => idx !== i)
    );

  const addPhoto = (field: "photosBefore" | "photosAfter", url: string) => {
    if (url) set(field, [...form[field], url]);
  };
  const removePhoto = (field: "photosBefore" | "photosAfter", url: string) => {
    set(
      field,
      form[field].filter((u) => u !== url)
    );
    void deleteUploadByUrl(url);
  };

  const save = async () => {
    if (!form.title.trim() && !form.clientName.trim()) {
      setError("Preencha ao menos o assunto ou o nome do cliente.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      title: form.title.trim(),
      clientName: form.clientName.trim(),
      clientPhone: form.clientPhone.trim(),
      object: form.object.trim(),
      reportedProblem: form.reportedProblem.trim(),
      diagnosis: form.diagnosis.trim(),
      parts: form.parts,
      laborCost: Math.max(0, Number(form.laborCost) || 0),
      discount: Math.max(0, Number(form.discount) || 0),
      status: form.status,
      warrantyDays: Math.max(0, Math.floor(Number(form.warrantyDays) || 0)),
      warrantyNote: form.warrantyNote.trim(),
      photosBefore: form.photosBefore,
      photosAfter: form.photosAfter,
      notes: form.notes.trim(),
      vehicle: {
        plate: form.vehicle.plate.trim(),
        brand: form.vehicle.brand.trim(),
        model: form.vehicle.model.trim(),
        year: Math.max(0, Number(form.vehicle.year) || 0),
        km: Math.max(0, Number(form.vehicle.km) || 0),
        color: form.vehicle.color.trim(),
        nextRevisionKm: Math.max(0, Number(form.vehicle.nextRevisionKm) || 0),
        nextRevisionDate: form.vehicle.nextRevisionDate.trim(),
      },
      inspection: form.inspection.filter((i) => i.item.trim()),
      equipment: {
        brand: form.equipment.brand.trim(),
        model: form.equipment.model.trim(),
        serial: form.equipment.serial.trim(),
        accessories: form.equipment.accessories.trim(),
        condition: form.equipment.condition.trim(),
      },
      technicalReport: form.technicalReport.trim(),
      pestControl: {
        targetPest: form.pestControl.targetPest.trim(),
        products: form.pestControl.products.trim(),
        method: form.pestControl.method.trim(),
        nextApplication: form.pestControl.nextApplication.trim(),
        technician: form.pestControl.technician.trim(),
      },
      warranty: {
        coverage: form.warranty.coverage.trim(),
        exclusions: form.warranty.exclusions.trim(),
      },
      measurements: {
        garment: form.measurements.garment.trim(),
        fabric: form.measurements.fabric.trim(),
        fittingDate: form.measurements.fittingDate.trim(),
        items: form.measurements.items
          .map((m) => ({ name: m.name.trim(), value: m.value.trim() }))
          .filter((m) => m.name !== "" || m.value !== ""),
        notes: form.measurements.notes.trim(),
      },
      paymentMethod: form.paymentMethod,
    };
    try {
      if (editing === "new") {
        const created = await serviceOrderApi.create(establishmentId, payload);
        setOrders((list) => [created, ...list]);
      } else if (editing) {
        const updated = await serviceOrderApi.update(
          establishmentId,
          editing,
          payload
        );
        setOrders((list) =>
          list.map((o) => (o._id === editing ? updated : o))
        );
      }
      setEditing(null);
    } catch {
      setError("Não foi possível salvar a ordem.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await serviceOrderApi.remove(establishmentId, id);
    setOrders((list) => list.filter((o) => o._id !== id));
  };

  // abre o PDF da OS (nova aba) para imprimir ou enviar ao cliente
  const openPdf = async (id: string) => {
    try {
      const blob = await serviceOrderApi.pdf(establishmentId, id);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch {
      setError("Não foi possível gerar o PDF.");
    }
  };

  // ---- editor (criar/editar) ----
  if (editing) {
    const historyList = history.filter((h) => h._id !== editing);
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink">
            {editing === "new" ? "Nova ordem de serviço" : "Editar OS"}
          </h3>
          <button
            onClick={cancel}
            className="rounded-lg border border-ink/15 px-3 py-1.5 text-sm font-medium text-ink/70 transition hover:bg-sand"
          >
            Voltar
          </button>
        </div>

        <div className="space-y-4 rounded-2xl border border-ink/10 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={lbl}>Assunto</span>
              <input
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Ex: Conserto de geladeira Brastemp"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Cliente</span>
              <input
                value={form.clientName}
                onChange={(e) => set("clientName", e.target.value)}
                placeholder="Nome do cliente"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Telefone</span>
              <input
                value={form.clientPhone}
                onChange={(e) => set("clientPhone", e.target.value)}
                placeholder="(38) 99999-0000"
                className={input}
              />
            </label>
            <label className="block sm:col-span-2">
              <span className={lbl}>Objeto (equipamento / veículo / local)</span>
              <input
                value={form.object}
                onChange={(e) => set("object", e.target.value)}
                placeholder="Ex: Geladeira Brastemp Frost Free 375L, série X123"
                className={input}
              />
            </label>
          </div>

          {/* Veículo (categoria automotiva) */}
          {showVehicle && (
            <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Veículo
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Placa
                  </span>
                  <input
                    value={form.vehicle.plate}
                    onChange={(e) => setVehicle("plate", e.target.value)}
                    placeholder="ABC1D23"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 uppercase outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Marca
                  </span>
                  <input
                    value={form.vehicle.brand}
                    onChange={(e) => setVehicle("brand", e.target.value)}
                    placeholder="Fiat"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Modelo
                  </span>
                  <input
                    value={form.vehicle.model}
                    onChange={(e) => setVehicle("model", e.target.value)}
                    placeholder="Uno"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Ano
                  </span>
                  <input
                    type="number"
                    value={form.vehicle.year}
                    onChange={(e) => setVehicle("year", e.target.value)}
                    placeholder="2018"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    KM
                  </span>
                  <input
                    type="number"
                    value={form.vehicle.km}
                    onChange={(e) => setVehicle("km", e.target.value)}
                    placeholder="80000"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Cor
                  </span>
                  <input
                    value={form.vehicle.color}
                    onChange={(e) => setVehicle("color", e.target.value)}
                    placeholder="Prata"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Próxima revisão (km)
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={form.vehicle.nextRevisionKm}
                    onChange={(e) =>
                      setVehicle("nextRevisionKm", e.target.value)
                    }
                    placeholder="90000"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Próxima revisão (data)
                  </span>
                  <input
                    value={form.vehicle.nextRevisionDate}
                    onChange={(e) =>
                      setVehicle("nextRevisionDate", e.target.value)
                    }
                    placeholder="Ex: 03/2027 ou 6 meses"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Histórico do veículo (mesma placa) */}
          {showVehicle && (
            <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink/70">
                  Histórico do veículo
                </span>
                <button
                  type="button"
                  onClick={() => loadHistory(form.vehicle.plate)}
                  className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
                >
                  Buscar pela placa
                </button>
              </div>
              {(() => {
                const nr = historyList.find(
                  (h) =>
                    h.vehicle &&
                    (h.vehicle.nextRevisionKm || h.vehicle.nextRevisionDate)
                )?.vehicle;
                if (!nr) return null;
                const parts = [
                  nr.nextRevisionKm ? `${nr.nextRevisionKm} km` : "",
                  nr.nextRevisionDate || "",
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <p className="mb-2 rounded-lg bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                    Próxima revisão registrada: {parts}
                  </p>
                );
              })()}
              {!form.vehicle.plate.trim() ? (
                <p className="text-xs text-ink/40">
                  Informe a placa acima para ver as OS anteriores deste veículo.
                </p>
              ) : !historyOpen ? (
                <p className="text-xs text-ink/40">
                  Clique em "Buscar pela placa".
                </p>
              ) : historyLoading ? (
                <p className="text-xs text-ink/50">Carregando...</p>
              ) : historyList.length === 0 ? (
                <p className="text-xs text-ink/40">
                  Nenhuma OS anterior para a placa{" "}
                  {form.vehicle.plate.toUpperCase()}.
                </p>
              ) : (
                <div className="space-y-1">
                  {historyList.map((h) => {
                    const hm = statusMeta(h.status);
                    return (
                      <div
                        key={h._id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white px-3 py-1.5 text-sm"
                      >
                        <span className="min-w-0 truncate text-ink/70">
                          OS #{h.number} · {fmtDate(h.createdAt)}
                          {h.title || h.object
                            ? ` · ${h.title || h.object}`
                            : ""}
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="font-semibold text-teal-600 dark:text-teal-100">
                            {formatPrice(h.total)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${hm.cls}`}
                          >
                            {hm.label}
                          </span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Equipamento (categoria assistência técnica) */}
          {showEquipment && (
            <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Equipamento
              </span>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Marca
                  </span>
                  <input
                    value={form.equipment.brand}
                    onChange={(e) => setEquipment("brand", e.target.value)}
                    placeholder="Samsung"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Modelo
                  </span>
                  <input
                    value={form.equipment.model}
                    onChange={(e) => setEquipment("model", e.target.value)}
                    placeholder="Galaxy A54"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Nº de série
                  </span>
                  <input
                    value={form.equipment.serial}
                    onChange={(e) => setEquipment("serial", e.target.value)}
                    placeholder="SN123456"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Acessórios que acompanham
                  </span>
                  <input
                    value={form.equipment.accessories}
                    onChange={(e) =>
                      setEquipment("accessories", e.target.value)
                    }
                    placeholder="Carregador, capa"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Estado na entrada
                  </span>
                  <input
                    value={form.equipment.condition}
                    onChange={(e) => setEquipment("condition", e.target.value)}
                    placeholder="Tela riscada, liga normal"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
              </div>
            </div>
          )}

          <label className="block">
            <span className={lbl}>Defeito relatado</span>
            <textarea
              value={form.reportedProblem}
              onChange={(e) => set("reportedProblem", e.target.value)}
              rows={2}
              placeholder="O que o cliente relatou"
              className={area}
            />
          </label>
          <label className="block">
            <span className={lbl}>Diagnóstico técnico</span>
            <textarea
              value={form.diagnosis}
              onChange={(e) => set("diagnosis", e.target.value)}
              rows={2}
              placeholder="O que foi identificado"
              className={area}
            />
          </label>

          {/* Laudo técnico (assistência técnica) */}
          {showEquipment && (
            <label className="block">
              <span className={lbl}>Laudo técnico</span>
              <textarea
                value={form.technicalReport}
                onChange={(e) => set("technicalReport", e.target.value)}
                rows={3}
                placeholder="Parecer técnico: viabilidade do reparo, recomendações, riscos..."
                className={area}
              />
            </label>
          )}

          {/* Dedetização (certificado) */}
          {showPest && (
            <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Certificado de dedetização
              </span>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Praga-alvo
                  </span>
                  <input
                    value={form.pestControl.targetPest}
                    onChange={(e) => setPest("targetPest", e.target.value)}
                    placeholder="Baratas, ratos, cupins"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Método
                  </span>
                  <input
                    value={form.pestControl.method}
                    onChange={(e) => setPest("method", e.target.value)}
                    placeholder="Pulverização, gel, iscas"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Produtos utilizados (princípio ativo)
                  </span>
                  <input
                    value={form.pestControl.products}
                    onChange={(e) => setPest("products", e.target.value)}
                    placeholder="Ex: Fipronil 2,5%"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Próxima aplicação / validade
                  </span>
                  <input
                    value={form.pestControl.nextApplication}
                    onChange={(e) => setPest("nextApplication", e.target.value)}
                    placeholder="Ex: 6 meses / 20/02/2027"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Responsável técnico
                  </span>
                  <input
                    value={form.pestControl.technician}
                    onChange={(e) => setPest("technician", e.target.value)}
                    placeholder="Nome + registro"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
              </div>
            </div>
          )}

          {/* Ficha de medidas (costura / ajustes) */}
          {showMeasurements && (
            <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink/70">
                  Ficha de medidas
                </span>
                <button
                  type="button"
                  onClick={addMeasureItem}
                  className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
                >
                  + Medida
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Peça
                  </span>
                  <input
                    value={form.measurements.garment}
                    onChange={(e) => setMeasure("garment", e.target.value)}
                    placeholder="Vestido, calça, terno..."
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Tecido
                  </span>
                  <input
                    value={form.measurements.fabric}
                    onChange={(e) => setMeasure("fabric", e.target.value)}
                    placeholder="Algodão, linho, alfaiataria..."
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Prova / entrega
                  </span>
                  <input
                    value={form.measurements.fittingDate}
                    onChange={(e) => setMeasure("fittingDate", e.target.value)}
                    placeholder="Ex: 20/09 ou 1ª prova dia 15"
                    className="h-10 w-full rounded-lg border border-ink/15 bg-white px-2 outline-none focus:border-teal-500"
                  />
                </label>
              </div>
              <div className="mt-3 space-y-2">
                {form.measurements.items.length === 0 && (
                  <p className="text-xs text-ink/40">Nenhuma medida.</p>
                )}
                {form.measurements.items.map((it, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={it.name}
                      onChange={(e) =>
                        updateMeasureItem(i, { name: e.target.value })
                      }
                      placeholder="Medida (ex: Cintura)"
                      className="h-9 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    />
                    <input
                      value={it.value}
                      onChange={(e) =>
                        updateMeasureItem(i, { value: e.target.value })
                      }
                      placeholder="Valor (ex: 72 cm)"
                      className="h-9 w-32 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeMeasureItem(i)}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                      aria-label="Remover medida"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
              <label className="mt-3 block">
                <span className="mb-1 block text-xs font-medium text-ink/70">
                  Observações da costura
                </span>
                <textarea
                  value={form.measurements.notes}
                  onChange={(e) => setMeasure("notes", e.target.value)}
                  rows={2}
                  placeholder="Ajustes pedidos, referências, detalhes do modelo..."
                  className={area}
                />
              </label>
            </div>
          )}

          {/* Inspeção (checklist automotivo) */}
          {showVehicle && (
            <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-ink/70">Inspeção</span>
                <button
                  type="button"
                  onClick={addInspection}
                  className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
                >
                  + Item
                </button>
              </div>
              {form.inspection.length === 0 && (
                <p className="text-xs text-ink/40">Nenhum item.</p>
              )}
              <div className="space-y-2">
                {form.inspection.map((it, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <input
                      value={it.item}
                      onChange={(e) =>
                        updateInspection(i, { item: e.target.value })
                      }
                      placeholder="Item"
                      className="h-9 min-w-[110px] flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    />
                    <select
                      value={it.status}
                      onChange={(e) =>
                        updateInspection(i, {
                          status: e.target.value as InspectionStatus,
                        })
                      }
                      className="h-9 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    >
                      {INSPECTION_OPTS.map((o) => (
                        <option key={o.key} value={o.key}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={it.note}
                      onChange={(e) =>
                        updateInspection(i, { note: e.target.value })
                      }
                      placeholder="Obs."
                      className="h-9 w-28 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => removeInspection(i)}
                      className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                      aria-label="Remover item"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Peças / materiais */}
          <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink/70">
                Peças / materiais
              </span>
              <button
                type="button"
                onClick={addPart}
                className="rounded-lg bg-teal-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-teal-600"
              >
                + Item
              </button>
            </div>
            {form.parts.length === 0 && (
              <p className="text-xs text-ink/40">Nenhum item adicionado.</p>
            )}
            <div className="space-y-2">
              {form.parts.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.description}
                    onChange={(e) =>
                      updatePart(i, { description: e.target.value })
                    }
                    placeholder="Descrição"
                    className="h-9 min-w-0 flex-1 rounded-lg border border-ink/15 bg-white px-2 text-sm outline-none focus:border-teal-500"
                  />
                  <input
                    type="number"
                    min="0"
                    value={p.qty}
                    onChange={(e) =>
                      updatePart(i, { qty: Number(e.target.value) })
                    }
                    className="h-9 w-14 rounded-lg border border-ink/15 bg-white px-2 text-right text-sm outline-none focus:border-teal-500"
                    title="Quantidade"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={p.unitPrice}
                    onChange={(e) =>
                      updatePart(i, { unitPrice: Number(e.target.value) })
                    }
                    className="h-9 w-24 rounded-lg border border-ink/15 bg-white px-2 text-right text-sm outline-none focus:border-teal-500"
                    title="Valor unitário"
                  />
                  <button
                    type="button"
                    onClick={() => removePart(i)}
                    className="shrink-0 rounded-lg px-2 py-1 text-sm text-red-500 hover:bg-red-500/10"
                    aria-label="Remover item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Valores */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={lbl}>Mão de obra (R$)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.laborCost}
                onChange={(e) => set("laborCost", e.target.value)}
                placeholder="0"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Desconto (R$)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.discount}
                onChange={(e) => set("discount", e.target.value)}
                placeholder="0"
                className={input}
              />
            </label>
            <div className="flex flex-col justify-end">
              <span className={lbl}>Total</span>
              <div className="flex h-11 items-center rounded-xl bg-teal-500/10 px-3 font-semibold text-teal-600 dark:text-teal-100">
                {formatPrice(total)}
              </div>
            </div>
          </div>

          {/* Status + garantia */}
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block">
              <span className={lbl}>Status</span>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value as OrderStatus)}
                className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500"
              >
                {STATUS.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={lbl}>Garantia (dias)</span>
              <input
                type="number"
                min="0"
                value={form.warrantyDays}
                onChange={(e) => set("warrantyDays", e.target.value)}
                placeholder="0"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Obs. da garantia</span>
              <input
                value={form.warrantyNote}
                onChange={(e) => set("warrantyNote", e.target.value)}
                placeholder="Ex: cobre a peça trocada"
                className={input}
              />
            </label>
            <label className="block">
              <span className={lbl}>Forma de pagamento</span>
              <select
                value={form.paymentMethod}
                onChange={(e) =>
                  set(
                    "paymentMethod",
                    e.target.value as FormState["paymentMethod"]
                  )
                }
                className="h-11 w-full rounded-xl border border-ink/15 bg-white px-3 outline-none focus:border-teal-500"
              >
                <option value="dinheiro">Dinheiro</option>
                <option value="cartao">Cartão</option>
                <option value="pix">PIX</option>
                <option value="outro">Outro</option>
              </select>
              <span className="mt-1 block text-xs text-ink/40">
                Ao marcar a OS como "Entregue", o total entra no caixa.
              </span>
            </label>
          </div>

          {/* Termo de garantia (refrigeração / elétrica-hidráulica) */}
          {showWarranty && (
            <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
              <span className="mb-2 block text-sm font-medium text-ink/70">
                Termo de garantia
              </span>
              <span className="mb-3 block text-xs text-ink/40">
                Use o prazo em "Garantia (dias)" acima. Descreva abaixo o que a
                garantia cobre e o que a invalida — sai como termo formal no PDF.
              </span>
              <div className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Cobertura
                  </span>
                  <textarea
                    value={form.warranty.coverage}
                    onChange={(e) => setWarranty("coverage", e.target.value)}
                    rows={2}
                    placeholder="Ex: mão de obra e peças substituídas no serviço descrito"
                    className={area}
                  />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/70">
                    Exclusões (perda da garantia)
                  </span>
                  <textarea
                    value={form.warranty.exclusions}
                    onChange={(e) => setWarranty("exclusions", e.target.value)}
                    rows={2}
                    placeholder="Ex: mau uso, oscilação/queda de energia, intervenção de terceiros, danos por infiltração"
                    className={area}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Fotos */}
          <div className="grid gap-4 sm:grid-cols-2">
            <PhotoField
              label="Fotos — antes"
              urls={form.photosBefore}
              onAdd={(u) => addPhoto("photosBefore", u)}
              onRemove={(u) => removePhoto("photosBefore", u)}
            />
            <PhotoField
              label="Fotos — depois"
              urls={form.photosAfter}
              onAdd={(u) => addPhoto("photosAfter", u)}
              onRemove={(u) => removePhoto("photosAfter", u)}
            />
          </div>

          <label className="block">
            <span className={lbl}>Observações</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className={area}
            />
          </label>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="h-11 rounded-xl bg-teal-500 px-6 font-semibold text-white transition hover:bg-teal-600 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar OS"}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="h-11 rounded-xl border border-ink/15 px-6 font-medium text-ink/70 transition hover:bg-sand disabled:opacity-60"
            >
              Cancelar
            </button>
            {editing !== "new" && (
              <button
                type="button"
                onClick={() => openPdf(editing)}
                className="ml-auto h-11 rounded-xl border border-teal-500 px-6 font-semibold text-teal-600 transition hover:bg-teal-500 hover:text-white dark:text-teal-100"
              >
                Gerar PDF
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---- lista ----
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-ink/60">
          {orders.length} ordem{orders.length !== 1 ? "s" : ""} de serviço
        </p>
        <button
          onClick={startNew}
          className="rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-600"
        >
          + Nova OS
        </button>
      </div>

      {loading ? (
        <p className="text-ink/50">Carregando...</p>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 p-8 text-center text-ink/50">
          Nenhuma ordem de serviço ainda. Crie a primeira.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {orders.map((o) => {
            const m = statusMeta(o.status);
            return (
              <button
                key={o._id}
                onClick={() => startEdit(o)}
                className="rounded-2xl border border-ink/10 bg-white p-4 text-left transition hover:border-teal-500"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-ink/40">
                      OS #{o.number}
                    </p>
                    <h4 className="truncate font-display font-bold text-ink">
                      {o.title || o.clientName || "Sem título"}
                    </h4>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${m.cls}`}
                  >
                    {m.label}
                  </span>
                </div>
                {(o.clientName || o.object) && (
                  <p className="mt-1 truncate text-sm text-ink/60">
                    {[o.clientName, o.object].filter(Boolean).join(" · ")}
                  </p>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-semibold text-teal-600 dark:text-teal-100">
                    {formatPrice(o.total)}
                  </span>
                  <span className="flex items-center gap-3">
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        openPdf(o._id);
                      }}
                      className="text-xs font-medium text-teal-600 hover:underline dark:text-teal-100"
                    >
                      PDF
                    </span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        remove(o._id);
                      }}
                      className="text-xs font-medium text-red-500 hover:underline"
                    >
                      Remover
                    </span>
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// campo de multiplas fotos: miniaturas + um seletor para adicionar
function PhotoField({
  label,
  urls,
  onAdd,
  onRemove,
}: {
  label: string;
  urls: string[];
  onAdd: (url: string) => void;
  onRemove: (url: string) => void;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-sand/40 p-3">
      <span className="mb-2 block text-sm font-medium text-ink/70">{label}</span>
      {urls.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {urls.map((u) => (
            <div key={u} className="relative">
              <img
                src={u}
                alt=""
                className="h-16 w-16 rounded-lg object-cover"
              />
              <button
                type="button"
                onClick={() => onRemove(u)}
                className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white"
                aria-label="Remover foto"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
      <ImageUpload
        value=""
        onChange={onAdd}
        folder="servicos"
        label=""
        hint="Adicione uma foto por vez."
      />
    </div>
  );
}
