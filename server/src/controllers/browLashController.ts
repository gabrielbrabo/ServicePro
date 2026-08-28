import { Response } from "express";
import { BrowLashProfile } from "../models/BrowLashProfile";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";

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

// normaliza o mapping de cilios recebido do front
function parseLashMap(
  v: unknown
): { zone: string; length: string }[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v
    .filter(
      (z): z is { zone: unknown; length?: unknown } =>
        !!z && typeof z === "object"
    )
    .map((z) => ({
      zone: cleanText((z as { zone?: unknown }).zone),
      length: cleanText((z as { length?: unknown }).length),
    }))
    .filter((z) => z.zone);
}

// GET /api/beauty-brows/:establishmentId/:clientId
export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const p = await BrowLashProfile.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!p) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        faceShape: "",
        browFormat: "",
        browTechnique: "",
        browColor: "",
        browMeasures: "",
        browNotes: "",
        lashTechnique: "",
        lashCurvature: "",
        lashThickness: "",
        lashGlue: "",
        lashMap: [],
        lashNotes: "",
        _isNew: true,
      });
      return;
    }
    res.json(p);
  } catch (err) {
    console.error("getProfile(brows):", err);
    res.status(500).json({ message: "Erro ao buscar perfil" });
  }
};

// PUT /api/beauty-brows/:establishmentId/:clientId
export const updateProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este cliente nao tem atendimentos no estabelecimento",
      });
      return;
    }

    const b = req.body;
    const update: Record<string, unknown> = { updatedBy: req.userId };
    const textFields = [
      "faceShape",
      "browFormat",
      "browTechnique",
      "browColor",
      "browMeasures",
      "browNotes",
      "lashTechnique",
      "lashCurvature",
      "lashThickness",
      "lashGlue",
      "lashNotes",
    ];
    for (const f of textFields) {
      if (typeof b[f] === "string") update[f] = cleanText(b[f]);
    }
    const lashMap = parseLashMap(b.lashMap);
    if (lashMap) update.lashMap = lashMap;

    const p = await BrowLashProfile.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      {
        $set: update,
        $setOnInsert: { establishment: establishmentId, client: clientId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.json(p);
  } catch (err) {
    console.error("updateProfile(brows):", err);
    res.status(500).json({ message: "Erro ao salvar perfil" });
  }
};
