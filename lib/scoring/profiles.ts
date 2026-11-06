import { OPEN_WATER_MODEL_VERSION } from "@/lib/scoring/swim";

export type ReleaseStatus = "withheld";

export type ProfileFactor = {
  id: string;
  label: string;
  explanation: string;
  /** True only when a released gate actually uses the factor. Descriptions alone stay false. */
  applied: boolean;
};

export type SourceBundleName = "weather" | "water" | "swim" | "warnings" | "none";

export type RequiredSourceField = {
  id: string;
  label: string;
  bundle: SourceBundleName;
  /** Property on that bundle. Null when the repo has no field that can carry it. */
  field: string | null;
  /** True only when a gate in this repo can read the field. A description is not enough. */
  measurable: boolean;
};

export type ProfileBlock = {
  id: string;
  explanation: string;
  applied: boolean;
};

export type WaterGateField = "waterTemperatureC" | "waveHeightM" | "currentMs" | "currentDirectionDeg";

/** The one characteristic check a sport is allowed to run with the sources already in the repo. */
export type CharacteristicGate =
  | {
      kind: "unmeasured";
      blockedReason: string;
      /** Set when a tide clock exists on WaterBundle and must not be treated as the missing factor. */
      tideReason: string | null;
    }
  | {
      kind: "water";
      field: WaterGateField;
      blockedReason: string;
      /** Used when the water field is valid. Still not a score: another essential factor is missing. */
      recordedReason: string;
      tideReason: string | null;
    };

export type SportDecisionProfile = {
  sportId: string;
  modelVersion: string;
  releaseStatus: ReleaseStatus;
  /** Personal advice stays off until a validated rule and demonstrated coverage both exist. */
  personalAdvice: boolean;
  tagline: string;
  nextSportId: string | null;
  factors: ProfileFactor[];
  /** Labels of inputs that are not yet available as a released decision. */
  missing: string[];
  requiredFields: RequiredSourceField[];
  blocks: ProfileBlock[];
  /** Null only for open water, which keeps its own gate in swim.ts. */
  gate: CharacteristicGate | null;
  withheldReason: string;
  explanation: string;
  caveats: string;
};

export const SCORE_REGISTRY_VERSION = "weersport-profile-registry-v1";

const NO_FALLBACK = "Lucht, wind en regen zijn geen vervangende score.";

type Seed = {
  sportId: string;
  tagline: string;
  nextSportId: string | null;
  factors: ProfileFactor[];
  missing: string[];
  requiredFields: RequiredSourceField[];
  blocks: ProfileBlock[];
  gate: CharacteristicGate;
  explanation: string;
  caveats: string;
};

function field(
  id: string,
  label: string,
  bundle: SourceBundleName,
  name: string | null,
  measurable: boolean,
): RequiredSourceField {
  return { id, label, bundle, field: name, measurable };
}

function applied(id: string, label: string, explanation: string): ProfileFactor {
  return { id, label, explanation, applied: true };
}

function noted(id: string, label: string, explanation: string): ProfileFactor {
  return { id, label, explanation, applied: false };
}

function block(id: string, explanation: string): ProfileBlock {
  return { id, explanation, applied: true };
}

