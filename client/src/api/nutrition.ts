import { api } from "../lib/api";

// ===== Ficha / perfil + metas do paciente =====
export interface ProgressPhoto {
  _id?: string;
  url: string;
  date: string;
  note: string;
}

export interface NutritionProfile {
  _id?: string;
  establishment: string;
  client: string;
  goal: string;
  activityLevel: string;
  targetWeight: number;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  targetWater: number;
  restrictions: string;
  preferences: string;
  healthNotes: string;
  photos: ProgressPhoto[];
  _isNew?: boolean;
}

export interface ProfilePayload {
  goal?: string;
  activityLevel?: string;
  targetWeight?: number;
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  targetWater?: number;
  restrictions?: string;
  preferences?: string;
  healthNotes?: string;
  photos?: { url: string; date?: string; note?: string }[];
}

// ===== Antropometria =====
export interface BodyMeasurements {
  neck: number;
  shoulder: number;
  chest: number;
  waist: number;
  abdomen: number;
  hip: number;
  armRelaxed: number;
  armFlexed: number;
  forearm: number;
  thigh: number;
  calf: number;
}

export interface NutritionAssessment {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  date: string;
  weight: number;
  height: number;
  bodyFat: number;
  measurements: BodyMeasurements;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentPayload {
  date?: string;
  weight?: number;
  height?: number;
  bodyFat?: number;
  measurements?: Partial<BodyMeasurements>;
  notes?: string;
}

// ===== Plano alimentar =====
export interface MealItem {
  food: string;
  amount: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
}
export interface Meal {
  label: string;
  time: string;
  items: MealItem[];
  notes: string;
}
export interface NutritionPlan {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  name: string;
  goal: string;
  active: boolean;
  notes: string;
  meals: Meal[];
  createdAt: string;
  updatedAt: string;
}
export interface PlanPayload {
  name?: string;
  goal?: string;
  active?: boolean;
  notes?: string;
  meals?: Meal[];
}

const base = "/nutrition";

export const nutritionApi = {
  // ---- ficha / perfil + metas ----
  getProfile: (establishmentId: string, clientId: string) =>
    api
      .get<NutritionProfile>(`${base}/${establishmentId}/${clientId}/profile`)
      .then((r) => r.data),

  updateProfile: (
    establishmentId: string,
    clientId: string,
    data: ProfilePayload
  ) =>
    api
      .put<NutritionProfile>(
        `${base}/${establishmentId}/${clientId}/profile`,
        data
      )
      .then((r) => r.data),

  // ---- antropometria ----
  listAssessments: (establishmentId: string, clientId: string) =>
    api
      .get<NutritionAssessment[]>(
        `${base}/${establishmentId}/${clientId}/assessments`
      )
      .then((r) => r.data),

  createAssessment: (
    establishmentId: string,
    clientId: string,
    data: AssessmentPayload
  ) =>
    api
      .post<NutritionAssessment>(
        `${base}/${establishmentId}/${clientId}/assessments`,
        data
      )
      .then((r) => r.data),

  updateAssessment: (
    establishmentId: string,
    clientId: string,
    assessmentId: string,
    data: AssessmentPayload
  ) =>
    api
      .put<NutritionAssessment>(
        `${base}/${establishmentId}/${clientId}/assessments/${assessmentId}`,
        data
      )
      .then((r) => r.data),

  removeAssessment: (
    establishmentId: string,
    clientId: string,
    assessmentId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/${clientId}/assessments/${assessmentId}`
      )
      .then((r) => r.data),

  // ---- planos ----
  listPlans: (establishmentId: string, clientId: string) =>
    api
      .get<NutritionPlan[]>(`${base}/${establishmentId}/${clientId}/plans`)
      .then((r) => r.data),

  createPlan: (
    establishmentId: string,
    clientId: string,
    data: PlanPayload
  ) =>
    api
      .post<NutritionPlan>(
        `${base}/${establishmentId}/${clientId}/plans`,
        data
      )
      .then((r) => r.data),

  updatePlan: (
    establishmentId: string,
    clientId: string,
    planId: string,
    data: PlanPayload
  ) =>
    api
      .put<NutritionPlan>(
        `${base}/${establishmentId}/${clientId}/plans/${planId}`,
        data
      )
      .then((r) => r.data),

  removePlan: (establishmentId: string, clientId: string, planId: string) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/${clientId}/plans/${planId}`
      )
      .then((r) => r.data),

  planPdf: (establishmentId: string, clientId: string, planId: string) =>
    api
      .get<Blob>(
        `${base}/${establishmentId}/${clientId}/plans/${planId}/pdf`,
        { responseType: "blob" }
      )
      .then((r) => r.data),
};

// rótulos das circunferências (ordem de exibição)
export const MEASURE_FIELDS: { key: keyof BodyMeasurements; label: string }[] = [
  { key: "neck", label: "Pescoço" },
  { key: "shoulder", label: "Ombro" },
  { key: "chest", label: "Peitoral" },
  { key: "waist", label: "Cintura" },
  { key: "abdomen", label: "Abdômen" },
  { key: "hip", label: "Quadril" },
  { key: "armRelaxed", label: "Braço relaxado" },
  { key: "armFlexed", label: "Braço contraído" },
  { key: "forearm", label: "Antebraço" },
  { key: "thigh", label: "Coxa" },
  { key: "calf", label: "Panturrilha" },
];

export const emptyMeasurements = (): BodyMeasurements => ({
  neck: 0,
  shoulder: 0,
  chest: 0,
  waist: 0,
  abdomen: 0,
  hip: 0,
  armRelaxed: 0,
  armFlexed: 0,
  forearm: 0,
  thigh: 0,
  calf: 0,
});

// níveis de atividade (para o select do perfil)
export const ACTIVITY_LEVELS: { key: string; label: string }[] = [
  { key: "sedentario", label: "Sedentário" },
  { key: "leve", label: "Levemente ativo" },
  { key: "moderado", label: "Moderadamente ativo" },
  { key: "intenso", label: "Muito ativo" },
  { key: "atleta", label: "Atleta" },
];

// ===== helpers de cálculo (antropometria) =====

// IMC a partir de peso (kg) e altura (cm)
export function bmi(weight: number, height: number): number {
  if (!weight || !height) return 0;
  return weight / Math.pow(height / 100, 2);
}

// classificação do IMC (OMS)
export function bmiClass(value: number): { label: string; color: string } {
  if (!value) return { label: "—", color: "text-ink/40" };
  if (value < 18.5) return { label: "Abaixo do peso", color: "text-sky-600" };
  if (value < 25) return { label: "Peso normal", color: "text-teal-600" };
  if (value < 30) return { label: "Sobrepeso", color: "text-amber-600" };
  if (value < 35) return { label: "Obesidade I", color: "text-orange-600" };
  if (value < 40) return { label: "Obesidade II", color: "text-red-600" };
  return { label: "Obesidade III", color: "text-red-700" };
}

// razão cintura/quadril (RCQ)
export function whr(waist: number, hip: number): number {
  if (!waist || !hip) return 0;
  return waist / hip;
}

// massa gorda (kg) a partir do % de gordura
export function fatMass(weight: number, bodyFat: number): number {
  if (!weight || !bodyFat) return 0;
  return (weight * bodyFat) / 100;
}

// massa magra (kg)
export function leanMass(weight: number, bodyFat: number): number {
  if (!weight || !bodyFat) return 0;
  return weight - (weight * bodyFat) / 100;
}
