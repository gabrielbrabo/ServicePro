import { api } from "../lib/api";

// ===== Ficha / perfil do aluno =====
export interface ProgressPhoto {
  _id?: string;
  url: string;
  date: string;
  note: string;
}

export interface PersonalProfile {
  _id?: string;
  establishment: string;
  client: string;
  goal: string;
  parq: boolean[];
  parqNotes: string;
  restrictions: string;
  healthNotes: string;
  photos: ProgressPhoto[];
  _isNew?: boolean;
}

export interface ProfilePayload {
  goal?: string;
  parq?: boolean[];
  parqNotes?: string;
  restrictions?: string;
  healthNotes?: string;
  photos?: { url: string; date?: string; note?: string }[];
}

// ===== Avaliacao fisica (com medidas) =====
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

export interface PersonalAssessment {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  date: string;
  weight: number;
  height: number;
  bodyFat: number;
  restingHr: number;
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
  restingHr?: number;
  measurements?: Partial<BodyMeasurements>;
  notes?: string;
}

// ===== Ficha de treino =====
export interface WorkoutExercise {
  name: string;
  sets: string;
  reps: string;
  load: string;
  rest: string;
  notes: string;
}
export interface WorkoutDay {
  label: string;
  focus: string;
  exercises: WorkoutExercise[];
}
export interface PersonalWorkout {
  _id: string;
  establishment: string;
  client: string;
  author: string | { _id: string; name: string };
  name: string;
  goal: string;
  active: boolean;
  notes: string;
  days: WorkoutDay[];
  createdAt: string;
  updatedAt: string;
}
export interface WorkoutPayload {
  name?: string;
  goal?: string;
  active?: boolean;
  notes?: string;
  days?: WorkoutDay[];
}

const base = "/personal";

export const personalApi = {
  // ---- ficha / perfil ----
  getProfile: (establishmentId: string, clientId: string) =>
    api
      .get<PersonalProfile>(`${base}/${establishmentId}/${clientId}/profile`)
      .then((r) => r.data),

  updateProfile: (
    establishmentId: string,
    clientId: string,
    data: ProfilePayload
  ) =>
    api
      .put<PersonalProfile>(
        `${base}/${establishmentId}/${clientId}/profile`,
        data
      )
      .then((r) => r.data),

  // ---- avaliacoes ----
  listAssessments: (establishmentId: string, clientId: string) =>
    api
      .get<PersonalAssessment[]>(
        `${base}/${establishmentId}/${clientId}/assessments`
      )
      .then((r) => r.data),

  createAssessment: (
    establishmentId: string,
    clientId: string,
    data: AssessmentPayload
  ) =>
    api
      .post<PersonalAssessment>(
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
      .put<PersonalAssessment>(
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

  // ---- treinos ----
  listWorkouts: (establishmentId: string, clientId: string) =>
    api
      .get<PersonalWorkout[]>(
        `${base}/${establishmentId}/${clientId}/workouts`
      )
      .then((r) => r.data),

  createWorkout: (
    establishmentId: string,
    clientId: string,
    data: WorkoutPayload
  ) =>
    api
      .post<PersonalWorkout>(
        `${base}/${establishmentId}/${clientId}/workouts`,
        data
      )
      .then((r) => r.data),

  updateWorkout: (
    establishmentId: string,
    clientId: string,
    workoutId: string,
    data: WorkoutPayload
  ) =>
    api
      .put<PersonalWorkout>(
        `${base}/${establishmentId}/${clientId}/workouts/${workoutId}`,
        data
      )
      .then((r) => r.data),

  removeWorkout: (
    establishmentId: string,
    clientId: string,
    workoutId: string
  ) =>
    api
      .delete<{ message: string; _id: string }>(
        `${base}/${establishmentId}/${clientId}/workouts/${workoutId}`
      )
      .then((r) => r.data),

  workoutPdf: (establishmentId: string, clientId: string, workoutId: string) =>
    api
      .get<Blob>(
        `${base}/${establishmentId}/${clientId}/workouts/${workoutId}/pdf`,
        { responseType: "blob" }
      )
      .then((r) => r.data),
};

// rotulos das circunferencias (ordem de exibicao)
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
