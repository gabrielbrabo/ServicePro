import { connectDB } from "../config/db";
import { Category } from "../models/Category";
import mongoose from "mongoose";

const categories = [
  { name: "Barbearia", slug: "barbearia", icon: "💈" },
  { name: "Salão de Beleza", slug: "salao-de-beleza", icon: "💇" },
  { name: "Odontologia", slug: "odontologia", icon: "🦷" },
  { name: "Clínica", slug: "clinica", icon: "🏥" },
  { name: "Lava Rápido", slug: "lava-rapido", icon: "🚗" },
  { name: "Estética", slug: "estetica", icon: "💆" },
  { name: "Manicure e Pedicure", slug: "manicure-pedicure", icon: "💅" },
  { name: "Massagem", slug: "massagem", icon: "🧖" },
  { name: "Tatuagem", slug: "tatuagem", icon: "🖋️" },
  { name: "Fisioterapia", slug: "fisioterapia", icon: "🩺" },
  { name: "Veterinária", slug: "veterinaria", icon: "🐾" },
  { name: "Sobrancelha e Cílios", slug: "sobrancelha-cilios", icon: "👁️" },
];

const run = async (): Promise<void> => {
  await connectDB();
  await Category.deleteMany({});
  await Category.insertMany(categories);
  console.log(`✅ ${categories.length} categorias inseridas`);
  await mongoose.disconnect();
  process.exit(0);
};

run();