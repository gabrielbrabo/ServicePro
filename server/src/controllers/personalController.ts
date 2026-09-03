import { Response } from "express";
import { Types } from "mongoose";
import { PersonalProfile } from "../models/PersonalProfile";
import { PersonalAssessment, IBodyMeasurements } from "../models/PersonalAssessment";
import { PersonalWorkout } from "../models/PersonalWorkout";
import { Establishment } from "../models/Establishment";
import { Booking } from "../models/Booking";
import { AuthRequest } from "../middleware/auth";
import { generatePersonalWorkoutPdf } from "../utils/personalWorkoutPdf";

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

// so cria ficha para aluno que ja tem atendimento no estabelecimento
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

// ============ FICHA / PERFIL DO ALUNO ============

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

// normaliza o PAR-Q para 7 booleanos
const sanitizeParq = (raw: unknown): boolean[] => {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: 7 }, (_, i) => Boolean(arr[i]));
};

// GET /api/personal/:establishmentId/:clientId/profile
export const getProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const profile = await PersonalProfile.findOne({
      establishment: establishmentId,
      client: clientId,
    });
    if (!profile) {
      res.json({
        establishment: establishmentId,
        client: clientId,
        goal: "",
        parq: Array(7).fill(false),
        parqNotes: "",
        restrictions: "",
        healthNotes: "",
        photos: [],
        _isNew: true,
      });
      return;
    }
    res.json(profile);
  } catch (err) {
    console.error("getProfile:", err);
    res.status(500).json({ message: "Erro ao buscar a ficha do aluno" });
  }
};

// PUT /api/personal/:establishmentId/:clientId/profile  (upsert)
export const updateProfile = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este aluno nao tem atendimentos no estabelecimento" });
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
      parq: sanitizeParq(req.body.parq),
      parqNotes: cleanText(req.body.parqNotes),
      restrictions: cleanText(req.body.restrictions),
      healthNotes: cleanText(req.body.healthNotes),
      photos,
    };
    const profile = await PersonalProfile.findOneAndUpdate(
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
    res.status(500).json({ message: "Erro ao salvar a ficha do aluno" });
  }
};

// ============ AVALIACOES FISICAS (com medidas) ============

async function loadAssessment(
  establishmentId: string,
  clientId: string,
  assessmentId: string
) {
  if (!Types.ObjectId.isValid(assessmentId)) return null;
  return PersonalAssessment.findOne({
    _id: assessmentId,
    establishment: establishmentId,
    client: clientId,
  });
}

const buildAssessmentData = (body: Record<string, unknown>) => ({
  weight: clampNum(body.weight),
  height: clampNum(body.height),
  bodyFat: clampNum(body.bodyFat),
  restingHr: clampNum(body.restingHr),
  measurements: sanitizeMeasurements(body.measurements),
  notes: cleanText(body.notes),
});

