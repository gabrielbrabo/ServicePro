import { Schema, model, Document } from "mongoose";
import { SEGMENTS, SegmentKey } from "../config/segments";

export interface ICategory extends Document {
  name: string;
  slug: string;
  icon?: string;
  // area a que a categoria pertence (para filtrar no cadastro por area).
  // opcional: categorias antigas ainda sem tag aparecem em qualquer area.
  segment?: SegmentKey;
}

const categorySchema = new Schema<ICategory>({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true },
  icon: { type: String },
  segment: { type: String, enum: Object.keys(SEGMENTS) },
});

export const Category = model<ICategory>("Category", categorySchema);