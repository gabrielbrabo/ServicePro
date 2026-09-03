import { Schema, model, Document, Types } from "mongoose";

// Plano alimentar de um PACIENTE (nutrição). Um paciente pode ter vários planos
// (ex.: fases, ajustes). Cada plano tem REFEIÇÕES (café, almoço, jantar,
// lanches...) e cada refeição uma lista de itens (alimento, quantidade e, se o
// nutricionista quiser, calorias e macros). Os totais do dia são calculados na
// hora (não são gravados).

export interface IMealItem {
  food: string; // alimento (ex.: "Ovo mexido")
  amount: string; // quantidade (texto: "2 unidades", "100 g")
  calories: number; // kcal do item (0 = não informado)
  protein: number; // proteína (g)
  carbs: number; // carboidrato (g)
  fat: number; // gordura (g)
  notes: string; // preparo / substituição / observação
}

export interface IMeal {
  label: string; // refeição (ex.: "Café da manhã")
  time: string; // horário sugerido (texto: "07:00")
  items: Types.DocumentArray<IMealItem & Document>;
  notes: string; // orientação da refeição
}

export interface INutritionPlan extends Document {
  establishment: Types.ObjectId;
  client: Types.ObjectId; // paciente
  author: Types.ObjectId; // quem montou
  name: string; // nome do plano
  goal: string; // objetivo do plano (opcional)
  active: boolean; // plano atual do paciente
  notes: string; // orientações gerais
  meals: Types.DocumentArray<IMeal & Document>;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IMealItem>(
  {
    food: { type: String, default: "", trim: true },
    amount: { type: String, default: "", trim: true },
    calories: { type: Number, default: 0, min: 0 },
    protein: { type: Number, default: 0, min: 0 },
    carbs: { type: Number, default: 0, min: 0 },
    fat: { type: Number, default: 0, min: 0 },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const mealSchema = new Schema<IMeal>(
  {
    label: { type: String, default: "", trim: true },
    time: { type: String, default: "", trim: true },
    items: { type: [itemSchema], default: [] },
    notes: { type: String, default: "", trim: true },
  },
  { _id: false }
);

const nutritionPlanSchema = new Schema<INutritionPlan>(
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
    meals: { type: [mealSchema], default: [] },
  },
  { timestamps: true }
);

nutritionPlanSchema.index({ establishment: 1, client: 1, createdAt: -1 });

export const NutritionPlan = model<INutritionPlan>(
  "NutritionPlan",
  nutritionPlanSchema
);