const seeds: Seed[] = [
  {
    sportId: "fietsen",
    tagline: "Ontspannen buitenritten",
    nextSportId: "wielrennen",
    factors: [
      applied("rijrichting", "Wind per rijrichting", "Tegenwind per rijrichting blokkeert het advies: de windrichting zit niet in de weerbron."),
      applied("route", "Routeblootstelling", "Blootstelling van de route wordt niet uit de plaatsnaam afgeleid."),
      noted("gevoel", "Gevoelstemperatuur", "Gevoelstemperatuur wordt niet uit de luchttemperatuur berekend."),
      noted("buien", "Duur van buien", "Een neerslagkans is geen duur van buien en telt niet als score."),
    ],
    missing: ["wind per rijrichting", "routeblootstelling", "gevoelstemperatuur", "duur van buien"],
    requiredFields: [
      field("windDirection", "wind per rijrichting", "none", null, false),
      field("routeExposure", "routeblootstelling", "none", null, false),
      field("apparentTemperature", "gevoelstemperatuur", "none", null, false),
      field("showerDuration", "duur van buien", "none", null, false),
    ],
    blocks: [block("no-riding-direction", "Zonder windrichting per rijrichting en routeblootstelling is er geen fietsmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen de windrichting per rijrichting en de routeblootstelling. Daarom kunnen we nog geen fietsmoment adviseren.",
      tideReason: null,
    },
    explanation: `Een fietsmoment hangt af van de wind per rijrichting en van de route. ${NO_FALLBACK}`,
    caveats: "Geen route- of hoogtemeterberekening.",
  },
  {
    sportId: "wielrennen",
    tagline: "Sportieve ritten op tempo",
    nextSportId: "gravelbiken",
    factors: [
      applied("zijwind", "Zijwind", "Zijwind op open stukken blokkeert het advies: de windrichting zit niet in de weerbron."),
      applied("stoten", "Windstoten", "Windstoten zitten niet in de uurverwachting en worden niet uit de windsnelheid afgeleid."),
      noted("wind", "Wind", "Windsnelheid in km/u is geen zijwind of windstoot en wordt niet als score gebruikt."),
      noted("wegdek", "Wegdek", "Nat wegdek en zicht bij hogere snelheid worden niet gemeten."),
    ],
    missing: ["zijwind", "windstoten", "wegdek", "zicht"],
    requiredFields: [
      field("crosswind", "zijwind", "none", null, false),
      field("gusts", "windstoten", "none", null, false),
      field("road", "wegdek", "none", null, false),
      field("visibility", "zicht", "none", null, false),
    ],
    blocks: [block("no-crosswind", "Zonder zijwind, windstoten en wegdek is er geen wielrenmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason:
        "We missen zijwind, windstoten en de toestand van het wegdek. Windsnelheid in km/u is geen zijwind. Daarom kunnen we nog geen wielrenmoment adviseren.",
      tideReason: null,
    },
    explanation: `Wielrennen onderscheidt zich door zijwind, windstoten en het wegdek. ${NO_FALLBACK}`,
    caveats: "Geen route-, snelheids- of effectieve rijwindberekening.",
  },
  {
    sportId: "gravelbiken",
    tagline: "Onverharde paden en grind",
    nextSportId: "mountainbiken",
    factors: [
      applied("oppervlak", "Oppervlak", "Het oppervlak van onverharde stroken blokkeert het advies zolang die staat niet is gemeten."),
      noted("regen", "Eerdere neerslag", "Een neerslagkans is geen hoeveelheid eerdere regen en geen droogtijd."),
    ],
    missing: ["oppervlak", "eerdere neerslag", "droogtijd"],
    requiredFields: [
      field("surface", "oppervlak", "none", null, false),
      field("priorRain", "eerdere neerslag", "none", null, false),
      field("drying", "droogtijd", "none", null, false),
    ],
    blocks: [block("no-surface", "Zonder oppervlak en droogtijd van de onverharde stroken is er geen gravelmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen het oppervlak en de droogtijd van de onverharde stroken. Daarom kunnen we nog geen gravelmoment adviseren.",
      tideReason: null,
    },
    explanation: `Gravel hangt af van het pad en van hoe lang dat nodig heeft om te drogen. ${NO_FALLBACK}`,
    caveats: "Geen ondergrond- of trailconditiesensor.",
  },
  {
    sportId: "mountainbiken",
    tagline: "Singletracks en bossen",
    nextSportId: "hardlopen",
    factors: [
      applied("trail", "Trailstatus", "Trailstatus, modder en grip blokkeren het advies zolang die meting ontbreekt."),
      noted("regen", "Regen", "Eerdere regen wordt niet uit de neerslagkans afgeleid."),
    ],
    missing: ["trailstatus", "ondergrond", "grip"],
    requiredFields: [
      field("trail", "trailstatus", "none", null, false),
      field("surface", "ondergrond", "none", null, false),
      field("grip", "grip", "none", null, false),
    ],
    blocks: [block("no-trail", "Zonder trailstatus en grip is er geen mountainbikemoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen de trailstatus en de grip op wortels en afdalingen. Daarom kunnen we nog geen mountainbikemoment adviseren.",
      tideReason: null,
    },
    explanation: `Mountainbiken hangt af van de trail en van de grip. ${NO_FALLBACK}`,
    caveats: "Geen trailstatus of bodemvochtmeting.",
  },
  {
    sportId: "hardlopen",
    tagline: "Tempo- en duurloop",
    nextSportId: "trailrunning",
    factors: [
      applied("warmte", "Warmtebelasting", "Warmtebelasting uit temperatuur, vocht en zon blokkeert het advies: vocht zit niet in de bron."),
      noted("temperatuur", "Temperatuur", "Luchttemperatuur in °C is geen warmtebelasting en wordt niet als score gebruikt."),
      noted("regen", "Regen", "Neerslagkans is geen score voor hardlopen."),
    ],
    missing: ["warmtebelasting", "luchtvochtigheid", "zoninstraling"],
    requiredFields: [
      field("heat", "warmtebelasting", "none", null, false),
      field("humidity", "luchtvochtigheid", "none", null, false),
      field("radiation", "zoninstraling", "none", null, false),
    ],
    blocks: [block("no-heat", "Zonder warmtebelasting uit temperatuur, vocht en zon is er geen hardloopmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason:
        "We missen de warmtebelasting uit temperatuur, vocht en zon. Luchttemperatuur in °C is geen warmtebelasting. Daarom kunnen we nog geen hardloopmoment adviseren.",
      tideReason: null,
    },
    explanation: `Hardlopen onderscheidt zich door warmtebelasting, niet door een losse temperatuur. ${NO_FALLBACK}`,
    caveats: "Geen hartslag- of tempozones.",
  },
  {
    sportId: "trailrunning",
    tagline: "Trails en heuvels",
    nextSportId: "wandelen",
    factors: [
      applied("grip", "Grip", "Grip op de route blokkeert het advies zolang de ondergrond niet is gemeten."),
      noted("daglicht", "Daglicht", "Beschikbaar daglicht zit niet in de uurverwachting."),
    ],
    missing: ["grip", "eerdere regen", "zicht", "daglicht"],
    requiredFields: [
      field("grip", "grip", "none", null, false),
      field("priorRain", "eerdere regen", "none", null, false),
      field("visibility", "zicht", "none", null, false),
      field("daylight", "daglicht", "none", null, false),
    ],
    blocks: [block("no-grip", "Zonder grip, zicht en daglicht is er geen trailmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen de grip op de route, het zicht en het beschikbare daglicht. Daarom kunnen we nog geen trailmoment adviseren.",
      tideReason: null,
    },
    explanation: `Trailrunning hangt af van grip, zicht en daglicht. ${NO_FALLBACK}`,
    caveats: "Geen trail- of hoogtemeting.",
  },
  {
    sportId: "wandelen",
    tagline: "Rustige buitenwandelingen",
    nextSportId: "hiken",
    factors: [
      applied("gevoelskou", "Gevoelskou", "Gevoelskou blokkeert het advies: die waarde wordt niet uit de luchttemperatuur berekend."),
      noted("daglicht", "Daglicht", "Daglicht voor de gekozen wandeling zit niet in de bron."),
    ],
    missing: ["gevoelskou", "regenduur", "daglicht"],
    requiredFields: [
      field("feelsLike", "gevoelskou", "none", null, false),
      field("rainDuration", "regenduur", "none", null, false),
      field("daylight", "daglicht", "none", null, false),
    ],
    blocks: [block("no-feels", "Zonder gevoelskou, regenduur en daglicht is er geen wandelmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen de gevoelskou, de duur van de regen en het daglicht voor de wandeling. Daarom kunnen we nog geen wandelmoment adviseren.",
      tideReason: null,
    },
    explanation: `Wandelen hangt af van gevoelskou, hoe lang het regent en het daglicht. ${NO_FALLBACK}`,
    caveats: "Geen padconditie of toegankelijkheidscheck.",
  },
  {
    sportId: "hiken",
    tagline: "Langere tochten in natuur",
    nextSportId: "golf",
    factors: [
      applied("tocht", "Tocht", "Tochtduur, terrein en blootstelling blokkeren het advies zolang de route niet is gemeten."),
      noted("daglicht", "Daglicht", "Resterend daglicht zit niet in de uurverwachting."),
    ],
    missing: ["tochtduur", "terrein", "blootstelling", "daglicht"],
    requiredFields: [
      field("duration", "tochtduur", "none", null, false),
      field("terrain", "terrein", "none", null, false),
      field("exposure", "blootstelling", "none", null, false),
      field("daylight", "daglicht", "none", null, false),
    ],
    blocks: [block("no-route", "Zonder tochtduur, terrein en resterend daglicht is er geen hikemoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen tochtduur, terrein, blootstelling en resterend daglicht. Daarom kunnen we nog geen hikemoment adviseren.",
      tideReason: null,
    },
    explanation: `Hiken hangt af van de tocht, het terrein en het licht dat nog over is. ${NO_FALLBACK}`,
    caveats: "Geen terrein- of lawine-informatie.",
  },
  {
    sportId: "golf",
    tagline: "Baanrondes buiten",
    nextSportId: "tennis-padel",
    factors: [
      applied("onweer", "Bliksem", "Een bliksemwaarschuwing gaat vóór elke vergelijking. De waarschuwingsbron heeft geen bliksemcode."),
      applied("baan", "Baanstatus", "De baanstatus is niet gekoppeld en wordt niet uit neerslag afgeleid."),
    ],
    missing: ["bliksemwaarschuwing", "baanstatus", "windstoten", "neerslagduur"],
    requiredFields: [
      field("lightning", "bliksemwaarschuwing", "warnings", null, false),
      field("course", "baanstatus", "none", null, false),
      field("gusts", "windstoten", "none", null, false),
      field("rainDuration", "neerslagduur", "none", null, false),
    ],
    blocks: [block("no-lightning", "Zonder bliksemwaarschuwing en baanstatus is er geen golfronde.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "Bliksemwaarschuwingen en de baanstatus zijn niet als bron gekoppeld. Daarom kunnen we nog geen golfmoment adviseren.",
      tideReason: null,
    },
    explanation: `Bij golf gaan bliksem en baanstatus vóór wind en regen. ${NO_FALLBACK}`,
    caveats: "Geen baansluiting of greenspeed.",
  },
  {
    sportId: "tennis-padel",
    tagline: "Buitenbanen",
    nextSportId: "voetbal",
    factors: [
      applied("baan", "Baantype", "Baantype en ondergrond blokkeren het advies: die status zit niet in de weerbron."),
      noted("hitte", "Hitte", "Hitte op de baan wordt niet uit de luchttemperatuur berekend."),
    ],
    missing: ["baantype", "droogtijd", "windblootstelling", "hitte"],
    requiredFields: [
      field("court", "baantype", "none", null, false),
      field("drying", "droogtijd", "none", null, false),
      field("exposure", "windblootstelling", "none", null, false),
      field("heat", "hitte", "none", null, false),
    ],
    blocks: [block("no-court", "Zonder baantype, droogtijd en windblootstelling is er geen tennis- of padelmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen het baantype, de droogtijd en de windblootstelling van de baan. Daarom kunnen we nog geen tennis- of padelmoment adviseren.",
      tideReason: null,
    },
    explanation: `Tennis en padel hangen af van de baan en van hoe lang die droogt. ${NO_FALLBACK}`,
    caveats: "Geen baanreservering of ondergrondstatus.",
  },
  {
    sportId: "voetbal",
    tagline: "Veldwedstrijden en training",
    nextSportId: "hockey",
    factors: [
      applied("veld", "Veld", "Veldtype en bespeelbaarheid blokkeren het advies zolang de veldstatus ontbreekt."),
      applied("onweer", "Onweer", "Een onweermelding is geen vrij tekstveld in de waarschuwingsbron en blokkeert daarom."),
    ],
    missing: ["veldtype", "bespeelbaarheid", "onweer"],
    requiredFields: [
      field("pitch", "veldtype", "none", null, false),
      field("playable", "bespeelbaarheid", "none", null, false),
      field("thunder", "onweer", "warnings", null, false),
    ],
    blocks: [block("no-pitch", "Zonder veldstatus en onweermelding is er geen voetbalmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen het veldtype, de bespeelbaarheid en een onweermelding. Daarom kunnen we nog geen voetbalmoment adviseren.",
      tideReason: null,
    },
    explanation: `Voetbal hangt eerst af van het veld en van onweer. ${NO_FALLBACK}`,
    caveats: "Geen veldkeuring of wedstrijdregels.",
  },
  {
    sportId: "hockey",
    tagline: "Kunstgras buiten",
    nextSportId: "zeilen",
    factors: [
      applied("veld", "Veldstatus", "De officiële veldstatus gaat vóór het weer. Vorst in de lucht is geen ijs op het veld."),
      noted("hitte", "Hitte", "Hittebelasting wordt niet uit de luchttemperatuur berekend."),
    ],
    missing: ["veldstatus", "ijsvorming", "hittebelasting"],
    requiredFields: [
      field("pitch", "veldstatus", "none", null, false),
      field("ice", "ijsvorming", "none", null, false),
      field("heat", "hittebelasting", "none", null, false),
    ],
    blocks: [block("no-pitch", "Zonder officiële veldstatus is er geen hockeymoment. Vorst in de lucht telt niet als ijs.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen de officiële veldstatus. Vorst in de lucht is geen ijs op het veld. Daarom kunnen we nog geen hockeymoment adviseren.",
      tideReason: null,
    },
    explanation: `Hockey hangt af van de veldstatus. Een luchttemperatuur onder nul is geen ijsmeting. ${NO_FALLBACK}`,
    caveats: "Geen veldwatering- of baanstatus.",
  },
  {
    sportId: "zeilen",
    tagline: "Windgedreven op water",
    nextSportId: "windsurfen",
    factors: [
      applied("windhoek", "Windhoek", "Windhoek en windstoten blokkeren het advies: richting en stoten zitten niet in de bron."),
      applied("golfslag", "Golfslag", "Golfslag kan worden vastgelegd als de waterbron een geldige meting levert. Dat is nog geen score."),
    ],
    missing: ["windhoek", "windstoten", "vaargebied", "bootprofiel"],
    requiredFields: [
      field("windAngle", "windhoek", "none", null, false),
      field("gusts", "windstoten", "none", null, false),
      field("waves", "golfslag", "water", "waveHeightM", true),
      field("area", "vaargebied", "none", null, false),
      field("boat", "bootprofiel", "none", null, false),
    ],
    blocks: [
      block("no-waves", "Zonder golfslag voor het vaargebied is er geen zeilmoment."),
      block("no-angle", "Windhoek en windstoten blijven blokkeren, ook als de golfslag is vastgelegd."),
    ],
    gate: {
      kind: "water",
      field: "waveHeightM",
      blockedReason: "We missen de golfslag voor dit vaargebied. Daarom kunnen we nog geen zeilmoment adviseren.",
      recordedReason: "De golfslag is vastgelegd, maar windhoek en windstoten ontbreken. Daarom kunnen we nog geen zeilmoment adviseren.",
      tideReason: null,
    },
    explanation: "Zeilen heeft windhoek, windstoten en golfslag nodig. Een vastgelegde golfslag geeft nog geen score.",
    caveats: "Geen boot- of vaardigheidsprofiel en geen vaargebied in de bron.",
  },
  {
    sportId: "windsurfen",
    tagline: "Plank en zeil",
    nextSportId: "kitesurfen",
    factors: [
      applied("wind", "Windbereik", "Het windbereik voor materiaal en niveau ontbreekt. Windsnelheid alleen is geen bereik."),
      applied("water", "Watertemperatuur", "Watertemperatuur kan worden vastgelegd. Zonder windrichting ten opzichte van de oever is er geen score."),
    ],
    missing: ["windbereik", "windrichting ten opzichte van de oever", "golven"],
    requiredFields: [
      field("windRange", "windbereik", "none", null, false),
      field("shoreDirection", "windrichting ten opzichte van de oever", "none", null, false),
      field("waterTemperature", "watertemperatuur", "water", "waterTemperatureC", true),
      field("waves", "golven", "water", "waveHeightM", false),
    ],
    blocks: [
      block("no-water-temp", "Zonder watertemperatuur is er geen windsurfmoment."),
      block("no-wind-range", "Windbereik en richting ten opzichte van de oever blijven blokkeren, ook met een watertemperatuur."),
    ],
    gate: {
      kind: "water",
      field: "waterTemperatureC",
      blockedReason: "We missen een watertemperatuur voor deze plek. Daarom kunnen we nog geen windsurfmoment adviseren.",
      recordedReason:
        "De watertemperatuur is vastgelegd, maar het windbereik voor het materiaal en de richting ten opzichte van de oever ontbreken. Daarom kunnen we nog geen windsurfmoment adviseren.",
      tideReason: null,
    },
    explanation: "Windsurfen heeft een windbereik en de richting ten opzichte van de oever nodig. Watertemperatuur alleen geeft geen score.",
    caveats: "Geen materiaal- of niveauprofiel en geen oeverrichting in de bron.",
  },
  {
    sportId: "kitesurfen",
    tagline: "Kite en plank",
    nextSportId: "surfen",
    factors: [
      applied("spot", "Spotregels", "Spotregels en lanceerzijde blokkeren het advies: die staan niet in de bron."),
      applied("getij", "Getij", "Een getijdentijdstip is geen windrichting en geen lanceerzijde."),
    ],
    missing: ["spotregels", "lanceerzijde", "windrichting", "vlagerigheid"],
    requiredFields: [
      field("spotRules", "spotregels", "none", null, false),
      field("launch", "lanceerzijde", "none", null, false),
      field("windDirection", "windrichting", "none", null, false),
      field("gusts", "vlagerigheid", "none", null, false),
      field("tide", "getij", "water", "tideTime", false),
    ],
    blocks: [
      block("no-launch", "Zonder windrichting, lanceerzijde en spotregels is er geen kitesurfmoment."),
      block("tide-clock", "Een getijdentijdstip is geen windrichting of lanceerzijde."),
    ],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen de windrichting, de lanceerzijde en de spotregels. Daarom kunnen we nog geen kitesurfmoment adviseren.",
      tideReason: "Een getijdentijdstip is geen windrichting of lanceerzijde. Daarom kunnen we nog geen kitesurfmoment adviseren.",
    },
    explanation: "Kitesurfen hangt af van de spot en van de windrichting. Een getijdenklok maakt dat niet goed.",
    caveats: "Geen lanceerzone en geen kitewaarschuwing in de bron.",
  },
  {
    sportId: "surfen",
    tagline: "Golfrijden aan de kust",
    nextSportId: "suppen",
    factors: [
      applied("deining", "Deining", "Deiningperiode en -richting blokkeren het advies. Golfhoogte is niet die deining."),
      applied("getij", "Getijfase", "Een getijdentijdstip is geen getijfase op de break."),
    ],
    missing: ["deiningperiode", "deiningsrichting", "getijfase", "windrichting op de break"],
    requiredFields: [
      field("waveHeight", "golfhoogte", "water", "waveHeightM", true),
      field("swellPeriod", "deiningperiode", "none", null, false),
      field("swellDirection", "deiningsrichting", "none", null, false),
      field("tidePhase", "getijfase", "none", null, false),
      field("windDirection", "windrichting op de break", "none", null, false),
    ],
    blocks: [
      block("no-swell", "Zonder deininghoogte, periode en richting is er geen surfmoment."),
      block("tide-clock", "Een getijdentijdstip is geen getijfase of deiningsrichting."),
    ],
    gate: {
      kind: "water",
      field: "waveHeightM",
      blockedReason: "We missen deininghoogte, periode en richting voor deze break. Daarom kunnen we nog geen surfmoment adviseren.",
      recordedReason:
        "De golfhoogte is vastgelegd, maar deiningperiode, deiningsrichting en getijfase ontbreken. Daarom kunnen we nog geen surfmoment adviseren.",
      tideReason: "Een getijdentijdstip is geen getijfase of deiningsrichting. Daarom kunnen we nog geen surfmoment adviseren.",
    },
    explanation: "Surfen hangt af van deining, periode, richting en getijfase. Golfhoogte of een getijdenklok is nog geen score.",
    caveats: "Geen swellperiode, swellrichting of getijfase in de bron.",
  },
  {
    sportId: "suppen",
    tagline: "Stand-up paddling",
    nextSportId: "kajakken",
    factors: [
      applied("afdrijf", "Afdrijfrichting", "De afdrijfrichting door wind blokkeert het advies: de windrichting zit niet in de bron."),
      applied("stroming", "Stroming", "Stroming kan worden vastgelegd. Zonder afdrijfrichting is er geen score."),
    ],
    missing: ["afdrijfrichting", "beschutting van de route"],
    requiredFields: [
      field("drift", "afdrijfrichting", "none", null, false),
      field("current", "stroming", "water", "currentMs", true),
      field("shelter", "beschutting van de route", "none", null, false),
    ],
    blocks: [
      block("no-current", "Zonder stroming op de route is er geen supmoment."),
      block("no-drift", "De afdrijfrichting blijft blokkeren, ook als de stroming is vastgelegd."),
    ],
    gate: {
      kind: "water",
      field: "currentMs",
      blockedReason: "We missen de stroming op deze route. Daarom kunnen we nog geen supmoment adviseren.",
      recordedReason: "De stroming is vastgelegd, maar de afdrijfrichting door de wind ontbreekt. Daarom kunnen we nog geen supmoment adviseren.",
      tideReason: null,
    },
    explanation: "Suppen hangt af van stroming en van de kant waarop de wind je afdrijft. Stroming alleen geeft geen score.",
    caveats: "Geen windrichting en geen beschutting van de route in de bron.",
  },
  {
    sportId: "kajakken",
    tagline: "Peddelen op water",
    nextSportId: "roeien",
    factors: [
      applied("stroming", "Stroming", "Stroming kan worden vastgelegd. Waterstand en afvoer blijven verplicht en ontbreken."),
      noted("wind", "Wind tegen stroom", "Wind tegen de stroom heeft een windrichting nodig en die zit niet in de bron."),
    ],
    missing: ["waterstand", "afvoer", "wind tegen de stroom"],
    requiredFields: [
      field("current", "stroming", "water", "currentMs", true),
      field("level", "waterstand", "none", null, false),
      field("discharge", "afvoer", "none", null, false),
      field("headwind", "wind tegen de stroom", "none", null, false),
    ],
    blocks: [
      block("no-current", "Zonder stroming voor het traject is er geen kajakmoment."),
      block("no-level", "Waterstand en afvoer blijven blokkeren, ook als de stroming is vastgelegd."),
    ],
    gate: {
      kind: "water",
      field: "currentMs",
      blockedReason: "We missen de stroming voor dit traject. Daarom kunnen we nog geen kajakmoment adviseren.",
      recordedReason: "De stroming is vastgelegd, maar waterstand en afvoer ontbreken. Daarom kunnen we nog geen kajakmoment adviseren.",
      tideReason: null,
    },
    explanation: "Kajakken hangt af van stroming, waterstand en afvoer. Een stromingsgetal zonder waterstand geeft geen score.",
    caveats: "Geen waterstand, afvoer of vaarwegstatus in de bron.",
  },
  {
    sportId: "roeien",
    tagline: "Boot en riemen",
    nextSportId: "openwaterzwemmen",
    factors: [
      applied("wind", "Wind op de baan", "Wind langs of dwars op de baan blokkeert het advies: de baanrichting zit niet in de bron."),
      applied("golfslag", "Golfslag", "Golfslag kan worden vastgelegd. Zonder de wind ten opzichte van de baan is er geen score."),
    ],
    missing: ["wind langs of dwars op de baan", "zicht", "vaarbeperkingen"],
    requiredFields: [
      field("courseWind", "wind langs of dwars op de baan", "none", null, false),
      field("waves", "golfslag", "water", "waveHeightM", true),
      field("visibility", "zicht", "none", null, false),
      field("limits", "vaarbeperkingen", "none", null, false),
    ],
    blocks: [
      block("no-waves", "Zonder golfslag op de baan is er geen roeimoment."),
      block("no-course-wind", "Wind langs of dwars op de baan blijft blokkeren, ook als de golfslag is vastgelegd."),
    ],
    gate: {
      kind: "water",
      field: "waveHeightM",
      blockedReason: "We missen de golfslag op deze baan. Daarom kunnen we nog geen roeimoment adviseren.",
      recordedReason: "De golfslag is vastgelegd, maar de wind langs of dwars op de baan ontbreekt. Daarom kunnen we nog geen roeimoment adviseren.",
      tideReason: null,
    },
    explanation: "Roeien hangt af van de wind ten opzichte van de baan en van de golfslag. Golfslag alleen geeft geen score.",
    caveats: "Geen baanrichting en geen verenigingsstatus in de bron.",
  },
  {
    sportId: "skeeleren",
    tagline: "Inline buiten",
    nextSportId: "paardrijden",
    factors: [
      applied("wegdek", "Wegdek", "Droogte en grip van het asfalt blokkeren het advies zolang het wegdek niet is gemeten."),
      noted("wind", "Windstoten", "Windstoten en zicht zitten niet in de uurverwachting."),
    ],
    missing: ["wegdek", "grip", "windstoten", "zicht"],
    requiredFields: [
      field("road", "wegdek", "none", null, false),
      field("grip", "grip", "none", null, false),
      field("gusts", "windstoten", "none", null, false),
      field("visibility", "zicht", "none", null, false),
    ],
    blocks: [block("no-road", "Zonder droogte en grip van het asfalt is er geen skeelermoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen de droogte en grip van het asfalt, en het zicht. Windstoten zitten niet in de bron. Daarom kunnen we nog geen skeelermoment adviseren.",
      tideReason: null,
    },
    explanation: `Skeeleren hangt af van het wegdek en van het zicht. ${NO_FALLBACK}`,
    caveats: "Geen wegdek- of onderhoudsstatus.",
  },
  {
    sportId: "paardrijden",
    tagline: "Buitenritten",
    nextSportId: "schaatsen",
    factors: [
      applied("bodem", "Bodem", "Bodem en ruiterpadstatus blokkeren het advies zolang die meting ontbreekt."),
      noted("wind", "Windstoten", "Windstoten op een blootgesteld traject zitten niet in de bron."),
    ],
    missing: ["bodemgesteldheid", "ruiterpadstatus", "warmtebelasting", "windstoten"],
    requiredFields: [
      field("soil", "bodemgesteldheid", "none", null, false),
      field("path", "ruiterpadstatus", "none", null, false),
      field("heat", "warmtebelasting", "none", null, false),
      field("gusts", "windstoten", "none", null, false),
    ],
    blocks: [block("no-path", "Zonder bodem en ruiterpadstatus is er geen ruiteradvies.")],
    gate: {
      kind: "unmeasured",
      blockedReason: "We missen de bodemgesteldheid en de ruiterpadstatus. Daarom kunnen we nog geen ruiteradvies geven.",
      tideReason: null,
    },
    explanation: `Paardrijden hangt af van de bodem en het ruiterpad. ${NO_FALLBACK}`,
    caveats: "Geen manege- of bodemvochtmeting.",
  },
  {
    sportId: "schaatsen",
    tagline: "Natuurijs en banen",
    nextSportId: "outdoorfitness",
    factors: [
      applied("ijs", "IJs", "Openstelling en beoordeelde ijskwaliteit gaan vóór weerscomfort. Die meting ontbreekt."),
      noted("temperatuur", "Luchttemperatuur", "Vorst alleen rechtvaardigt geen aanbeveling. Natuurijs en een beheerde baan zijn niet hetzelfde."),
    ],
    missing: ["openstelling", "ijskwaliteit", "onderscheid baan en natuurijs"],
    requiredFields: [
      field("opening", "openstelling", "none", null, false),
      field("quality", "ijskwaliteit", "none", null, false),
      field("kind", "onderscheid baan en natuurijs", "none", null, false),
    ],
    blocks: [block("no-ice", "Zonder openstelling en ijskwaliteit is er geen schaatsmoment. Vorst in de lucht telt niet.")],
    gate: {
      kind: "unmeasured",
      blockedReason:
        "Natuurijs wordt nooit veilig verklaard op basis van luchttemperatuur alleen. Een beheerde baan en beoordeelde ijskwaliteit ontbreken. IJsdata ontbreekt → NO_SCORE.",
      tideReason: null,
    },
    explanation: "Schaatsen begint bij de openstelling en de ijskwaliteit. Het verschil tussen een beheerde baan en natuurijs zit niet in de weerbron.",
    caveats: "Natuurijs nooit veilig verklaren op luchttemperatuur alleen.",
  },
  {
    sportId: "outdoorfitness",
    tagline: "Buiten trainen",
    nextSportId: null,
    factors: [
      applied("plek", "Trainingsplek", "Hitte, zon en natte toestellen op de trainingsplek blokkeren het advies zolang die plek niet is gemeten."),
      applied("onweer", "Onweer", "Een onweermelding is geen code in de waarschuwingsbron en blokkeert daarom."),
    ],
    missing: ["hitte op de plek", "toestelstatus", "onweer"],
    requiredFields: [
      field("heat", "hitte op de plek", "none", null, false),
      field("equipment", "toestelstatus", "none", null, false),
      field("thunder", "onweer", "warnings", null, false),
    ],
    blocks: [block("no-site", "Zonder de toestand van de trainingsplek en een onweermelding is er geen fitnessmoment.")],
    gate: {
      kind: "unmeasured",
      blockedReason:
        "We missen hitte en zon op de trainingsplek, de toestand van de toestellen en een onweermelding. Daarom kunnen we nog geen fitnessmoment adviseren.",
      tideReason: null,
    },
    explanation: `Outdoorfitness hangt af van de plek en van onweer. ${NO_FALLBACK}`,
    caveats: "Geen toestel- of parkstatus.",
  },
];

function toProfile(seed: Seed): SportDecisionProfile {
  return {
    sportId: seed.sportId,
    modelVersion: `${seed.sportId}-v1-gates`,
    releaseStatus: "withheld",
    personalAdvice: false,
    tagline: seed.tagline,
    nextSportId: seed.nextSportId,
    factors: seed.factors,
    missing: seed.missing,
    requiredFields: seed.requiredFields,
    blocks: seed.blocks,
    gate: seed.gate,
    withheldReason: seed.gate.blockedReason,
    explanation: seed.explanation,
    caveats: seed.caveats,
  };
}

const openWater: SportDecisionProfile = {
  sportId: "openwaterzwemmen",
  modelVersion: OPEN_WATER_MODEL_VERSION,
  releaseStatus: "withheld",
  personalAdvice: false,
  tagline: "Zwemmen in open water",
  nextSportId: "skeeleren",
  factors: [
    applied("zwemverbod", "Zwemstatus", "Een negatief zwemadvies of zwemverbod blokkeert. Er is dan geen tijdvak."),
    applied("geldigheid", "Geldigheid van de meting", "Alleen een meting met bron, tijd, eenheid, geldigheid en dezelfde zwemplek telt."),
    noted("watertemperatuur", "Watertemperatuur", "Een recente watertemperatuur is verplicht, maar wordt nog niet omgerekend naar een score."),
    noted("stroming", "Stroming", "Stroming, richting, golfslag en blootstelling hangen af van het watertype en zijn nog geen score."),
  ],
  missing: ["officiële zwemplek", "watertemperatuur", "zwemwaterkwaliteit", "gevalideerde beslisregel"],
  requiredFields: [
    field("spot", "officiële zwemplek", "swim", "spotId", true),
    field("swimStatus", "zwemwaterkwaliteit", "swim", "advice", true),
    field("waterTemperature", "watertemperatuur", "water", "waterTemperatureC", true),
    field("current", "stroming", "water", "currentMs", true),
    field("currentDirection", "stroomrichting", "water", "currentDirectionDeg", true),
    field("waves", "golfslag", "water", "waveHeightM", true),
    field("exposure", "blootstelling", "water", "exposure", true),
  ],
  blocks: [
    block("ban", "Een negatief zwemadvies of zwemverbod blokkeert. Er is dan geen tijdvak."),
    block("validity", "Een meting telt alleen met bron, tijd, eenheid, geldigheid en dezelfde zwemplek."),
    block("tide", "Een getijdentijdstip is geen meting van de lokale stroming."),
  ],
  gate: null,
  withheldReason:
    "Zonder officiële zwemplek en geldige essentiële metingen blijft het zwemmoment onbeschikbaar. Een lucht-, wind- en regenscore wordt niet gebruikt.",
  explanation:
    "Het zwemprofiel verwerkt blokkades en de geldigheid van metingen. Het rekent geen comfortscore zolang er geen gevalideerde beslisregel is.",
  caveats: "Geen zwemadvies zonder gekoppelde officiële zwemlocatie en metingen. Een getijdentijdstip is geen stroming.",
};

const withheldFallback: SportDecisionProfile = {
  sportId: "onbekend",
  modelVersion: "onbekend-v1-withheld",
  releaseStatus: "withheld",
  personalAdvice: false,
  tagline: "Onbekende sport",
  nextSportId: null,
  factors: [],
  missing: ["sportprofiel"],
  requiredFields: [field("profile", "sportprofiel", "none", null, false)],
  blocks: [block("unknown", "Er is geen profiel voor deze sport.")],
  gate: {
    kind: "unmeasured",
    blockedReason: "Voor deze sport is nog geen gevalideerde beslisregel vrijgegeven. Daarom is er geen persoonlijk sportmoment en geen score.",
    tideReason: null,
  },
  withheldReason: "Voor deze sport is nog geen gevalideerde beslisregel vrijgegeven. Daarom is er geen persoonlijk sportmoment en geen score.",
  explanation: "Er is geen profiel voor deze sport.",
  caveats: "Geen score.",
};

export const sportProfiles: Record<string, SportDecisionProfile> = Object.fromEntries(
  [...seeds.map(toProfile), openWater].map((profile) => [profile.sportId, profile]),
);

export function getScoreProfile(sportId: string) {
  return sportProfiles[sportId] ?? withheldFallback;
}
