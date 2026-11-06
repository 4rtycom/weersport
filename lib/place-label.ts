/** Last comma-separated part of a PDOK weergavenaam, when it adds a province. */
export function provinceFromDetail(detail: string, label: string) {
  const parts = detail.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) return "";
  const province = parts[parts.length - 1] ?? "";
  if (!province || province.toLowerCase() === label.trim().toLowerCase()) return "";
  if (province.length > 80) return "";
  return province;
}

/** Closed field value: place, and province when the source name has one. */
export function placeSelectionLabel(label: string, detail: string) {
  const province = provinceFromDetail(detail, label);
  return province ? `${label}, ${province}` : label;
}
