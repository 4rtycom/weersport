import type { UvBundle } from "@/lib/data/types";

export function classifyUv(index: number | null): UvBundle {
  if (index === null || Number.isNaN(index)) {
    return { index: null, level: null, label: "UV niet beschikbaar" };
  }
  if (index <= 2) return { index, level: "laag", label: "Laag" };
  if (index <= 5) return { index, level: "matig", label: "Matig" };
  if (index <= 7) return { index, level: "hoog", label: "Hoog" };
  if (index <= 10) return { index, level: "zeer-hoog", label: "Zeer hoog" };
  return { index, level: "extreem", label: "Extreem" };
}
