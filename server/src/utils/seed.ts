import { connectDB } from "../config/db";
import { Category } from "../models/Category";
import mongoose from "mongoose";

// cada categoria pertence a uma AREA (segment), usada no cadastro para filtrar
// e para liberar os modulos/preco certos.
const categories = [
  // Beleza e bem-estar
  { name: "Barbearia", slug: "barbearia", icon: "💈", segment: "beleza" },
  { name: "Salão de Beleza", slug: "salao-de-beleza", icon: "💇", segment: "beleza" },
  { name: "Estética", slug: "estetica", icon: "💆", segment: "beleza" },
  { name: "Manicure e Pedicure", slug: "manicure-pedicure", icon: "💅", segment: "beleza" },
  { name: "Massagem", slug: "massagem", icon: "🧖", segment: "beleza" },
  { name: "Tatuagem", slug: "tatuagem", icon: "🖋️", segment: "beleza" },
  { name: "Sobrancelha e Cílios", slug: "sobrancelha-cilios", icon: "👁️", segment: "beleza" },
  // Saude (odontologia entra aqui como categoria)
  { name: "Clínica", slug: "clinica", icon: "🏥", segment: "saude" },
  { name: "Odontologia", slug: "odontologia", icon: "🦷", segment: "saude" },
  { name: "Fisioterapia", slug: "fisioterapia", icon: "🩺", segment: "saude" },
  // Servicos gerais
  { name: "Lava Rápido", slug: "lava-rapido", icon: "🚗", segment: "geral" },
];

const run = async (): Promise<void> => {
  await connectDB();

  // upsert por slug: preserva os _id existentes (nao quebra estabelecimentos
  // que ja apontam para a categoria) e apenas atualiza/insere os campos.
  for (const c of categories) {
    await Category.updateOne({ slug: c.slug }, { $set: c }, { upsert: true });
  }

  console.log(`✅ ${categories.length} categorias sincronizadas (com area)`);
  await mongoose.disconnect();
  process.exit(0);
};

run();