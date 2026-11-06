export type SportFamily = {
  id: string;
  name: string;
  icon: string;
};

export type Sport = {
  id: string;
  name: string;
  familyId: string;
  icon: string;
  /** Set when Figma still uses a related pictogram. Node 82:122. */
  iconNote?: string;
};

export const families: SportFamily[] = [
  { id: "fietsen", name: "Fietsen", icon: "/icons/pedal-bike.svg" },
  { id: "lopen", name: "Lopen & wandelen", icon: "/icons/directions-run.svg" },
  { id: "bal", name: "Bal- & racketsporten", icon: "/icons/sports-soccer.svg" },
  { id: "wind", name: "Wind- & golfsporten", icon: "/icons/sailing.svg" },
  { id: "peddelen", name: "Peddelen & zwemmen", icon: "/icons/kayaking.svg" },
  { id: "overig", name: "Overige buitensporten", icon: "/icons/roller-skating.svg" },
];

const related = "Huidig verwant pictogram. Een sport-specifiek SVG wordt nog gezocht.";

export const sports: Sport[] = [
  { id: "fietsen", name: "Fietsen", familyId: "fietsen", icon: "/icons/pedal-bike.svg" },
  { id: "wielrennen", name: "Wielrennen", familyId: "fietsen", icon: "/icons/bike-fast.svg" },
  { id: "gravelbiken", name: "Gravelbiken", familyId: "fietsen", icon: "/icons/bike.svg", iconNote: related },
  { id: "mountainbiken", name: "Mountainbiken", familyId: "fietsen", icon: "/icons/directions-bike.svg", iconNote: related },
  { id: "hardlopen", name: "Hardlopen", familyId: "lopen", icon: "/icons/directions-run.svg" },
  { id: "trailrunning", name: "Trailrunning", familyId: "lopen", icon: "/icons/directions-run.svg", iconNote: related },
  { id: "wandelen", name: "Wandelen", familyId: "lopen", icon: "/icons/directions-walk.svg" },
  { id: "hiken", name: "Hiken", familyId: "lopen", icon: "/icons/hiking.svg" },
  { id: "golf", name: "Golf", familyId: "bal", icon: "/icons/sports-golf.svg" },
  { id: "tennis-padel", name: "Tennis / padel", familyId: "bal", icon: "/icons/sports-tennis.svg" },
  { id: "voetbal", name: "Voetbal", familyId: "bal", icon: "/icons/sports-soccer.svg" },
  { id: "hockey", name: "Hockey", familyId: "bal", icon: "/icons/sports-hockey.svg" },
  { id: "zeilen", name: "Zeilen", familyId: "wind", icon: "/icons/sailing.svg" },
  { id: "windsurfen", name: "Windsurfen", familyId: "wind", icon: "/icons/surfing.svg", iconNote: related },
  { id: "kitesurfen", name: "Kitesurfen", familyId: "wind", icon: "/icons/kitesurfing.svg" },
  { id: "surfen", name: "Surfen", familyId: "wind", icon: "/icons/surfing.svg" },
  { id: "suppen", name: "Suppen", familyId: "peddelen", icon: "/icons/surfing.svg", iconNote: related },
  { id: "kajakken", name: "Kajakken", familyId: "peddelen", icon: "/icons/kayaking.svg" },
  { id: "roeien", name: "Roeien", familyId: "peddelen", icon: "/icons/rowing.svg" },
  { id: "openwaterzwemmen", name: "Openwaterzwemmen", familyId: "peddelen", icon: "/icons/pool.svg" },
  { id: "skeeleren", name: "Skeeleren", familyId: "overig", icon: "/icons/roller-skating.svg" },
  { id: "paardrijden", name: "Paardrijden", familyId: "overig", icon: "/icons/horse-human.svg" },
  { id: "schaatsen", name: "Schaatsen", familyId: "overig", icon: "/icons/ice-skating.svg" },
  { id: "outdoorfitness", name: "Outdoorfitness", familyId: "overig", icon: "/icons/fitness-center.svg" },
];

export const periods = ["Komende 48 uur"] as const;

export function sportsInFamily(familyId: string) {
  return sports.filter((sport) => sport.familyId === familyId);
}

export function findSport(id: string) {
  return sports.find((sport) => sport.id === id) ?? sports[0];
}
