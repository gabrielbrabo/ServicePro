import { Schema, model, Document, Types } from "mongoose";

// Plano de aulas de um ALUNO (extra da categoria aulas-particulares, modulo
// "aulas"). E do ESTABELECIMENTO: cada documento e um aluno com sua materia,
// objetivo e o plano de aulas (topicos/conteudos). A presenca fica na aba
// Matriculas (ligada a agenda real).

export interface ILessonTopic {
  title: string; // topico / conteudo da aula
  done: boolean; // ja trabalhado
  date: string; // data prevista / dada (texto livre)
}
export interface ILessonPlan extends Document {
  establishment: Types.ObjectId;
  studentName: string; // nome do aluno
  studentPhone: string;
  subject: string; // materia (Matematica, Ingles...)
  goal: string; // objetivo do plano
  topics: Types.DocumentArray<ILessonTopic & Document>; // plano de aulas
  notes: string;
  author: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const topicSchema = new Schema<ILessonTopic>(
  {
    title: { type: String, default: "", trim: true },
    done: { type: Boolean, default: false },
    date: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const lessonPlanSchema = new Schema<ILessonPlan>(
  {
    establishment: {
      type: Schema.Types.ObjectId,
      ref: "Establishment",
      required: true,
    },
    studentName: { type: String, default: "", trim: true },
    studentPhone: { type: String, default: "", trim: true },
    subject: { type: String, default: "", trim: true },
    goal: { type: String, default: "", trim: true },
    topics: { type: [topicSchema], default: [] },
    notes: { type: String, default: "", trim: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

lessonPlanSchema.index({ establishment: 1, updatedAt: -1 });

export const LessonPlan = model<ILessonPlan>("LessonPlan", lessonPlanSchema);
