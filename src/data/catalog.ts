import { listTinyLevels } from "./levels";
import type { PackCatalogItem } from "./types";

/** Safe for the client: titles only, no answer keys. */
export const PACK_CATALOG: PackCatalogItem[] = [
  {
    id: "chlopi",
    title: "Chłopi (PL)",
    language: "pl",
    questionCount: 8,
    blurb: "Klasa 8 · Reymont · warianty A i B",
    levelCount: listTinyLevels("chlopi").length,
  },
  {
    id: "warmup-en",
    title: "Warm-up (EN)",
    language: "en",
    questionCount: 8,
    blurb: "Easy general knowledge · middle school",
    levelCount: listTinyLevels("warmup-en").length,
  },
];

export function getCatalogItem(id: string): PackCatalogItem | undefined {
  return PACK_CATALOG.find((pack) => pack.id === id);
}
