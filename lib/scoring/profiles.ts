import { OPEN_WATER_MODEL_VERSION } from "@/lib/scoring/swim";

export type ReleaseStatus = "withheld";

export type ProfileFactor = {
  id: string;
  label: string;
  explanation: string;
  /** True only when a released rule actually uses the factor. Descriptions alone stay false. */
  applied: boolean;
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
  withheldReason: string;
  explanation: string;
  caveats: string;
};

export const SCORE_REGISTRY_VERSION = "weersport-profile-registry-v1";

const LAND_REASON =
  "Voor deze sport is nog geen gevalideerde beslisregel vrijgegeven. Daarom is er geen persoonlijk sportmoment en geen score.";

const WATER_REASON =
  "Kritieke waterdata ontbreekt. Er is geen geruststellende sportgeschiktheidsscore en geen terugval op lucht, wind en regen.";

const ICE_REASON =
  "Natuurijs wordt nooit veilig verklaard op basis van luchttemperatuur alleen. IJsdata ontbreekt → NO_SCORE.";

type Seed = {
  sportId: string;
  tagline: string;
  nextSportId: string | null;
  kind: "land" | "water" | "ice";
  factors: Array<Omit<ProfileFactor, "applied">>;
  missing: string[];
  caveats: string;
};

const seeds: Seed[] = [
  {
    sportId: "fietsen",
    tagline: "Ontspannen buitenritten",
    nextSportId: "wielrennen",
    kind: "land",
    factors: [
      { id: "wind", label: "Wind", explanation: "Tegenwind per rijrichting hoort bij fietsen, maar wordt nog niet verwerkt." },
      { id: "regen", label: "Regen", explanation: "De duur van buien hoort bij fietsen, maar wordt nog niet verwerkt." },
      { id: "temperatuur", label: "Temperatuur", explanation: "Gevoelstemperatuur in °C hoort bij fietsen, maar is nog geen score." },
    ],
    missing: ["routeblootstelling", "wind per rijrichting", "gevalideerde beslisregel"],
    caveats: "Geen route- of hoogtemeterberekening.",
  },
  {
    sportId: "wielrennen",
    tagline: "Sportieve ritten op tempo",
    nextSportId: "gravelbiken",
    kind: "land",
    factors: [
      { id: "rijwind", label: "Rijwind", explanation: "Zijwind en windstoten horen bij wielrennen, maar worden nog niet verwerkt." },
      { id: "wind", label: "Wind", explanation: "Windsnelheid in km/u is nog geen score." },
      { id: "regen", label: "Regen", explanation: "Nat wegdek en zicht horen bij wielrennen, maar worden nog niet verwerkt." },
    ],
    missing: ["windstoten op open segmenten", "wegdek", "gevalideerde beslisregel"],
    caveats: "Geen route-, snelheids- of effectieve rijwindberekening.",
  },
  {
    sportId: "gravelbiken",
    tagline: "Onverharde paden en grind",
    nextSportId: "mountainbiken",
    kind: "land",
    factors: [
      { id: "regen", label: "Regen", explanation: "Eerdere neerslag en droogtijd horen bij gravel, maar worden nog niet verwerkt." },
      { id: "ondergrond", label: "Ondergrond", explanation: "De staat van onverharde stroken ontbreekt." },
    ],
    missing: ["oppervlak", "droogtijd", "gevalideerde beslisregel"],
    caveats: "Geen ondergrond- of trailconditiesensor.",
  },
  {
    sportId: "mountainbiken",
    tagline: "Singletracks en bossen",
    nextSportId: "hardlopen",
    kind: "land",
    factors: [
      { id: "trail", label: "Trail", explanation: "Trailstatus, modder en grip worden nog niet verwerkt." },
      { id: "regen", label: "Regen", explanation: "Eerdere regen hoort bij mountainbiken, maar is nog geen score." },
    ],
    missing: ["trailstatus", "grip", "gevalideerde beslisregel"],
    caveats: "Geen trailstatus of bodemvochtmeting.",
  },
  {
    sportId: "hardlopen",
    tagline: "Tempo- en duurloop",
    nextSportId: "trailrunning",
    kind: "land",
    factors: [
      { id: "temperatuur", label: "Temperatuur", explanation: "Luchttemperatuur in °C is nog geen score." },
      { id: "zon", label: "Zon", explanation: "Warmtebelasting uit vocht en zoninstraling wordt nog niet verwerkt." },
      { id: "regen", label: "Regen", explanation: "Neerslag hoort bij hardlopen, maar is nog geen score." },
    ],
    missing: ["warmtebelasting", "inspanning en duur", "gevalideerde beslisregel"],
    caveats: "Geen hartslag- of tempozones.",
  },
  {
    sportId: "trailrunning",
    tagline: "Trails en heuvels",
    nextSportId: "wandelen",
    kind: "land",
    factors: [
      { id: "grip", label: "Grip", explanation: "Grip, eerdere regen en zicht worden nog niet verwerkt." },
      { id: "daglicht", label: "Daglicht", explanation: "Beschikbaar daglicht op de route ontbreekt." },
    ],
    missing: ["routegrip", "daglicht", "gevalideerde beslisregel"],
    caveats: "Geen trail- of hoogtemeting.",
  },
  {
    sportId: "wandelen",
    tagline: "Rustige buitenwandelingen",
    nextSportId: "hiken",
    kind: "land",
    factors: [
      { id: "gevoelskou", label: "Gevoelskou", explanation: "Gevoelskou en regenduur worden nog niet verwerkt." },
      { id: "daglicht", label: "Daglicht", explanation: "Daglicht voor de gekozen wandeling ontbreekt." },
    ],
    missing: ["gevoelskou", "regenduur", "gevalideerde beslisregel"],
    caveats: "Geen padconditie of toegankelijkheidscheck.",
  },
  {
    sportId: "hiken",
    tagline: "Langere tochten in natuur",
    nextSportId: "golf",
    kind: "land",
    factors: [
      { id: "tocht", label: "Tocht", explanation: "Tochtduur, terrein en blootstelling worden nog niet verwerkt." },
      { id: "daglicht", label: "Daglicht", explanation: "Resterend daglicht ontbreekt." },
    ],
    missing: ["terreinexposure", "daglicht", "gevalideerde beslisregel"],
    caveats: "Geen terrein- of lawine-informatie.",
  },
  {
    sportId: "golf",
    tagline: "Baanrondes buiten",
    nextSportId: "tennis-padel",
    kind: "land",
    factors: [
      { id: "onweer", label: "Onweer", explanation: "Bliksemwaarschuwingen gaan vóór een vergelijking en zijn niet gekoppeld." },
      { id: "baan", label: "Baan", explanation: "Baanstatus, windstoten en neerslagduur worden nog niet verwerkt." },
    ],
    missing: ["bliksemwaarschuwing", "baanstatus", "gevalideerde beslisregel"],
    caveats: "Geen baansluiting of greenspeed.",
  },
  {
    sportId: "tennis-padel",
    tagline: "Buitenbanen",
    nextSportId: "voetbal",
    kind: "land",
    factors: [
      { id: "baan", label: "Baan", explanation: "Baantype, droogtijd en windblootstelling worden nog niet verwerkt." },
      { id: "hitte", label: "Hitte", explanation: "Hitte op de baan is nog geen score." },
    ],
    missing: ["ondergrond", "droogtijd", "gevalideerde beslisregel"],
    caveats: "Geen baanreservering of ondergrondstatus.",
  },
  {
    sportId: "voetbal",
    tagline: "Veldwedstrijden en training",
    nextSportId: "hockey",
    kind: "land",
    factors: [
      { id: "veld", label: "Veld", explanation: "Veldtype en bespeelbaarheid worden nog niet verwerkt." },
      { id: "onweer", label: "Onweer", explanation: "Onweer en hittebelasting zijn nog geen score." },
    ],
    missing: ["veldstatus", "onweer", "gevalideerde beslisregel"],
    caveats: "Geen veldkeuring of wedstrijdregels.",
  },
  {
    sportId: "hockey",
    tagline: "Kunstgras buiten",
    nextSportId: "zeilen",
    kind: "land",
    factors: [
      { id: "veld", label: "Veld", explanation: "Officiële veldstatus, vorst en hitte worden nog niet verwerkt." },
    ],
    missing: ["veldstatus", "ijsvorming", "gevalideerde beslisregel"],
    caveats: "Geen veldwatering- of baanstatus.",
  },
  {
    sportId: "zeilen",
    tagline: "Windgedreven op water",
    nextSportId: "windsurfen",
    kind: "water",
    factors: [
      { id: "wind", label: "Wind", explanation: "Windhoek en windstoten horen bij zeilen, maar worden nog niet verwerkt." },
      { id: "water", label: "Water", explanation: "Golfslag en vaargebied ontbreken als gekoppelde meting." },
    ],
    missing: ["windhoek", "golfslag", "vaargebied"],
    caveats: "Geen waterstands- of golfmodel zonder gekoppelde waterbron.",
  },
  {
    sportId: "windsurfen",
    tagline: "Plank en zeil",
    nextSportId: "kitesurfen",
    kind: "water",
    factors: [
      { id: "wind", label: "Wind", explanation: "Windbereik voor materiaal en niveau wordt nog niet verwerkt." },
      { id: "water", label: "Water", explanation: "Watertemperatuur en golven ontbreken als gekoppelde meting." },
    ],
    missing: ["wind ten opzichte van de oever", "watertemperatuur", "golven"],
    caveats: "Geen spot-specifieke windmeting.",
  },
  {
    sportId: "kitesurfen",
    tagline: "Kite en plank",
    nextSportId: "surfen",
    kind: "water",
    factors: [
      { id: "spot", label: "Spot", explanation: "Spotregels, lanceerzijde en windrichting worden nog niet verwerkt." },
      { id: "water", label: "Water", explanation: "Getij en lokale watercondities ontbreken." },
    ],
    missing: ["spotregels", "windrichting", "lokale watercondities"],
    caveats: "Geen lanceerzone- of kitewaarschuwing.",
  },
  {
    sportId: "surfen",
    tagline: "Golfrijden aan de kust",
    nextSportId: "suppen",
    kind: "water",
    factors: [
      { id: "deining", label: "Deining", explanation: "Deininghoogte, periode en richting worden nog niet verwerkt." },
      { id: "getij", label: "Getij", explanation: "Getijfase en windrichting op de break ontbreken." },
    ],
    missing: ["deining", "getijfase", "windrichting op de break"],
    caveats: "Geen swell- of getijdenmodel.",
  },
  {
    sportId: "suppen",
    tagline: "Stand-up paddling",
    nextSportId: "kajakken",
    kind: "water",
    factors: [
      { id: "wind", label: "Wind", explanation: "Afdrijfrichting door wind wordt nog niet verwerkt." },
      { id: "water", label: "Water", explanation: "Stroming, golfslag en watertemperatuur ontbreken." },
    ],
    missing: ["stroming", "watertemperatuur", "beschutting van de route"],
    caveats: "Geen stromings- of waterkwaliteitscheck.",
  },
  {
    sportId: "kajakken",
    tagline: "Peddelen op water",
    nextSportId: "roeien",
    kind: "water",
    factors: [
      { id: "traject", label: "Traject", explanation: "Trajecttype, stroming en afvoer worden nog niet verwerkt." },
      { id: "water", label: "Water", explanation: "Waterstand en watertemperatuur ontbreken." },
    ],
    missing: ["stroming", "waterstand", "watertemperatuur"],
    caveats: "Geen vaarweg- of sluisstatus.",
  },
  {
    sportId: "roeien",
    tagline: "Boot en riemen",
    nextSportId: "openwaterzwemmen",
    kind: "water",
    factors: [
      { id: "wind", label: "Wind", explanation: "Wind langs of dwars op de baan wordt nog niet verwerkt." },
      { id: "water", label: "Water", explanation: "Golfslag, stroming en vaarbeperkingen ontbreken." },
    ],
    missing: ["golfslag", "stroming", "vaarbeperkingen"],
    caveats: "Geen banen- of verenigingsstatus.",
  },
  {
    sportId: "skeeleren",
    tagline: "Inline buiten",
    nextSportId: "paardrijden",
    kind: "land",
    factors: [
      { id: "wegdek", label: "Wegdek", explanation: "Droogte en grip van asfalt worden nog niet verwerkt." },
      { id: "wind", label: "Wind", explanation: "Windstoten en zicht zijn nog geen score." },
    ],
    missing: ["wegdek", "zicht", "gevalideerde beslisregel"],
    caveats: "Geen wegdek- of onderhoudsstatus.",
  },
  {
    sportId: "paardrijden",
    tagline: "Buitenritten",
    nextSportId: "schaatsen",
    kind: "land",
    factors: [
      { id: "bodem", label: "Bodem", explanation: "Bodem en ruiterpadstatus worden nog niet verwerkt." },
      { id: "wind", label: "Wind", explanation: "Windstoten op blootgestelde trajecten zijn nog geen score." },
    ],
    missing: ["ruiterpadstatus", "warmtebelasting", "gevalideerde beslisregel"],
    caveats: "Geen manege- of bodemvochtmeting.",
  },
  {
    sportId: "schaatsen",
    tagline: "Natuurijs en banen",
    nextSportId: "outdoorfitness",
    kind: "ice",
    factors: [
      { id: "ijs", label: "IJs", explanation: "Openstelling en beoordeelde ijskwaliteit gaan vóór weerscomfort." },
      { id: "temperatuur", label: "Luchttemperatuur", explanation: "Vorst alleen rechtvaardigt geen aanbeveling." },
    ],
    missing: ["ijsdikte", "ijskwaliteit"],
    caveats: "Natuurijs nooit veilig verklaren op luchttemperatuur alleen.",
  },
  {
    sportId: "outdoorfitness",
    tagline: "Buiten trainen",
    nextSportId: null,
    kind: "land",
    factors: [
      { id: "hitte", label: "Hitte", explanation: "Hitte en zon op de trainingsplek worden nog niet verwerkt." },
      { id: "onweer", label: "Onweer", explanation: "Natte toestellen en onweer zijn nog geen score." },
    ],
    missing: ["toestelstatus", "onweer", "gevalideerde beslisregel"],
    caveats: "Geen toestel- of parkstatus.",
  },
];

