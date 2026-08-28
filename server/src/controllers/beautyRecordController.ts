import { Response } from "express";
import { BeautyRecord } from "../models/BeautyRecord";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";

// dono OU membro do estabelecimento
const canManage = async (
  establishmentId: string,
  userId?: string
): Promise<boolean> => {
  if (!userId) return false;
  const est = await Establishment.findOne({
    _id: establishmentId,
    $or: [{ owner: userId }, { "members.professional": userId }],
  });
  return !!est;
};

// confirma que o cliente realmente tem historico com o estabelecimento
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

// GET /api/beauty-records/:establishmentId/:clientId  (dono/equipe)
// devolve a ficha; se ainda nao existir, devolve estrutura vazia (_isNew)
export const getBeautyRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    const record = await BeautyRecord.findOne({
      establishment: establishmentId,
      client: clientId,
    });

    if (!record) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        hairType: "",
        scalpSkin: "",
        allergies: "",
        sensitivities: "",
        chemicalHistory: "",
        observations: "",
        _isNew: true,
      });
      return;
    }

    res.json(record);
  } catch (err) {
    console.error("getBeautyRecord:", err);
    res.status(500).json({ message: "Erro ao buscar ficha" });
  }
};

// PUT /api/beauty-records/:establishmentId/:clientId  (dono/equipe)
// body: { hairType?, scalpSkin?, allergies?, sensitivities?, chemicalHistory?, observations? }
export const updateBeautyRecord = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    const {
      hairType,
      scalpSkin,
      allergies,
      sensitivities,
      chemicalHistory,
      observations,
    } = req.body;

    if (!(await canManage(establishmentId, req.userId))) {
      res.status(403).json({ message: "Sem permissao neste estabelecimento" });
      return;
    }

    if (!(await clientHasBooking(establishmentId, clientId))) {
      res.status(400).json({
        message: "Este cliente nao tem agendamentos no estabelecimento",
      });
      return;
    }

    const update: Record<string, unknown> = {};
    if (typeof hairType === "string") update.hairType = hairType;
    if (typeof scalpSkin === "string") update.scalpSkin = scalpSkin;
    if (typeof allergies === "string") update.allergies = allergies;
    if (typeof sensitivities === "string") update.sensitivities = sensitivities;
    if (typeof chemicalHistory === "string")
      update.chemicalHistory = chemicalHistory;
    if (typeof observations === "string") update.observations = observations;

    const record = await BeautyRecord.findOneAndUpdate(
      { establishment: establishmentId, client: clientId },
      {
        $set: update,
        $setOnInsert: { establishment: establishmentId, client: clientId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    res.json(record);
  } catch (err) {
    console.error("updateBeautyRecord:", err);
    res.status(500).json({ message: "Erro ao salvar ficha" });
  }
};
