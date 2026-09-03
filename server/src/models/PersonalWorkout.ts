import { Schema, model, Document, Types } from "mongoose";

// Ficha de treino de um ALUNO (personal trainer). Um aluno pode ter varios
// treinos (ex.: Treino A/B/C, fases). Cada treino tem dias (divisao) e cada dia
// uma lista de exercicios (series, repeticoes, carga, descanso).

export interface IWorkoutExercise {
  name: string; // exercicio (ex.: Supino reto)
  sets: string; // series (texto: "4" ou "3-4")
  reps: string; // repeticoes (texto: "12" ou "8-12")
  load: string; // carga (texto: "20kg" ou "peso corporal")
  rest: string; // descanso (texto: "60s")
  notes: string; // cadencia, tecnica, observacoes
}

export interface IWorkoutDay {
  label: string; // rotulo do dia (ex.: "A - Peito/Triceps", "Segunda")
  focus: string; // foco / grupo muscular (opcional)
  exercises: Types.DocumentArray<IWorkoutExercise & Document>;
}

export interface IPersonalWorkout extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // aluno
  author: Types.ObjectId; // quem montou
  name: string; // nome do treino (ex.: "Hipertrofia - Fase 1")
  goal: string; // objetivo do treino (opcional)
  active: boolean; // treino atual do aluno
  notes: string; // orientacoes gerais
  days: Types.DocumentArray<IWorkoutDay & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const exerciseSchema = new Schema<IWorkoutExercise>(
  {
    name: { type: String, default: "", trim: true },
    sets: { type: String, default: "", trim: true },
    reps: { type: String, default: "", trim: true },
    load: { type: String, default: "", trim: true },
    rest: { type: String, default: "", trim: true },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const daySchema = new Schema<IWorkoutDay>(
  {
    label: { type: String, default: "", trim: true },
    focus: { type: String, default: "", trim: true },
    exercises: { type: [exerciseSchema], default: [] },
  },
  { _id: false }
);

const personalWorkoutSchema = new Schema<IPersonalWorkout>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    client: { type: Schema.Types.ObjectId, ref: "User", required: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, default: "", trim: true },
    goal: { type: String, default: "", trim: true },
    active: { type: Boolean, default: true },
    notes: { type: String, default: "", trim: true },
    days: { type: [daySchema], default: [] },
  },
  { timestamps: true }
);

personalWorkoutSchema.index({ establishment: 1, client: 1, createdAt: -1 });

export const PersonalWorkout = model<IPersonalWorkout>(
  "PersonalWorkout",
  personalWorkoutSchema
);