function reasonFor(kind: Seed["kind"]) {
  if (kind === "ice") return ICE_REASON;
  if (kind === "water") return WATER_REASON;
  return LAND_REASON;
}

function toProfile(seed: Seed): SportDecisionProfile {
  return {
    sportId: seed.sportId,
    modelVersion: `${seed.sportId}-v1-withheld`,
    releaseStatus: "withheld",
    personalAdvice: false,
    tagline: seed.tagline,
    nextSportId: seed.nextSportId,
    factors: seed.factors.map((factor) => ({ ...factor, applied: false })),
    missing: seed.missing,
    withheldReason: reasonFor(seed.kind),
    explanation: "Dit profiel noemt de factoren die deze sport onderscheiden. Geen daarvan wordt als score toegepast.",
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
    {
      id: "zwemverbod",
      label: "Zwemstatus",
      explanation: "Een negatief zwemadvies of zwemverbod blokkeert. Er is dan geen tijdvak.",
      applied: true,
    },
    {
      id: "geldigheid",
      label: "Geldigheid van de meting",
      explanation: "Alleen een meting met bron, tijd, eenheid, geldigheid en dezelfde zwemplek telt.",
      applied: true,
    },
    {
      id: "watertemperatuur",
      label: "Watertemperatuur",
      explanation: "Een recente watertemperatuur is verplicht, maar wordt nog niet omgerekend naar een score.",
      applied: false,
    },
    {
      id: "stroming",
      label: "Stroming",
      explanation: "Stroming, richting, golfslag en blootstelling hangen af van het watertype en zijn nog geen score.",
      applied: false,
    },
  ],
  missing: ["officiële zwemplek", "watertemperatuur", "zwemwaterkwaliteit", "gevalideerde beslisregel"],
  withheldReason:
    "Zonder officiële zwemplek en geldige essentiële metingen blijft het zwemmoment onbeschikbaar. Een lucht-, wind- en regenscore wordt niet gebruikt.",
  explanation:
    "Het zwemprofiel verwerkt blokkades en de geldigheid van metingen. Het rekent geen comfortscore zolang er geen gevalideerde beslisregel is.",
  caveats: "Geen zwemadvies zonder gekoppelde officiële zwemlocatie en metingen. Een getijdentijdstip is geen stroming.",
};

export const sportProfiles: Record<string, SportDecisionProfile> = Object.fromEntries(
  [...seeds.map(toProfile), openWater].map((profile) => [profile.sportId, profile]),
);

const withheldFallback: SportDecisionProfile = {
  sportId: "onbekend",
  modelVersion: "onbekend-v1-withheld",
  releaseStatus: "withheld",
  personalAdvice: false,
  tagline: "Onbekende sport",
  nextSportId: null,
  factors: [],
  missing: ["sportprofiel"],
  withheldReason: LAND_REASON,
  explanation: "Er is geen profiel voor deze sport.",
  caveats: "Geen score.",
};

export function getScoreProfile(sportId: string) {
  return sportProfiles[sportId] ?? withheldFallback;
}