// GET /api/personal/:establishmentId/:clientId/assessments
export const listAssessments = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await PersonalAssessment.find({
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

// POST /api/personal/:establishmentId/:clientId/assessments
export const createAssessment = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este aluno nao tem atendimentos no estabelecimento" });
      return;
    }
    const parsed = req.body.date ? new Date(req.body.date) : new Date();
    const item = await PersonalAssessment.create({
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

// PUT /api/personal/:establishmentId/:clientId/assessments/:assessmentId
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

// DELETE /api/personal/:establishmentId/:clientId/assessments/:assessmentId
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

// ============ FICHAS DE TREINO ============

async function loadWorkout(
  establishmentId: string,
  clientId: string,
  workoutId: string
) {
  if (!Types.ObjectId.isValid(workoutId)) return null;
  return PersonalWorkout.findOne({
    _id: workoutId,
    establishment: establishmentId,
    client: clientId,
  });
}

const sanitizeDays = (raw: unknown) =>
  Array.isArray(raw)
    ? raw
        .map((d) => {
          const day = (d || {}) as Record<string, unknown>;
          const exercises = Array.isArray(day.exercises)
            ? (day.exercises as unknown[])
                .map((e) => {
                  const ex = (e || {}) as Record<string, unknown>;
                  return {
                    name: cleanText(ex.name),
                    sets: cleanText(ex.sets),
                    reps: cleanText(ex.reps),
                    load: cleanText(ex.load),
                    rest: cleanText(ex.rest),
                    notes: cleanText(ex.notes),
                  };
                })
                .filter((ex) => ex.name !== "")
            : [];
          return {
            label: cleanText(day.label),
            focus: cleanText(day.focus),
            exercises,
          };
        })
        .filter((d) => d.label !== "" || d.exercises.length > 0)
    : [];

const buildWorkoutData = (body: Record<string, unknown>) => ({
  name: cleanText(body.name) || "Treino",
  goal: cleanText(body.goal),
  active: body.active === undefined ? true : Boolean(body.active),
  notes: cleanText(body.notes),
  days: sanitizeDays(body.days),
});

// GET /api/personal/:establishmentId/:clientId/workouts
export const listWorkouts = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const items = await PersonalWorkout.find({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("author", "name")
      .sort({ active: -1, createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error("listWorkouts:", err);
    res.status(500).json({ message: "Erro ao listar treinos" });
  }
};

// POST /api/personal/:establishmentId/:clientId/workouts
export const createWorkout = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    if (!(await clientHasBooking(establishmentId, clientId))) {
      res
        .status(400)
        .json({ message: "Este aluno nao tem atendimentos no estabelecimento" });
      return;
    }
    const data = buildWorkoutData(req.body);
    // se este entra como ativo, desativa os demais do aluno
    if (data.active) {
      await PersonalWorkout.updateMany(
        { establishment: establishmentId, client: clientId },
        { $set: { active: false } }
      );
    }
    const item = await PersonalWorkout.create({
      establishment: establishmentId,
      client: clientId,
      author: req.userId,
      ...data,
    });
    const withAuthor = await item.populate("author", "name");
    res.status(201).json(withAuthor);
  } catch (err) {
    console.error("createWorkout:", err);
    res.status(500).json({ message: "Erro ao criar treino" });
  }
};

// PUT /api/personal/:establishmentId/:clientId/workouts/:workoutId
export const updateWorkout = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, workoutId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadWorkout(establishmentId, clientId, workoutId);
    if (!item) {
      res.status(404).json({ message: "Treino nao encontrado" });
      return;
    }
    const data = buildWorkoutData(req.body);
    if (data.active) {
      await PersonalWorkout.updateMany(
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
    console.error("updateWorkout:", err);
    res.status(500).json({ message: "Erro ao atualizar treino" });
  }
};

// DELETE /api/personal/:establishmentId/:clientId/workouts/:workoutId
export const deleteWorkout = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, workoutId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);
    const item = await loadWorkout(establishmentId, clientId, workoutId);
    if (!item) {
      res.status(404).json({ message: "Treino nao encontrado" });
      return;
    }
    await item.deleteOne();
    res.json({ message: "Treino removido", _id: workoutId });
  } catch (err) {
    console.error("deleteWorkout:", err);
    res.status(500).json({ message: "Erro ao remover treino" });
  }
};

// GET /api/personal/:establishmentId/:clientId/workouts/:workoutId/pdf
export const workoutPdf = async (
  req: AuthRequest,
  res: Response
): Promise<void> => {
  try {
    const { establishmentId, clientId, workoutId } = req.params;
    if (!(await canManage(establishmentId, req.userId))) return void deny(res);

    const [workout, est, lastAssessment] = await Promise.all([
      loadWorkout(establishmentId, clientId, workoutId),
      Establishment.findById(establishmentId).select("name address phone"),
      PersonalAssessment.findOne({
        establishment: establishmentId,
        client: clientId,
      }).sort({ date: -1, createdAt: -1 }),
    ]);
    if (!workout) {
      res.status(404).json({ message: "Treino nao encontrado" });
      return;
    }

    // nome do aluno: pega do primeiro booking (client eh User)
    const booking = await Booking.findOne({
      establishment: establishmentId,
      client: clientId,
    })
      .populate("client", "name")
      .select("client");
    const studentName =
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

    const pdf = await generatePersonalWorkoutPdf({
      establishmentName: est?.name || "",
      addressLine,
      phone: est?.phone,
      dateYMD: ymd,
      studentName,
      workoutName: workout.name,
      goal: workout.goal,
      notes: workout.notes,
      days: workout.days.map((day) => ({
        label: day.label,
        focus: day.focus,
        exercises: day.exercises.map((ex) => ({
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          load: ex.load,
          rest: ex.rest,
          notes: ex.notes,
        })),
      })),
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
            measurements: lastAssessment.measurements as unknown as Record<
              string,
              number
            >,
          }
        : undefined,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="treino.pdf"`
    );
    res.send(pdf);
  } catch (err) {
    console.error("workoutPdf:", err);
    res.status(500).json({ message: "Erro ao gerar o PDF" });
  }
};
