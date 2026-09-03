import { Response } from "express";
import { Types } from "mongoose";
import { NutritionProfile } from "../models/NutritionProfile";
import {
  NutritionAssessment,
  IBodyMeasurements,
} from "../models/NutritionAssessment";
import { NutritionPlan } from "../models/NutritionPlan";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";
import { generateNutritionPlanPdf } from "../utils/nutritionPlanPdf";

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

// só cria ficha para paciente que já tem atendimento no estabelecimento
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
const clampNum = (v: unknown): number => Math.max(0, Number(v) || 0);

const deny = (res: Response) =>
  res.status(403).json({ message: "Sem permissao neste estabelecimento" });

// ============ FICHA / PERFIL + METAS ============

// GET /api/nutrition/:establishmentId/:clientId/profile
export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const profile = await NutritionProfile.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!profile) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        goal: "",
        activityLevel: "",
        targetWeight: 0,
        targetCalories: 0,
        targetProtein: 0,
        targetCarbs: 0,
        targetFat: 0,
        targetWater: 0,
        restrictions: "",
        preferences: "",
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

// PUT /api/nutrition/:establishmentId/:clientId/profile  (upsert)
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
      goal: cleanText(req.body.goal),
      activityLevel: cleanText(req.body.activityLevel),
      targetWeight: clampNum(req.body.targetWeight),
      targetCalories: clampNum(req.body.targetCalories),
      targetProtein: clampNum(req.body.targetProtein),
      targetCarbs: clampNum(req.body.targetCarbs),
      targetFat: clampNum(req.body.targetFat),
      targetWater: clampNum(req.body.targetWater),
      restrictions: cleanText(req.body.restrictions),
      preferences: cleanText(req.body.preferences),
      healthNotes: cleanText(req.body.healthNotes),
      photos,
    };
    const profile = await NutritionProfile.findOneAndUpdate(
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

// ============ ANTROPOMETRIA (avaliações datadas) ============

const sanitizeMeasurements = (raw: unknown): IBodyMeasurements => {
  const m = (raw || {}) as Record<string, unknown>;
  return {
    neck: clampNum(m.neck),
    shoulder: clampNum(m.shoulder),
    chest: clampNum(m.chest),
    waist: clampNum(m.waist),
    abdomen: clampNum(m.abdomen),
    hip: clampNum(m.hip),
    armRelaxed: clampNum(m.armRelaxed),
    armFlexed: clampNum(m.armFlexed),
    forearm: clampNum(m.forearm),
    thigh: clampNum(m.thigh),
    calf: clampNum(m.calf),
  };
};

async function loadAssessment(
  establishmentId: string,
  clientId: string,
  assessmentId: string
) {
  if (!Types.ObjectId.isValid(assessmentId)) return null;
  return NutritionAssessment.findOne({
    _id: assessmentId,
    establishment: establishmentId,
    client: clientId,
  });
}

const buildAssessmentData = (body: Record<string, unknown>) => ({
  weight: clampNum(body.weight),
  height: clampNum(body.height),
  bodyFat: clampNum(body.bodyFat),
  measurements: sanitizeMeasurements(body.measurements),
  notes: cleanText(body.notes),
});

// GET /api/nutrition/:establishmentId/:clientId/assessments
export const listAssessments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await NutritionAssessment.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ date: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listAssessments:", err);
    res.status(500).json({ message: "Erro ao listar avaliacoes" });
  }
};

// POST /api/nutrition/:establishmentId/:clientId/assessments
export const createAssessment = async (
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
    const item = await NutritionAssessment.create({
      establishment: establishmentId,
      client: clientId,
      author: req.userId,
      date: isNaN(parsed.getTime()) ? new Date() : parsed,
      ...buildAssessmentData(req.body),
    });
    const withAuthor = await item.populate("author", "name");
    res.status(201).json(withAuthor);
  } catch (err) {
    console.error("createAssessment:", err);
    res.status(500).json({ message: "Erro ao criar avaliacao" });
  }
};

// PUT /api/nutrition/:establishmentId/:clientId/assessments/:assessmentId
export const updateAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, assessmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadAssessment(establishmentId, clientId, assessmentId);
    if (!item) {
      res.status(404).json({ message: "Avaliacao nao encontrada" });
      return;
    }
    Object.assign(item, buildAssessmentData(req.body));
    if (req.body.date !== undefined) {
      const d = new Date(req.body.date);
      if (!isNaN(d.getTime())) item.date = d;
    }
    await item.save();
    const withAuthor = await item.populate("author", "name");
    res.json(withAuthor);
  } catch (err) {
    console.error("updateAssessment:", err);
    res.status(500).json({ message: "Erro ao atualizar avaliacao" });
  }
};

