// daten.js – Geometrie der Knospe, gelesen aus der Blender-Druckdatei
// („design in ai 3d druck.blend“, Kollektion „Web_Knospe_v1“, Stand 13.11.2026).
// Alle Maße in Millimetern. z = 0 ist die Oberkante des Sockels.

// Obere Hälfte des Blattumrisses (y >= 0), von der Nabenseite zur Spitze. Die Nabe liegt bei (0, 0).
export const UMRISS_HALB = [
  [-11, 0], [-10.98, 0.6], [-10.93, 1.2], [-10.85, 1.79], [-10.74, 2.38], [-10.59, 2.96], [-10.42, 3.53], [-10.21, 4.1],
  [-9.97, 4.65], [-9.7, 5.18], [-9.41, 5.7], [-9.08, 6.21], [-8.73, 6.69], [-8.35, 7.16], [-7.95, 7.6], [-7.3, 8.23],
  [-6.84, 8.61], [-6.36, 8.97], [-3.64, 10.83], [-0.87, 12.62], [1.69, 14.19], [4.02, 15.55], [6.38, 16.85], [8.78, 18.1],
  [11.2, 19.28], [13.66, 20.41], [15.86, 21.35], [18.09, 22.24], [20.34, 23.07], [22.61, 23.85], [24.9, 24.56], [27.21, 25.22],
  [29.53, 25.8], [31.87, 26.33], [34.23, 26.78], [36.6, 27.16], [38.68, 27.44], [41.06, 27.69], [43.46, 27.87], [45.85, 27.97],
  [47.95, 28], [50.05, 27.97], [52.15, 27.86], [54.24, 27.67], [56.02, 27.46], [58.1, 27.14], [59.86, 26.8], [61.91, 26.34],
  [63.65, 25.88], [65.66, 25.27], [67.36, 24.68], [69.04, 24.03], [70.69, 23.32], [72.31, 22.55], [73.9, 21.7], [75.46, 20.8],
  [76.96, 19.82], [78.43, 18.77], [79.6, 17.84], [80.29, 17.26], [80.96, 16.66], [82.03, 15.61], [82.66, 14.96], [83.26, 14.29],
  [84.21, 13.13], [85.1, 11.93], [85.91, 10.67], [86.64, 9.36], [87.04, 8.55], [87.29, 8.01], [87.63, 7.17], [87.84, 6.61],
  [88.21, 5.47], [88.44, 4.6], [88.58, 4.02], [88.79, 2.84], [88.87, 2.24], [88.95, 1.35], [88.99, 0.75], [89, 0]
];

// Blattkörper: Kante und Nabenloch
export const BLATT = {
  dicke: 1.95,            // Höhe der flachen Oberseite
  kanteZ: 0.97,           // Höhe, auf der der Umriss am weitesten außen liegt
  kanteRadius: 1.0,       // Rundung der Oberkante
  unten: [[0.1, 0.56], [0.25, 0.34], [0.6, 0]],   // Fase unten: [Abstand vom Rand, Höhe]
  nabeR: 7.15,
  nabeFaseR: 7.55,
  nabeFaseZ: 0.4
};

// Punkte: Zylinder auf einem 1,6-mm-Raster, x = x0 + i * schritt, y = j * schritt
export const RASTER = { I0: -37, NI: 65, J0: -17, NJ: 35, x0: 47, schritt: 1.6 };
export const PUNKT = { radius: 0.736, oben: 2.85 };
export const FINDER = { orte: [[35.8, -11.2], [35.8, 11.2], [58.2, 11.2]], ringAussen: 5.52, ringInnen: 4.08, kern: 2.32 };

