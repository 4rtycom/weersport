/** Server-only rollout switches. Absent or any value other than "true" stays off. */

export const DATA_FLAG = {
  knmi: "DATA_KNMI_ENABLED",
  rws: "DATA_RWS_ENABLED",
  pdokV2: "DATA_PDOK_V2_ENABLED",
  luchtmeetnet: "DATA_LUCHTMEETNET_ENABLED",
} as const;

export type DataFlagName = (typeof DATA_FLAG)[keyof typeof DATA_FLAG];

export function dataFlagEnabled(name: DataFlagName): boolean {
  return process.env[name]?.trim() === "true";
}

export function dataFlagSnapshot() {
  return {
    DATA_KNMI_ENABLED: dataFlagEnabled(DATA_FLAG.knmi),
    DATA_RWS_ENABLED: dataFlagEnabled(DATA_FLAG.rws),
    DATA_PDOK_V2_ENABLED: dataFlagEnabled(DATA_FLAG.pdokV2),
    DATA_LUCHTMEETNET_ENABLED: dataFlagEnabled(DATA_FLAG.luchtmeetnet),
  };
}
