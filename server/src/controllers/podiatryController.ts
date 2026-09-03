import { Response } from "express";
import { Types } from "mongoose";
import { PodiatryProfile } from "../models/PodiatryProfile";
import { PodiatrySession } from "../models/PodiatrySession";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";
import { generatePodiatrySessionPdf } from "../utils/podiatrySessionPdf";

// dono OU membro do estabelecimento
const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  }).select("_id");
  return !!est;
};

// so cria ficha para paciente que ja tem atendimento no estabelecimento
const clientHasBooking = async (
  establishmentId: string,
  clientId: string
): Promise<boolean> => {
  const b = await Booking.findOne({
    establishment: establishmentId,
    client: clientId,
  }).select("_id");
  return !!b;
};

const cleanText = (v: unknown): string =>
  typeof v === "string" ? v.trim() : "";

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

// ============ FICHA / PERFIL ============

// GET /api/podiatry/:establishmentId/:clientId/profile
export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const profile = await PodiatryProfile.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!profile) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        mainComplaint: "",
        diabetic: false,
        circulationNotes: "",
        footType: "",
        footwear: "",
        allergies: "",
        healthNotes: "",
        photos: [],
        _isNew: true,
      });
      return;
    }
    res.json(profile);
  } catch (err) {
    console.error("getProfile:", err);
    res.status(500).json({ message: "Erro ao buscar a ficha do paciente" });
  }
};

// PUT /api/podiatry/:establishmentId/:clientId/profile  (upsert)
export const updateProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este paciente nao tem atendimentos no estabelecimento",
      });
      return;
    }
    const photos = Array.isArray(req.body.photos)
      ? (req.body.photos as unknown[])
          .map((p) => {
            const it = (p || {}) as Record<string, unknown>;
            const url = cleanText(it.url);
            if (!url) return null;
            const d = it.date ? new Date(it.date as string) : new Date();
            return {
              url,
              date: isNaN(d.getTime()) ? new Date() : d,
              note: cleanText(it.note),
            };
          })
          .filter((p): p is { url: string; date: Date; note: string } => !!p)
      : [];
    const update = {
      mainComplaint: cleanText(req.body.mainComplaint),
      diabetic: Boolean(req.body.diabetic),
      circulationNotes: cleanText(req.body.circulationNotes),
      footType: cleanText(req.body.footType),
      footwear: cleanText(req.body.footwear),
      allergies: cleanText(req.body.allergies),
      healthNotes: cleanText(req.body.healthNotes),
      photos,
    };
    const profile = await PodiatryProfile.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      {
        $set: update,
        $setOnInsert: { establishment: establishmentId, client: clientId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(profile);
  } catch (err) {
    console.error("updateProfile:", err);
    res.status(500).json({ message: "Erro ao salvar a ficha do paciente" });
  }
};

// ============ ATENDIMENTOS (mapa + procedimentos + antes/depois) ============

const FEET = ["left", "right"];
const VIEWS = ["dorsal", "plantar"];

const sanitizeFindings = (raw: unknown) =>
  Array.isArray(raw)
    ? (raw as unknown[])
        .map((f) => {
          const it = (f || {}) as Record<string, unknown>;
          const foot = FEET.includes(String(it.foot))
            ? (it.foot as string)
            : "left";
          const view = VIEWS.includes(String(it.view))
            ? (it.view as string)
            : "dorsal";
          return {
            foot,
            view,
            region: cleanText(it.region),
            condition: cleanText(it.condition),
            severity: cleanText(it.severity),
            note: cleanText(it.note),
          };
        })
        .filter((f) => f.region !== "" && f.condition !== "")
    : [];

const sanitizeProcedures = (raw: unknown) =>
  Array.isArray(raw)
    ? (raw as unknown[])
        .map((p) => {
          const it = (p || {}) as Record<string, unknown>;
          return {
            name: cleanText(it.name),
            region: cleanText(it.region),
            materials: cleanText(it.materials),
            note: cleanText(it.note),
          };
        })
        .filter((p) => p.name !== "")
    : [];

const sanitizePhotos = (raw: unknown) =>
  Array.isArray(raw)
    ? (raw as unknown[])
        .map((p) => {
          const it = (p || {}) as Record<string, unknown>;
          return { url: cleanText(it.url), note: cleanText(it.note) };
        })
        .filter((p) => p.url !== "")
    : [];