// DELETE /api/nutrition/:establishmentId/:clientId/assessments/:assessmentId
export const deleteAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, assessmentId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadAssessment(establishmentId, clientId, assessmentId);
    if (!item) {
      res.status(404).json({ message: "Avaliacao nao encontrada" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Avaliacao removida", _id: assessmentId });
  } catch (err) {
    console.error("deleteAssessment:", err);
    res.status(500).json({ message: "Erro ao remover avaliacao" });
  }
};

// ============ PLANOS ALIMENTARES ============

async function loadPlan(
  establishmentId: string,
  clientId: string,
  planId: string
) {
  if (!Types.ObjectId.isValid(planId)) return null;
  return NutritionPlan.findOne({
    _id: planId,
    establishment: establishmentId,
    client: clientId,
  });
}

const sanitizeMeals = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((m) => {
          const meal = (m || {}) as Record<string, unknown>;
          const items = Array.isArray(meal.items)
            ? (meal.items as unknown[])
                .map((i) => {
                  const it = (i || {}) as Record<string, unknown>;
                  return {
                    food: cleanText(it.food),
                    amount: cleanText(it.amount),
                    calories: clampNum(it.calories),
                    protein: clampNum(it.protein),
                    carbs: clampNum(it.carbs),
                    fat: clampNum(it.fat),
                    notes: cleanText(it.notes),
                  };
                })
                .filter((it) => it.food !== "")
            : [];
          return {
            label: cleanText(meal.label),
            time: cleanText(meal.time),
            notes: cleanText(meal.notes),
            items,
          };
        })
        .filter((m) => m.label !== "" || m.items.length > 0)
    : [];

const buildPlanData = (body: Record<string, unknown>) => ({
  name: cleanText(body.name) || "Plano alimentar",
  goal: cleanText(body.goal),
  active: body.active === undefined ? true : Boolean(body.active),
  notes: cleanText(body.notes),
  meals: sanitizeMeals(body.meals),
});

// GET /api/nutrition/:establishmentId/:clientId/plans
export const listPlans = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await NutritionPlan.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ active: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listPlans:", err);
    res.status(500).json({ message: "Erro ao listar planos" });
  }
};

// POST /api/nutrition/:establishmentId/:clientId/plans
export const createPlan = async (
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
    const data = buildPlanData(req.body);
    // se este entra como ativo, desativa os demais do paciente
    if (data.active) {
      await NutritionPlan.updateMany(
        { establishment: establishmentId, client: clientId },
        { $set: { active: false } }
      );
    }
    const item = await NutritionPlan.create({
      establishment: establishmentId,
      client: clientId,
      author: req.userId,
      ...data,
    });
    const withAuthor = await item.populate("author", "name");
    res.status(201).json(withAuthor);
  } catch (err) {
    console.error("createPlan:", err);
    res.status(500).json({ message: "Erro ao criar plano" });
  }
};

// PUT /api/nutrition/:establishmentId/:clientId/plans/:planId
export const updatePlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, planId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadPlan(establishmentId, clientId, planId);
    if (!item) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    const data = buildPlanData(req.body);
    if (data.active) {
      await NutritionPlan.updateMany(
        {
          establishment: establishmentId,
          client: clientId,
          _id: { $ne: item._id },
        },
        { $set: { active: false } }
      );
    }
    Object.assign(item, data);
    await item.save();
    const withAuthor = await item.populate("author", "name");
    res.json(withAuthor);
  } catch (err) {
    console.error("updatePlan:", err);
    res.status(500).json({ message: "Erro ao atualizar plano" });
  }
};

// DELETE /api/nutrition/:establishmentId/:clientId/plans/:planId
export const deletePlan = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, planId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadPlan(establishmentId, clientId, planId);
    if (!item) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Plano removido", _id: planId });
  } catch (err) {
    console.error("deletePlan:", err);
    res.status(500).json({ message: "Erro ao remover plano" });
  }
};

// GET /api/nutrition/:establishmentId/:clientId/plans/:planId/pdf
export const planPdf = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, planId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const [plan, est, profile, lastAssessment] = await Promise.all([
      loadPlan(establishmentId, clientId, planId),
      Establishment.findById(establishmentId).select("name address phone"),
      NutritionProfile.findOne({
        establishment: establishmentId,
        client: clientId,
      }),
      NutritionAssessment.findOne({
        establishment: establishmentId,
        client: clientId,
      }).sort({ date: -1, createdAt: -1 }),
    ]);
    if (!plan) {
      res.status(404).json({ message: "Plano nao encontrado" });
      return;
    }

    // nome do paciente: pega do primeiro booking (client é User)
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

    const d = new Date();
    const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(d.getDate()).padStart(2, "0")}`;

    const pdf = await generateNutritionPlanPdf({
      establishmentName: est?.name || "",
      addressLine,
      phone: est?.phone,
      dateYMD: ymd,
      patientName,
      planName: plan.name,
      goal: plan.goal,
      notes: plan.notes,
      meals: plan.meals.map((meal) => ({
        label: meal.label,
        time: meal.time,
        notes: meal.notes,
        items: meal.items.map((it) => ({
          food: it.food,
          amount: it.amount,
          calories: it.calories,
          protein: it.protein,
          carbs: it.carbs,
          fat: it.fat,
          notes: it.notes,
        })),
      })),
      targets: profile
        ? {
            calories: profile.targetCalories,
            protein: profile.targetProtein,
            carbs: profile.targetCarbs,
            fat: profile.targetFat,
            water: profile.targetWater,
          }
        : undefined,
      lastAssessment: lastAssessment
        ? {
            date: `${lastAssessment.date.getFullYear()}-${String(
              lastAssessment.date.getMonth() + 1
            ).padStart(2, "0")}-${String(
              lastAssessment.date.getDate()
            ).padStart(2, "0")}`,
            weight: lastAssessment.weight,
            height: lastAssessment.height,
            bodyFat: lastAssessment.bodyFat,
          }
        : undefined,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="plano-alimentar.pdf"`);
    res.send(pdf);
  } catch (err) {
    console.error("planPdf:", err);
    res.status(500).json({ message: "Erro ao gerar o PDF" });
  }
};
