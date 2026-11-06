import type { UvBundle } from "@/lib/data/types";

const ranges: Record<NonNullable<UvBundle["level"]>, string> = {
  laag: "0–2",
  matig: "3–5",
  hoog: "6–7",
  "zeer-hoog": "8–10",
  extreem: "11+",
};

export function UvBadge({ uv }: { uv: UvBundle }) {
  if (!uv.level || uv.index === null) {
    return (
      <div className="uv-badge uv-badge-missing">
        <strong>—</strong>
        <span>Niet beschikbaar</span>
      </div>
    );
  }
  return (
    <div className={`uv-badge uv-badge-${uv.level}`}>
      <strong>{ranges[uv.level]}</strong>
      <span>{uv.label}</span>
    </div>
  );
}