const buildSessionData = (body: Record<string, unknown>) => {
  const data: Record<string, unknown> = {
    findings: sanitizeFindings(body.findings),
    procedures: sanitizeProcedures(body.procedures),
    beforePhotos: sanitizePhotos(body.beforePhotos),
    afterPhotos: sanitizePhotos(body.afterPhotos),
    recommendations: cleanText(body.recommendations),
    notes: cleanText(body.notes),
  };
  if (body.nextVisit) {
    const d = new Date(body.nextVisit as string);
    if (!isNaN(d.getTime())) data.nextVisit = d;
  } else if (body.nextVisit === null || body.nextVisit === "") {
    data.nextVisit = undefined;
  }
  return data;
};

async function loadSession(
  establishmentId: string,
  clientId: string,
  sessionId: string
) {
  if (!Types.ObjectId.isValid(sessionId)) return null;
  return PodiatrySession.findOne({
    _id: sessionId,
    establishment: establishmentId,
    client: clientId,
  });
}

// GET /api/podiatry/:establishmentId/:clientId/sessions
export const listSessions = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await PodiatrySession.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listSessions:", err);
    res.status(500).json({ message: "Erro ao listar atendimentos" });
  }
};

// POST /api/podiatry/:establishmentId/:clientId/sessions
export const createSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este paciente nao tem atendimentos no estabelecimento",
      });
      return;
    }
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    const item = await PodiatrySession.create({
      establishment: establishmentId,
      client: clientId,
      author: req.userId,
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      ...buildSessionData(req.body),
    });
    const withAuthor = await item.populate("author", "name");
    res.status(201).json(withAuthor);
  } catch (err) {
    console.error("createSession:", err);
    res.status(500).json({ message: "Erro ao criar atendimento" });
  }
};

// PUT /api/podiatry/:establishmentId/:clientId/sessions/:sessionId
export const updateSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, sessionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadSession(establishmentId, clientId, sessionId);
    if (!item) {
      res.status(404).json({ message: "Atendimento nao encontrado" });
      return;
    }
    const data = buildSessionData(req.body);
    // nextVisit pode ser limpo explicitamente
    if ("nextVisit" in data && data.nextVisit === undefined) {
      item.set("nextVisit", undefined);
      delete (data as Record<string, unknown>).nextVisit;
    }
    Object.assign(item, data);
    if (req.body.date !== undefined) {
      const d = new Date(req.body.date);
      if (!isNaN(d.getTime())) item.date = d;
    }
    await item.save();
    const withAuthor = await item.populate("author", "name");
    res.json(withAuthor);
  } catch (err) {
    console.error("updateSession:", err);
    res.status(500).json({ message: "Erro ao atualizar atendimento" });
  }
};

// DELETE /api/podiatry/:establishmentId/:clientId/sessions/:sessionId
export const deleteSession = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, sessionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadSession(establishmentId, clientId, sessionId);
    if (!item) {
      res.status(404).json({ message: "Atendimento nao encontrado" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Atendimento removido", _id: sessionId });
  } catch (err) {
    console.error("deleteSession:", err);
    res.status(500).json({ message: "Erro ao remover atendimento" });
  }
};

// GET /api/podiatry/:establishmentId/:clientId/sessions/:sessionId/pdf
export const sessionPdf = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, sessionId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const [session, est, profile] = await Promise.all([
      loadSession(establishmentId, clientId, sessionId),
      Establishment.findById(establishmentId).select("name address phone"),
      PodiatryProfile.findOne({
        establishment: establishmentId,
        client: clientId,
      }),
    ]);
    if (!session) {
      res.status(404).json({ message: "Atendimento nao encontrado" });
      return;
    }

    const booking = await Booking.findOne({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("client", "name")
      .select("client");
    const patientName =
      (booking?.client as unknown as { name?: string } | null)?.name || "";

    const a = est?.address;
    const addressLine = a
      ? [
          [a.street, a.number].filter(Boolean).join(", "),
          a.neighborhood,
          [a.city, a.state].filter(Boolean).join("/"),
        ]
          .filter(Boolean)
          .join(" - ")
      : "";

    const ymd = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;

    const pdf = await generatePodiatrySessionPdf({
      establishmentName: est?.name || "",
      addressLine,
      phone: est?.phone,
      dateYMD: ymd(session.date),
      patientName,
      mainComplaint: profile?.mainComplaint || "",
      diabetic: !!profile?.diabetic,
      findings: session.findings.map((f) => ({
        foot: f.foot,
        view: f.view,
        region: f.region,
        condition: f.condition,
        severity: f.severity,
        note: f.note,
      })),
      procedures: session.procedures.map((p) => ({
        name: p.name,
        region: p.region,
        materials: p.materials,
        note: p.note,
      })),
      recommendations: session.recommendations,
      notes: session.notes,
      nextVisitYMD: session.nextVisit ? ymd(session.nextVisit) : "",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="atendimento-podologia.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("sessionPdf:", err);
    res.status(500).json({ message: "Erro ao gerar o PDF" });
  }
};
