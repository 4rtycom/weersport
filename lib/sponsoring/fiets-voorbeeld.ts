/**
 * One fixed Fietsen · Amsterdam moment for /sponsoring/voorbeeld.
 * Coordinates follow the Figma day curve (06:00–20:00). Nothing here is
 * computed from a forecast, a place lookup, a quota or an ad measurement.
 */
export const fietsVoorbeeld = {
  badge: "Voorbeeld · fictief",
  context: "Fietsen · Amsterdam",
  title: "Jouw WeerSport-moment",
  window: "10:00 – 12:00",
  explanation: "Beste verwachte twee uur voor jouw fietstocht.",
  score: 91,
  factorsTitle: "Dit maakt het moment geschikt",
  factors: [
    { id: "temperature", label: "Temperatuur", value: "16°C", note: "Prettig voor fietsen", icon: "/weather/temperature.svg" },
    { id: "wind", label: "Wind", value: "12 km/u", note: "Rustige omstandigheden", icon: "/weather/wind.svg" },
    { id: "rain", label: "Regenkans", value: "10%", note: "Lage kans op regen", icon: "/weather/rain.svg" },
  ],
  curveTitle: "Sportscore door de dag",
  uvTitle: "UV-index 6 · hoog",
  uvNote: "Demo: maximale UV in dit tijdvak. Bescherm je huid en ogen.",
  alternativesTitle: "Andere geschikte momenten",
  alternatives: [
    { window: "12:00 – 14:00", score: "85/100" },
    { window: "14:00 – 16:00", score: "78/100" },
  ],
  safety: "UV-risico, extreem weer en databron blijven los van de sportscores.",
  sponsor: {
    partner: "Fietswerk Amsterdam",
    href: "https://example.com/fietswerk-amsterdam",
    headline: "Klaar voor je volgende rit?",
    body: "Laat je remmen en banden controleren in onze Amsterdamse werkplaats.",
    image: "/sponsoring/fietswerk-amsterdam.jpg",
    imageAlt: "Fietser op een landweg door de duinen, gezien op de rug.",
  },
} as const;

/** Evenly spaced samples from the Figma curve, viewBox 0 0 1008 148. */
export const fietsCurve = {
  width: 1008,
  height: 148,
  line: "M16 100C85.7143 100 85.7143 76 155.429 76C225.143 76 225.143 30.4 294.857 30.4C364.571 30.4 364.571 40 434.286 40C504 40 504 50.8 573.714 50.8C643.429 50.8 643.429 71.2 713.143 71.2C782.857 71.2 782.857 90.4 852.571 90.4C922.286 90.4 922.286 108.4 992 108.4",
  area: "M16 100C85.7143 100 85.7143 76 155.429 76C225.143 76 225.143 30.4 294.857 30.4C364.571 30.4 364.571 40 434.286 40C504 40 504 50.8 573.714 50.8C643.429 50.8 643.429 71.2 713.143 71.2C782.857 71.2 782.857 90.4 852.571 90.4C922.286 90.4 922.286 108.4 992 108.4V137H16V100Z",
  band: { x: 246.057, y: 2, width: 97.6, height: 144, rx: 9 },
  peak: { x: 294.857, y: 30.4 },
  hours: [
    { time: "06:00", x: 16, y: 100, peak: false },
    { time: "08:00", x: 155.429, y: 76, peak: false },
    { time: "10:00", x: 294.857, y: 30.4, peak: true },
    { time: "12:00", x: 434.286, y: 40, peak: false },
    { time: "14:00", x: 573.714, y: 50.8, peak: false },
    { time: "16:00", x: 713.143, y: 71.2, peak: false },
    { time: "18:00", x: 852.571, y: 90.4, peak: false },
    { time: "20:00", x: 992, y: 108.4, peak: false },
  ],
} as const;