// Punktmuster je Blatt (QR-Code HTTPS://NMLAB.DE/n/ plus Zierpunkte) als Bitmaske, base64.
// Bit (i - I0) * NJ + (j - J0), niedrigstes Bit zuerst. Dazu Anzahl und CRC32 zur Kontrolle.
export const PUNKTE = {
  1: { anzahl: 271, crc: 2181483146, bits: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAAAgAEEAgAAAUAAAACQAAAECJAAAgiCAEABCcFgCwAAQIABMFNIAAANIACAAACAAAEAAAAygAAhgABzAAACAAAASwAAAAAAoAAABUAA0AAAIgQO1rWgFg50AAwLn1EwB4QT4AsOPkNaQyBiCADEQACWTnABBAzApAAdizAARQCAFQINIhAAAAhAEEIAAAIAAMVU8AxIjqAQAImUAABAmGAACSpwAAIGAVAAACEQAAQBIAADAMAAAACBgAAIBQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  2: { anzahl: 285, crc: 2878536193, bits: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAACAAAAAAAMAAACAAAAAAAKAAQGTAIAUFkAAEEIAAAI2QcBAAAHAAA9CEEAAAAAAAAAHwABAGgAABCAA3BAABIAAAJQAAAggAcAwABUAAQAQAEIAIF+zgDoWbUACPy1QkBUCwgBBI5fBCCUDyCB1XIAAExpAUBwoQHAgGufAACQvgQQgEgnAABmXwAIIAAAAIDBODIDMAoKAYAGmAoAQoZBAIBwhAkAADQwAABgAgAAKCEAACAwIAAACTEAAAAAAAAADAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  3: { anzahl: 273, crc: 3947027570, bits: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAEAIEAGACAAGABAABAAADgABAQwIEAARCJACeYowAALAyIIBR2QgBBAAAAAAAEYAAAigABgBAAxAgAAiAAQJAAQQwgAAAAAFUAAEI4AMAENH/kwBqAr0Aito6JBCQRIwCYOD9HYDaCyCAIXAAACIPAwAA4x5AAHikAAIAJwFAAHIWgAGwVAEEAAAAAAC7OmgAGESABAAAoCAAQE8IAiAQAAAASAooAACBEQAAAAoAAACwAAAAEggAABAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  4: { anzahl: 274, crc: 4215191126, bits: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAEQAAABAAIAAAAKAAAAAAAABAEEACgSAQCQAgwEABDIFABAQUEMAEBQEYAYn2IDCAAAMFAAFIAAABAAABiABzAgAAQAgAIgABQkAAZAAQFUAA0KQAMwAMXL1ADwxukEyIgQhFD2I66FpCxVBKC8BQCAEAMAA0JpAwAA0A2AAuA9AAIAFAYgAOoPgAF2mAEEIAAAAABR0BoBEICEEAAoABAAoJCQAIAwAwgAGCQAABAoUAAACAAEAAAAAAAAEAAAAAAQAAAAAQAAAIAAAAAAAAAAAAAAAAAAAAAA' },
  5: { anzahl: 273, crc: 4005961667, bits: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAIAABAAAACAQAQAAEAGACAAAASNQBgJAQAQAAMiEAANBuEgAA5poACAAAAGAAFwAAAigAAhyAAmAgAAiAAADgABgAAAUgAABUAAAIIAE4YIF2jgBKrcUCUBK/FYDUCrwAAo7fAACUDwAg1HIACUZpASgAoQHAAGqfAACIvgQAQEgnAABgXwAAAAAAAABk6OgAgPppAIAgwAEAQEapAACAIAEAiBBBAFAgAAAABBAGAAAICgAAAAAAAIAJAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAA' },
  6: { anzahl: 255, crc: 3298030857, bits: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAAIAFAAEAIAAAAAkAEAAgEEAAgBYkAAAAYAAACFNMJYFAoAwBgZNQCCgAACAAAFAAAAAgAAAjAAgBgADyAAAAwABQggA4AQQBUAAEI4AEQUKnQAECyD/UAFrTXogAaeIQCoCQVASAKCEBANQoAAaiWAhggQgkAAFNQAAAIFAIwQDAZAAHgvAAEMAAAAAAmKjABAFgAAgAy4BAAqJQ1AABgUQAAkMhAAAAgAAAAIiABAAANAAAAAEgAABAAAAAAgAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
  7: { anzahl: 249, crc: 1477147777, bits: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAoAAAQIADAAA0oAQABAAAADQBYQAAiAoEAJ0CgAACGAABIBEcAYA4z+IBBAAAAAAAHEAAAQgAABAAAiBAACAAAADQAAwIAAoAAABUAAICQABgIKnRQECozWQAFkJTIaAaeSwAoCzVAAAKCAAANQoAAKiWAghgQgnAgFBQAAIMFAIAIDAZAADhvAAUAAAAAAD54EAANIsgAIAAQAIAQI8BAGCyQQgAAEAKAAAEJAEABIACABAAEQAAIAAAAABAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAA' },
  8: { anzahl: 262, crc: 1490614561, bits: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAASAAAAAAAgAAAEBAAABAAAAAAABACADEIAABAeAQBALB0BAFtVNAAYVLcABAAAABAAFUAAAlAAABTAAQAgACoAAAKAABwAAA0AAQBUAAEEYAEgAKnZAAOpkKkCkNy1VQAaeCgAoiy1ASAKCAAANAoAAqiWAhBAQglAgFJQAAYIFAIQADAZAADgvAAQAAAAIAAYd8IDiEEsDsBgsAkANIQJAEAAUQQAgAANAIBGBAAABAYAABBQIACABAAAAACAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAA' }
};

// Drehteile: Profile als [Radius, Höhe], Höhe gemessen ab der Unterkante des Teils.
export const PROFIL = {
  // Grundplatte, ohne die drei Bohrungen und ohne Mittelloch
  grundplatte: [
    [0, 15], [10, 15], [13.1, 14.98], [14.2, 14.93], [15.3, 14.85], [16.4, 14.74], [17.5, 14.6], [18.6, 14.43], [19.7, 14.23],
    [21.9, 13.76], [24.1, 13.22], [26.3, 12.62], [31.8, 11.07], [34, 10.5], [35.1, 10.24], [37.3, 9.77], [38.4, 9.57],
    [39.5, 9.4], [40.6, 9.26], [41.7, 9.15], [42.8, 9.07], [43.9, 9.02], [45, 9], [79.1, 9], [79.9, 8.97], [80.8, 8.87],
    [81.5, 8.73], [81.9, 8.63], [82.5, 8.45], [83.1, 8.22], [83.7, 7.95], [84.1, 7.75], [84.6, 7.46], [85, 7.2],
    [85.5, 6.83], [86, 6.42], [86.4, 6.05], [86.7, 5.72], [87, 5.3], [87.1, 5.11], [87.2, 4.91], [87.3, 4.64],
    [87.4, 4.31], [87.5, 3.5], [87.4, 2.69], [87.2, 2.09], [87, 1.7], [86.8, 1.4], [86.4, 0.95], [85.5, 0.05], [85.4, 0], [0, 0]
  ],
  // Fuß der Hülse (der dünne Schaft darüber steckt in den Scheiben)
  huelse: [
    [0, 0], [11.47, 0], [11.64, 0.2], [11.74, 0.35], [11.87, 0.6], [11.94, 0.8], [11.99, 1.05], [12, 1.3], [11.98, 1.55],
    [11.9, 1.95], [11.82, 2.2], [11.73, 2.4], [11.59, 2.65], [11.45, 2.85], [11.12, 3.2], [10.87, 3.4], [10.56, 3.6],
    [10.12, 3.8], [9.8, 3.9], [9.56, 3.95], [0, 4]
  ],
  // Zwischenscheibe „Kiesel“: Teller, darauf ein Bund, auf dem das Blatt sitzt
  scheibe: [
    [0, 0], [10.2, 0], [10.5, 0.3], [10.49, 0.58], [10.47, 0.68], [10.38, 0.82], [10.23, 0.94], [10.13, 0.98], [9.83, 1.02],
    [9.65, 1.08], [8.98, 1.46], [8.67, 1.58], [8.5, 1.6], [7, 1.62], [7, 3.1], [6.72, 3.38], [0, 3.4]
  ],
  abschluss: [
    [0, 0], [10.2, 0], [10.27, 0.04], [10.37, 0.2], [10.41, 0.36], [10.48, 0.74], [10.5, 1.2], [10.49, 2.58], [10.4, 2.6], [0, 2.6]
  ],
  poempel: [
    [0, 0], [10.47, 0.04], [10.37, 1.64], [10.2, 3], [9.95, 4.28], [9.63, 5.4], [9.36, 6.12], [9.08, 6.76], [8.74, 7.4],
    [8.39, 7.96], [8.01, 8.48], [7.57, 9], [7.12, 9.44], [6.65, 9.84], [6.14, 10.2], [5.6, 10.52], [5.02, 10.8],
    [4.4, 11.04], [3.73, 11.24], [2.99, 11.4], [2.45, 11.48], [1.59, 11.56], [0, 11.6]
  ]
};

// Aufbau: Höhe der Unterkante jedes Teils über dem Sockel
export const AUFBAU = {
  sockelRadius: 100,
  sockelHoehe: 800,
  scheibeUnten: { radius: 77.5, hoehe: 3 },     // schwarze Leuchtenscheibe, bildet die Schattenfuge
  grundplatteZ: 3,
  huelseZ: 18,
  scheibenZ: [22, 25.6, 29.2, 32.8, 36.4, 40, 43.6, 47.2],
  abschlussZ: 50.8,
  poempelZ: 53.9,
  // Blatt 1 liegt oben, Blatt 8 unten
  blattZ: { 1: 48.8, 2: 45.2, 3: 41.6, 4: 38, 5: 34.4, 6: 30.8, 7: 27.2, 8: 23.6 },
  metall: { schraubeR: 2.5, schraubeBis: 63, mutterZ: 56.9, mutterHoehe: 4, mutterR: 4.62, scheibenZ: 53.4, scheibenHoehe: 2, scheibenR: 5 }
};

// Drei Stellungen aus der Blender-Animation: Drehwinkel je Blatt in Grad
export const STELLUNG = {
  geschlossen: { 1: -90, 2: -90, 3: -90, 4: -90, 5: -90, 6: -90, 7: -90, 8: -90 },
  halb:        { 1: -7, 2: -46, 3: -59, 4: -84, 5: -109, 6: -117, 7: -148, 8: -164 },
  offen:       { 1: 67.5, 2: 22.5, 3: -22.5, 4: -67.5, 5: -112.5, 6: -157.5, 7: -202.5, 8: -247.5 }
};
