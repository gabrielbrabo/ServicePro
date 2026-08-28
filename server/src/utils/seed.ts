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
  { name: "Maquiagem e Penteados", slug: "maquiagem-penteados", icon: "💄", segment: "beleza" },
  { name: "Bronzeamento", slug: "bronzeamento", icon: "☀️", segment: "beleza" },
  // Saude (odontologia entra aqui como categoria)
  { name: "Clínica", slug: "clinica", icon: "🏥", segment: "saude" },
  { name: "Odontologia", slug: "odontologia", icon: "🦷", segment: "saude" },
  { name: "Fisioterapia", slug: "fisioterapia", icon: "🩺", segment: "saude" },
  { name: "Psicologia", slug: "psicologia", icon: "🧠", segment: "saude" },
  { name: "Nutrição", slug: "nutricao", icon: "🥗", segment: "saude" },
  { name: "Fonoaudiologia", slug: "fonoaudiologia", icon: "🗣️", segment: "saude" },
  { name: "Dermatologia", slug: "dermatologia", icon: "🧴", segment: "saude" },
  { name: "Podologia", slug: "podologia", icon: "🦶", segment: "saude" },
  { name: "Enfermagem", slug: "enfermagem", icon: "💉", segment: "saude" },
  { name: "Acupuntura", slug: "acupuntura", icon: "🪡", segment: "saude" },
  { name: "Quiropraxia", slug: "quiropraxia", icon: "🦴", segment: "saude" },
  // Servicos gerais
  { name: "Lava Rápido", slug: "lava-rapido", icon: "🚗", segment: "geral" },
  { name: "Estética Automotiva", slug: "estetica-automotiva", icon: "✨", segment: "geral" },
  { name: "Oficina Mecânica", slug: "oficina-mecanica", icon: "🔧", segment: "geral" },
  { name: "Assistência Técnica", slug: "assistencia-tecnica", icon: "🔌", segment: "geral" },
  { name: "Chaveiro", slug: "chaveiro", icon: "🔑", segment: "geral" },
  { name: "Elétrica e Hidráulica", slug: "eletrica-hidraulica", icon: "⚡", segment: "geral" },
  { name: "Pintura", slug: "pintura", icon: "🎨", segment: "geral" },
  { name: "Reformas e Construção", slug: "reformas-construcao", icon: "🧱", segment: "geral" },
  { name: "Jardinagem e Paisagismo", slug: "jardinagem-paisagismo", icon: "🌳", segment: "geral" },
  { name: "Refrigeração", slug: "refrigeracao", icon: "❄️", segment: "geral" },
  { name: "Limpeza e Diarista", slug: "limpeza-diarista", icon: "🧹", segment: "geral" },
  { name: "Dedetização", slug: "dedetizacao", icon: "🐜", segment: "geral" },
  { name: "Fotografia", slug: "fotografia", icon: "📷", segment: "geral" },
  { name: "Aulas Particulares", slug: "aulas-particulares", icon: "📚", segment: "geral" },
  { name: "Personal Trainer", slug: "personal-trainer", icon: "🏋️", segment: "geral" },
  { name: "Costura e Ajustes", slug: "costura-ajustes", icon: "🧵", segment: "geral" },
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