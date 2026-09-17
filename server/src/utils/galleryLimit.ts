import { Types } from "mongoose";
import { GalleryItem } from "../models/GalleryItem";
import { Subscription } from "../models/Subscription";
import { INCLUDED_GALLERY_SLOTS, slotsForKind } from "../config/gallery";

// Uso de espaco da galeria = soma dos arquivos guardados (ativos E inativos,
// pois ambos ocupam o S3). single=1, ba=2.
export async function usedGallerySlots(
  establishmentId: Types.ObjectId | string
): Promise<{ used: number; singles: number; bas: number }> {
  const items = await GalleryItem.find({
    establishment: establishmentId,
  }).select("kind");
  let used = 0;
  let singles = 0;
  let bas = 0;
  for (const it of items) {
    if (it.kind === "ba") {
      used += 2;
      bas += 1;
    } else {
      used += 1;
      singles += 1;
    }
  }
  return { used, singles, bas };
}

// espacos extras pagos na assinatura do estabelecimento
export async function paidGallerySlots(
  establishmentId: Types.ObjectId | string
): Promise<number> {
  const sub = await Subscription.findOne({
    establishment: establishmentId,
  }).select("extraGallerySlots");
  return sub?.extraGallerySlots || 0;
}

// limite total de espacos = incluidos + pagos
export function maxGallerySlots(extraSlots: number): number {
  return INCLUDED_GALLERY_SLOTS + (extraSlots || 0);
}

export { slotsForKind };
