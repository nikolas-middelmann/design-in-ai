// knospe_v3.js – Echtzeit-Knospe für nmlab.de/designinai, Fassung 3 (live, geladen von index.html)
// Frühere Fassungen sind offline und liegen in der Git-Geschichte (zuletzt vollständig in Commit 6178ee9):
// knospe.js (Fassung 1, ohne Figur) und knospe_v2.js (Fassung 2, mit v2.html: die Grundfigur aus Szene 1 geht um
// den Sockel, Abschnitt 9; Totale in Abschnitt 6, Auftakt in 10 und 11).
// Neu in Fassung 3: die Figur kommt aus figur/grundfigur_v2.glb, ohne die weißen Flecken an den Knien
// (siehe werkzeug/figur_herausloesen_v2.py). Sonst gleicht diese Fassung der Fassung 2.
// Mit ?figur=0 verhält sich diese Fassung wie Fassung 1.
//
// Die Knospe steht auf einem runden weißen Sockel und leuchtet von unten. Alle acht Blätter lassen sich
// einzeln um die Achse drehen, die Kamera lässt sich frei bewegen. Antippen wählt ein Blatt; der Knopf
// „im raum ansehen“ startet dieselbe AR-Szene wie die Seiten /1/ … /8/ (deren Dateipfade werden von dort gelesen).
// Geometrie: daten.js (aus der Blender-Druckdatei). Darstellung: three.js mit eigenen Shadern.

import * as THREE from './lib/three.module.min.js';
import { EffectComposer } from './lib/addons/postprocessing/EffectComposer.js';
import { RenderPass } from './lib/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from './lib/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from './lib/addons/postprocessing/OutputPass.js';
import { UMRISS_HALB, BLATT, RASTER, PUNKT, FINDER, PUNKTE, PROFIL, AUFBAU, STELLUNG } from './daten.js';

// ====================================================================================================
// 1  Grundlagen
// ====================================================================================================
const GRAD = Math.PI / 180;
const LINIE = 0.45;                                              // Abstand der Drucklinien in mm
const SDF = { B: 512, H: 288, x0: -12.2, y0: -28.8, px: 0.2 };   // Raster für Abstandsbild und Punktbilder
const NUMMERN = [1, 2, 3, 4, 5, 6, 7, 8];
const ebeneVon = n => 8 - n;                                     // Blatt 1 liegt oben (Ebene 7), Blatt 8 unten (Ebene 0)
const PARAM = new URLSearchParams(location.search);
const RUHIG = PARAM.has('still') || matchMedia('(prefers-reduced-motion: reduce)').matches;

const el = id => document.getElementById(id);
const buehne = el('buehne');
const klemme = (x, a, b) => Math.min(b, Math.max(a, x));
const mische = (a, b, t) => a + (b - a) * t;
const weich = t => t * t * (3 - 2 * t);
const norm2 = v => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const umlauf = w => Math.atan2(Math.sin(w), Math.cos(w));        // Winkel auf -pi … pi bringen

// ====================================================================================================
// 2  Blattform: Umriss, Abstandsbild, Punktmuster
// ====================================================================================================
function baueUmriss() {
  const p = UMRISS_HALB.map(([x, y]) => [x, y]).concat(UMRISS_HALB.slice(1, -1).reverse().map(([x, y]) => [x, -y]));
  let fl = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; fl += a[0] * b[1] - b[0] * a[1]; }
  if (fl < 0) p.reverse();                                       // gegen den Uhrzeigersinn
  const n = p.map((b, i) => {
    const a = p[(i + p.length - 1) % p.length], c = p[(i + 1) % p.length];
    return norm2([(b[1] - a[1]) + (c[1] - b[1]), -(b[0] - a[0]) - (c[0] - b[0])]);   // nach außen
  });
  return { p, n };
}

// Abstand jedes Rasterpunkts zum Blattrand in mm (innen positiv, außen negativ), Nabenloch eingerechnet
function berechneAbstand(poly) {
  const { B, H, x0, y0, px } = SDF, f = new Float32Array(B * H), n = poly.length;
  const ax = new Float32Array(n), ay = new Float32Array(n), ex = new Float32Array(n), ey = new Float32Array(n), il = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const a = poly[k], b = poly[(k + 1) % n];
    ax[k] = a[0]; ay[k] = a[1]; ex[k] = b[0] - a[0]; ey[k] = b[1] - a[1]; il[k] = 1 / (ex[k] * ex[k] + ey[k] * ey[k]);
  }
  for (let j = 0; j < H / 2; j++) {                              // das Blatt ist spiegelsymmetrisch: halbe Arbeit
    const y = y0 + (j + 0.5) * px;
    for (let i = 0; i < B; i++) {
      const x = x0 + (i + 0.5) * px;
      let d2 = 1e9, innen = false;
      for (let k = 0; k < n; k++) {
        const qx0 = x - ax[k], qy0 = y - ay[k];
        let t = (qx0 * ex[k] + qy0 * ey[k]) * il[k];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = qx0 - t * ex[k], qy = qy0 - t * ey[k], q = qx * qx + qy * qy;
        if (q < d2) d2 = q;
        if ((ay[k] > y) !== (ay[k] + ey[k] > y) && x < ex[k] * (y - ay[k]) / ey[k] + ax[k]) innen = !innen;
      }
      let d = Math.sqrt(d2);
      if (!innen) d = -d;
      d = Math.max(-6, Math.min(d, Math.hypot(x, y) - BLATT.nabeR));
      f[j * B + i] = d;
      f[(H - 1 - j) * B + i] = d;
    }
  }
  return f;
}

function punkteVon(n) {
  const roh = atob(PUNKTE[n].bits), liste = [];
  for (let i = 0; i < RASTER.NI; i++) {
    for (let j = 0; j < RASTER.NJ; j++) {
      const k = i * RASTER.NJ + j;
      if ((roh.charCodeAt(k >> 3) >> (k & 7)) & 1) liste.push([RASTER.x0 + (i + RASTER.I0) * RASTER.schritt, (j + RASTER.J0) * RASTER.schritt]);
    }
  }
  return liste;
}

// Punktbild einer Ebene (für die weichen Schatten der Punkte auf den Blättern darüber)
function zeichneScheibe(buf, versatz, cx, cy, ra, ri) {
  const { B, H, x0, y0, px } = SDF;
  const i0 = Math.max(0, Math.floor((cx - ra - x0) / px) - 1), i1 = Math.min(B - 1, Math.ceil((cx + ra - x0) / px) + 1);
  const j0 = Math.max(0, Math.floor((cy - ra - y0) / px) - 1), j1 = Math.min(H - 1, Math.ceil((cy + ra - y0) / px) + 1);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const r = Math.hypot(x0 + (i + 0.5) * px - cx, y0 + (j + 0.5) * px - cy);
      let c = klemme(0.5 + (ra - r) / px, 0, 1);
      if (ri > 0) c = Math.min(c, klemme(0.5 + (r - ri) / px, 0, 1));
      const v = Math.round(c * 255), o = versatz + j * B + i;
      if (v > buf[o]) buf[o] = v;
    }
  }
}

// ====================================================================================================
// 3  Geometrie
// ====================================================================================================
function geometrie(pos, idx, nor) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  if (nor) g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); else g.computeVertexNormals();
  return g;
}

// Drehteil aus einem Profil [[Radius, Höhe], …]; scharfe Kanten bleiben scharf
function drehteil(profil, segmente, knick = 0.7) {
  const n = profil.length;
  let fl = 0;
  for (let i = 0; i < n; i++) { const a = profil[i], b = profil[(i + 1) % n]; fl += a[0] * b[1] - b[0] * a[1]; }
  const vz = fl > 0 ? 1 : -1;
  const sn = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = profil[i + 1][0] - profil[i][0], dz = profil[i + 1][1] - profil[i][1], l = Math.hypot(dr, dz);
    sn.push(l < 1e-6 || (profil[i][0] === 0 && profil[i + 1][0] === 0) ? null : [vz * dz / l, -vz * dr / l]);
  }
  const glatt = (a, b) => (b && a[0] * b[0] + a[1] * b[1] > knick) ? norm2([a[0] + b[0], a[1] + b[1]]) : a;
  const pos = [], nor = [], idx = [];
  for (let i = 0; i < n - 1; i++) {
    const s = sn[i];
    if (!s) continue;
    const nA = glatt(s, sn[i - 1]), nB = glatt(s, sn[i + 1]), basis = pos.length / 3;
    for (let j = 0; j <= segmente; j++) {
      const w = j / segmente * Math.PI * 2, c = Math.cos(w), si = Math.sin(w);
      pos.push(profil[i][0] * c, profil[i][0] * si, profil[i][1]); nor.push(nA[0] * c, nA[0] * si, nA[1]);
      pos.push(profil[i + 1][0] * c, profil[i + 1][0] * si, profil[i + 1][1]); nor.push(nB[0] * c, nB[0] * si, nB[1]);
    }
    for (let j = 0; j < segmente; j++) {
      const a = basis + 2 * j, b = a + 1, c = a + 2, d = a + 3;
      if (vz > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
    }
  }
  return geometrie(pos, idx, nor);
}

function vereine(geos) {
  const pos = [], nor = [], idx = [];
  for (const g of geos) {
    const basis = pos.length / 3;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    for (const i of g.index.array) idx.push(i + basis);
  }
  return geometrie(pos, idx, nor);
}

// Blattkörper: gerundete Oberkante, flache Oberseite mit Nabenloch, Fase unten. Die Unterseite fehlt,
// weil die Kamera nie unter die Blätter kommt.
function blattGeometrie(umriss) {
  const { p, n } = umriss, N = p.length, pos = [], idx = [];
  const ring = (d, z) => { const s = pos.length / 3; for (let i = 0; i < N; i++) pos.push(p[i][0] - n[i][0] * d, p[i][1] - n[i][1] * d, z); return s; };
  const band = (a, b, anzahl, aussenUnten) => {
    for (let i = 0; i < anzahl; i++) {
      const j = (i + 1) % anzahl;
      if (aussenUnten) idx.push(a + i, a + j, b + j, a + i, b + j, b + i); else idx.push(a + i, b + j, a + j, a + i, b + i, b + j);
    }
  };
  // gerundete Oberkante
  const R = BLATT.kanteRadius, stufen = [0, 0.07, 0.2, 0.4, 0.65, R];
  const ringe = stufen.map(d => ring(d, BLATT.kanteZ + (BLATT.dicke - BLATT.kanteZ) * Math.sqrt(1 - (1 - d / R) * (1 - d / R))));
  for (let k = 0; k < ringe.length - 1; k++) band(ringe[k], ringe[k + 1], N, true);
  // flache Oberseite mit Loch
  const M = 64, innen = ringe[ringe.length - 1], loch = pos.length / 3;
  for (let i = 0; i < M; i++) { const w = i / M * Math.PI * 2; pos.push(BLATT.nabeR * Math.cos(w), BLATT.nabeR * Math.sin(w), BLATT.dicke); }
  const kontur = [], lochPunkte = [];
  for (let i = 0; i < N; i++) kontur.push(new THREE.Vector2(pos[(innen + i) * 3], pos[(innen + i) * 3 + 1]));
  for (let i = M - 1; i >= 0; i--) lochPunkte.push(new THREE.Vector2(pos[(loch + i) * 3], pos[(loch + i) * 3 + 1]));
  const zuIndex = k => k < N ? innen + k : loch + (M - 1 - (k - N));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(kontur, [lochPunkte])) {
    const A = zuIndex(a), Bi = zuIndex(b), C = zuIndex(c);
    const kreuz = (pos[Bi * 3] - pos[A * 3]) * (pos[C * 3 + 1] - pos[A * 3 + 1]) - (pos[Bi * 3 + 1] - pos[A * 3 + 1]) * (pos[C * 3] - pos[A * 3]);
    if (kreuz > 0) idx.push(A, Bi, C); else idx.push(A, C, Bi);          // Fläche zeigt nach oben
  }
  // Fase unterhalb der Kante
  let vor = ringe[0];
  for (const [d, z] of BLATT.unten) { const r = ring(d, z); band(vor, r, N, false); vor = r; }
  // Wand des Nabenlochs
  const w0 = pos.length / 3;
  for (const [r, z] of [[BLATT.nabeR, BLATT.dicke], [BLATT.nabeR, BLATT.nabeFaseZ], [BLATT.nabeFaseR, 0]]) {
    for (let i = 0; i < M; i++) { const w = i / M * Math.PI * 2; pos.push(r * Math.cos(w), r * Math.sin(w), z); }
  }
  for (let k = 0; k < 2; k++) {
    const a = w0 + k * M, b = a + M;
    for (let i = 0; i < M; i++) { const j = (i + 1) % M; idx.push(a + i, a + j, b + i, a + j, b + j, b + i); }
  }
  return geometrie(pos, idx, null);
}

// ====================================================================================================
// 4  Shader
// ====================================================================================================
const EINHEITEN = {
  uKamera: { value: new THREE.Vector3() },
  uBreit: { value: 1.10 },          // Licht von unten: breiter Anteil
  uKern: { value: 2.40 },           // Licht von unten: heller Kern
  uRaum: { value: 1.0 }             // Raumlicht (Sockel, Glanzlichter)
};

const VS = /* glsl */`
varying vec3 vLokal;
varying vec3 vWelt;
varying vec3 vNormal;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
  #endif
  vLokal = p.xyz;
  vec4 w = modelMatrix * p;
  vWelt = w.xyz;
  vNormal = normalize(mat3(modelMatrix) * n);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const GEMEINSAM = /* glsl */`
precision highp float;
precision highp sampler2DArray;
varying vec3 vLokal;
varying vec3 vWelt;
varying vec3 vNormal;
uniform vec3 uKamera;
uniform float uBreit;
uniform float uKern;
uniform float uRaum;
const float PI = 3.14159265;
const float LINIE = ${LINIE.toFixed(3)};
const vec3 LICHT = vec3(0.38, 0.14, 1.00);                     // Farbe des Lichts von unten
const vec3 ORT_RAUM = vec3(-420.0, 380.0, 420.0);              // weiches Licht von hinten links
const vec3 ORT_FRONT = vec3(-250.0, -600.0, 300.0);            // schwache Aufhellung von vorn
const vec3 ORT_GLANZ = vec3(0.0, -250.0, 700.0);               // kleines Licht für Glanzpunkte
const vec3 FARBE_RAUM = vec3(0.88, 0.92, 1.00);
const vec3 FARBE_FRONT = vec3(1.00, 0.97, 0.93);

// Licht, das von unten ankommt, abhängig vom Abstand zur Achse: breit bis zum Rand, hell in der Mitte
float vonUnten(float r) {
  float a = 3969.0 / (3969.0 + r * r);
  float b = 1444.0 / (1444.0 + r * r);
  return uBreit * a * a + uKern * b * b;
}
float ggx(float nh, float a) {
  float a2 = a * a;
  float d = nh * nh * (a2 - 1.0) + 1.0;
  return a2 / (PI * d * d);
}
float fresnel(vec3 N, vec3 V, float f0) {
  float c = 1.0 - max(dot(N, V), 0.0);
  float c2 = c * c;
  return f0 + (1.0 - f0) * c2 * c2 * c;
}
// Glanzlichter der drei Raumlichter
vec3 glanz(vec3 P, vec3 N, vec3 V, float rau) {
  vec3 s = vec3(0.0);
  vec3 L = normalize(ORT_RAUM - P);
  s += FARBE_RAUM * 0.30 * ggx(max(dot(N, normalize(L + V)), 0.0), max(rau, 0.30)) * max(dot(N, L), 0.0);
  L = normalize(ORT_FRONT - P);
  s += FARBE_FRONT * 0.22 * ggx(max(dot(N, normalize(L + V)), 0.0), max(rau, 0.30)) * max(dot(N, L), 0.0);
  L = normalize(ORT_GLANZ - P);
  s += vec3(0.5) * ggx(max(dot(N, normalize(L + V)), 0.0), max(rau, 0.07)) * max(dot(N, L), 0.0) * 0.06;
  return s * uRaum;
}
// Beleuchtungsstärke der Raumlichter auf matten Flächen
vec3 raumlicht(vec3 P, vec3 N) {
  vec3 L = ORT_RAUM - P;
  vec3 e = FARBE_RAUM * 4.2e5 * max(dot(N, normalize(L)), 0.0) / dot(L, L);
  L = ORT_FRONT - P;
  e += FARBE_FRONT * 3.6e5 * max(dot(N, normalize(L)), 0.0) / dot(L, L);
  return e * uRaum;
}
// Normale durch ein Höhenfeld kippen (Höhe in mm)
vec3 kippe(vec3 P, vec3 N, float h) {
  vec3 dPx = dFdx(P), dPy = dFdy(P);
  vec3 R1 = cross(dPy, N), R2 = cross(N, dPx);
  float det = dot(dPx, R1);
  vec3 grad = sign(det) * (dFdx(h) * R1 + dFdy(h) * R2);
  return normalize(abs(det) * N - grad);
}
// Drucklinien: a = Abstand in mm. raupe = Höhe der Linie, tal = schmale Rille zwischen zwei Linien.
// Sind die Linien feiner als ein Bildpunkt, wird auf den Mittelwert überblendet (kein Flimmern).
void linien(float a, out float raupe, out float tal) {
  float fein = clamp(1.3 - 2.6 * fwidth(a) / LINIE, 0.0, 1.0);
  float tri = 1.0 - abs(2.0 * fract(a / LINIE) - 1.0);
  raupe = mix(0.667, 1.0 - (1.0 - tri) * (1.0 - tri), fein);
  tal = mix(0.143, pow(1.0 - tri, 6.0), fein);
}`;

// ---- Blatt: klares PETG ----
const FS_BLATT = GEMEINSAM + /* glsl */`
uniform sampler2D uAbstand;
uniform sampler2DArray uPunkte;
uniform vec2 uDreh[8];          // cos, sin des Drehwinkels je Ebene (0 = unten)
uniform int uEbene;
uniform float uWahl;
const vec2 BILD_MIN = vec2(${SDF.x0.toFixed(1)}, ${SDF.y0.toFixed(1)});
const vec2 BILD_GR = vec2(${(SDF.B * SDF.px).toFixed(1)}, ${(SDF.H * SDF.px).toFixed(1)});

// Wie viel Licht von unten kommt hier an? Jedes Blatt darunter schluckt etwas, seine Punkte fast alles.
float durchlass(vec2 pw) {
  float T = 1.0;
  for (int j = 0; j < 8; j++) {
    if (j >= uEbene) break;
    vec2 cs = uDreh[j];
    vec2 q = vec2(cs.x * pw.x + cs.y * pw.y, -cs.y * pw.x + cs.x * pw.y);
    if (q.x < -12.0 || q.x > 90.0 || abs(q.y) > 28.6) continue;
    vec2 uv = (q - BILD_MIN) / BILD_GR;
    float unscharf = 0.25 + 0.10 * float(uEbene - j) * 3.6;
    float flaeche = smoothstep(-unscharf, unscharf, texture2D(uAbstand, uv).r);
    float pkt = textureLod(uPunkte, vec3(uv, float(j)), log2(max(unscharf / ${SDF.px.toFixed(1)}, 1.0))).r;
    T *= 1.0 - flaeche * (0.10 + 0.88 * pkt);
  }
  return T;
}

void main() {
  float d = texture2D(uAbstand, (vLokal.xy - BILD_MIN) / BILD_GR).r;
  float raupe, tal;
  linien(d, raupe, tal);
  float oben = smoothstep(0.45, 0.9, vNormal.z);
  float kante = smoothstep(1.15, 0.0, d);                        // gerundete Kante fängt Licht
  vec3 N = kippe(vWelt, normalize(vNormal), raupe * 0.05 * oben);
  vec3 V = normalize(uKamera - vWelt);
  float r = length(vWelt.xy);

  float licht = vonUnten(r) * durchlass(vWelt.xy);
  float streu = 0.05 + 0.40 * tal * oben + 0.85 * kante;
  vec3 farbe = LICHT * vec3(0.88, 0.74, 1.00) * licht * streu * 1.3;

  float q = r / 24.0;                                            // Leuchten zur Nabe hin
  farbe += vec3(0.62, 0.44, 1.00) * (0.06 + tal * oben + 0.5 * kante) / (1.0 + q * q) * 0.34;
  farbe += vec3(0.86, 0.72, 1.00) * uWahl * (0.10 + 0.55 * tal * oben + 0.9 * kante);   // gewähltes Blatt

  float F = fresnel(N, V, 0.05);
  farbe += glanz(vWelt, N, V, 0.12) * (0.07 + F * 2.5);
  farbe += vec3(0.04, 0.02, 0.10) * F;

  float deck = clamp(0.045 + 0.45 * F + 0.22 * kante + 0.06 * tal * oben + 0.10 * uWahl, 0.0, 0.9);
  gl_FragColor = vec4(farbe, deck);
}`;

// ---- lila PETG: Grundplatte, Hülse, Zwischenscheiben ----
const FS_LILA = GEMEINSAM + /* glsl */`
uniform float uEigen;
void main() {
  float r = length(vLokal.xy);
  float raupe, tal;
  linien(r, raupe, tal);
  float oben = smoothstep(0.3, 0.8, vNormal.z);
  vec3 N = kippe(vWelt, normalize(vNormal), raupe * 0.035 * oben);
  vec3 V = normalize(uKamera - vWelt);
  float rw = length(vWelt.xy);

  vec3 ton = mix(vec3(0.62, 0.25, 1.00), vec3(0.88, 0.62, 1.00), tal * 0.6 * oben);
  float rand = 1.0 - oben;                                       // der gerundete Rand leuchtet schwächer
  vec3 farbe = LICHT * ton * vonUnten(rw) * mix(1.0, 0.55, rand);
  farbe += vec3(0.22, 0.06, 0.50) * raumlicht(vWelt, N) / PI * 0.10;
  farbe += vec3(0.62, 0.30, 1.00) * uEigen;

  float F = fresnel(N, V, 0.05);
  farbe += glanz(vWelt, N, V, 0.22) * (0.25 + F * 3.0);
  gl_FragColor = vec4(farbe, 1.0);
}`;

// ---- klare Kappe: Pömpel, Abschlussscheibe ----
const FS_KAPPE = GEMEINSAM + /* glsl */`
void main() {
  float raupe, tal;
  linien(vLokal.z * (LINIE / 0.2), raupe, tal);                  // waagrechte Schichten, 0,2 mm
  vec3 N = kippe(vWelt, normalize(vNormal), raupe * 0.04);
  vec3 V = normalize(uKamera - vWelt);
  float F = fresnel(N, V, 0.05);
  float licht = vonUnten(length(vWelt.xy));
  vec3 farbe = LICHT * vec3(0.90, 0.80, 1.00) * licht * (0.10 + 0.22 * tal);        // trübes Klar: leuchtet mit
  farbe += glanz(vWelt, N, V, 0.16) * (0.6 + F * 4.0);
  farbe += vec3(0.10, 0.07, 0.22) * (0.25 + F);
  gl_FragColor = vec4(farbe, clamp(0.58 + 0.35 * F + 0.10 * tal, 0.0, 0.95));
}`;

// ---- schwarze Punkte ----
const FS_PUNKT = GEMEINSAM + /* glsl */`
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uKamera - vWelt);
  vec3 farbe = vec3(0.012, 0.012, 0.014) * (0.2 + raumlicht(vWelt, N) / PI);
  farbe += glanz(vWelt, N, V, 0.55) * 0.045;
  farbe += LICHT * vonUnten(length(vWelt.xy)) * 0.012 * (1.0 - N.z * N.z);   // Seiten bekommen etwas Licht vom Blatt
  gl_FragColor = vec4(farbe, 1.0);
}`;

// ---- Metall: Mutter, Scheiben, Schraubenende unter dem Pömpel ----
const FS_METALL = GEMEINSAM + /* glsl */`
void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uKamera - vWelt);
  vec3 farbe = vec3(0.72, 0.72, 0.75) * (glanz(vWelt, N, V, 0.30) * 3.0 + 0.03 + 0.05 * max(N.z, 0.0));
  farbe += LICHT * 0.10 * vonUnten(length(vWelt.xy)) * (1.0 - 0.5 * N.z);
  gl_FragColor = vec4(farbe, 1.0);
}`;

// ---- weißer Sockel ----
const FS_SOCKEL = GEMEINSAM + /* glsl */`
void main() {
  vec3 N = normalize(vNormal);
  float r = length(vWelt.xy);
  float oben = smoothstep(0.55, 0.95, N.z);
  vec3 farbe = vec3(0.86) * raumlicht(vWelt, N) / PI;
  float schein = exp(-max(r - 87.5, 0.0) / 9.0);                 // violetter Schein aus der Schattenfuge
  farbe += LICHT * vec3(0.95, 0.80, 1.00) * (uBreit + 0.3 * uKern) * 0.26 * schein * oben;
  farbe *= mix(1.0, smoothstep(79.0, 88.5, r), oben);            // unter der Platte dunkel
  farbe += LICHT * 0.010 * exp(vWelt.z / 26.0) * (1.0 - oben);   // ein Hauch Violett oben an der Wand
  gl_FragColor = vec4(farbe, 1.0);
}`;

function material(fs, extra = {}, optionen = {}) {
  return new THREE.ShaderMaterial(Object.assign({ vertexShader: VS, fragmentShader: fs, uniforms: Object.assign({}, EINHEITEN, extra) }, optionen));
}
const DURCHSICHTIG = { transparent: true, depthWrite: false, premultipliedAlpha: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor };

// ====================================================================================================
// 5  Szene aufbauen
// ====================================================================================================
let renderer, composer, bloom, kamera, szene;
let abstand;                                   // Abstandsbild (auch für die Trefferprüfung)
const blaetter = {};                           // je Nummer: { gruppe, material, winkel, tempo, wahl }
const drehung = Array.from({ length: 8 }, () => new THREE.Vector2(1, 0));

function baueSzene() {
  szene = new THREE.Scene();
  szene.background = new THREE.Color(0x000000);
  kamera = new THREE.PerspectiveCamera(26, 1, 20, figur.an ? 60000 : 9000);
  kamera.up.set(0, 0, 1);

  const umriss = baueUmriss();
  abstand = berechneAbstand(umriss.p);
  const halb = new Uint16Array(abstand.length);
  for (let i = 0; i < abstand.length; i++) halb[i] = THREE.DataUtils.toHalfFloat(abstand[i]);
  const texAbstand = new THREE.DataTexture(halb, SDF.B, SDF.H, THREE.RedFormat, THREE.HalfFloatType);
  texAbstand.minFilter = texAbstand.magFilter = THREE.LinearFilter;
  texAbstand.needsUpdate = true;

  const punkte = {};
  const bild = new Uint8Array(SDF.B * SDF.H * 8);
  for (const n of NUMMERN) {
    punkte[n] = punkteVon(n);
    const versatz = ebeneVon(n) * SDF.B * SDF.H;
    for (const [x, y] of punkte[n]) zeichneScheibe(bild, versatz, x, y, PUNKT.radius, 0);
    for (const [x, y] of FINDER.orte) {
      zeichneScheibe(bild, versatz, x, y, FINDER.ringAussen, FINDER.ringInnen);
      zeichneScheibe(bild, versatz, x, y, FINDER.kern, 0);
    }
  }
  const texPunkte = new THREE.DataArrayTexture(bild, SDF.B, SDF.H, 8);
  texPunkte.format = THREE.RedFormat;
  texPunkte.type = THREE.UnsignedByteType;
  texPunkte.minFilter = THREE.LinearMipmapLinearFilter;
  texPunkte.magFilter = THREE.LinearFilter;
  texPunkte.generateMipmaps = true;
  texPunkte.unpackAlignment = 1;
  texPunkte.needsUpdate = true;

  const mesh = (geo, mat, z, ordnung) => { const m = new THREE.Mesh(geo, mat); m.position.z = z; m.renderOrder = ordnung; szene.add(m); return m; };

  // Sockel, Leuchtenscheibe, Grundplatte, Nabe
  const R = AUFBAU.sockelRadius;
  mesh(drehteil([[0, 0], [R - 1.5, 0], [R - 0.44, -0.44], [R, -1.5], [R, -AUFBAU.sockelHoehe], [0, -AUFBAU.sockelHoehe]], 160), material(FS_SOCKEL), 0, 0);
  const su = AUFBAU.scheibeUnten;
  mesh(drehteil([[0, su.hoehe], [su.radius, su.hoehe], [su.radius, 0], [0, 0]], 96), new THREE.MeshBasicMaterial({ color: 0x020203 }), 0, 1);
  mesh(drehteil(PROFIL.grundplatte, 160), material(FS_LILA, { uEigen: { value: 0 } }), AUFBAU.grundplatteZ, 2);
  const matKern = material(FS_LILA, { uEigen: { value: 1.1 } });
  mesh(drehteil(PROFIL.huelse, 72), matKern, AUFBAU.huelseZ, 3);
  const geoScheibe = drehteil(PROFIL.scheibe, 72);
  for (const z of AUFBAU.scheibenZ) mesh(geoScheibe, matKern, z, 3);

  // Metall unter dem Pömpel
  const me = AUFBAU.metall, matMetall = material(FS_METALL);
  const zyl = (r, h, seiten, z) => { const g = new THREE.CylinderGeometry(r, r, h, seiten); g.rotateX(Math.PI / 2); return mesh(g, matMetall, z + h / 2, 4); };
  zyl(me.scheibenR, me.scheibenHoehe, 40, me.scheibenZ);
  zyl(me.mutterR, me.mutterHoehe, 6, me.mutterZ);
  zyl(me.schraubeR, me.schraubeBis - me.mutterZ, 20, me.mutterZ);

  // Blätter mit Punkten
  const geoBlatt = blattGeometrie(umriss);
  const o = PUNKT.oben, pr = PUNKT.radius;
  const geoPunkt = drehteil([[pr, 1.9], [pr, o - 0.14], [pr - 0.12, o], [0, o]], 12);
  const fa = FINDER.ringAussen, fi = FINDER.ringInnen, fk = FINDER.kern;
  const geoFinder = vereine([
    drehteil([[fi, 1.9], [fi, o - 0.12], [fi + 0.12, o], [fa - 0.12, o], [fa, o - 0.12], [fa, 1.9]], 56),
    drehteil([[fk, 1.9], [fk, o - 0.12], [fk - 0.12, o], [0, o]], 36)
  ]);
  const matPunkt = material(FS_PUNKT);
  const m4 = new THREE.Matrix4();
  for (const n of NUMMERN) {
    const ebene = ebeneVon(n);
    const mat = material(FS_BLATT, { uAbstand: { value: texAbstand }, uPunkte: { value: texPunkte }, uDreh: { value: drehung }, uEbene: { value: ebene }, uWahl: { value: 0 } }, DURCHSICHTIG);
    const gruppe = new THREE.Group();
    gruppe.position.z = AUFBAU.blattZ[n];
    const koerper = new THREE.Mesh(geoBlatt, mat);
    koerper.renderOrder = 10 + ebene;
    gruppe.add(koerper);
    const p = new THREE.InstancedMesh(geoPunkt, matPunkt, punkte[n].length);
    punkte[n].forEach(([x, y], i) => p.setMatrixAt(i, m4.makeTranslation(x, y, 0)));
    const f = new THREE.InstancedMesh(geoFinder, matPunkt, FINDER.orte.length);
    FINDER.orte.forEach(([x, y], i) => f.setMatrixAt(i, m4.makeTranslation(x, y, 0)));
    p.frustumCulled = f.frustumCulled = false;
    p.renderOrder = f.renderOrder = 5;
    gruppe.add(p, f);
    szene.add(gruppe);
    blaetter[n] = { gruppe, material: mat, winkel: STELLUNG.geschlossen[n] * GRAD, tempo: 0, wahl: 0 };
  }

  // klare Teile obenauf
  const matKappe = material(FS_KAPPE, {}, DURCHSICHTIG);
  mesh(drehteil(PROFIL.abschluss, 72), matKappe, AUFBAU.abschlussZ, 30);
  mesh(drehteil(PROFIL.poempel, 72), matKappe, AUFBAU.poempelZ, 31);
}

function setzeWinkel() {
  for (const n of NUMMERN) {
    const b = blaetter[n];
    b.gruppe.rotation.z = b.winkel;
    drehung[ebeneVon(n)].set(Math.cos(b.winkel), Math.sin(b.winkel));
    b.material.uniforms.uWahl.value = b.wahl;
  }
}

// ====================================================================================================
// 6  Kamera
// ====================================================================================================
const blick = { az: -90 * GRAD, hoehe: 50 * GRAD, dist: 1000, tempoAz: 0, tempoHoehe: 0 };
let distHeld = 1000, distNah = 190, distFern = 2600;
let distWeit = 2600, distAuftakt = 2600;      // nur mit Figur: weiteste Einstellung und Beginn des Auftakts
const HOEHE_MIN = 13 * GRAD, HOEHE_MAX = 86 * GRAD;

function berechneHeld() {
  const seite = buehne.clientWidth / Math.max(1, buehne.clientHeight);
  const tanV = Math.tan(kamera.fov * GRAD / 2), tanH = tanV * seite;
  distHeld = Math.max(125 / tanH, 210 / tanV);       // hochkant: Sockel füllt 80 % der Breite; quer: Knospe füllt knapp die halbe Höhe
  distFern = distHeld * 2.3;
  // mit Figur: so weit zurück, dass ihr ganzer Kreis ins Bild passt
  distWeit = figur.an ? Math.max(distFern, Math.min(26000, (figur.radius * 1000 + 600) / tanH)) : distFern;
  // Auftakt: quer der ganze Kreis; hochkant näher, die Figur geht dann durchs Bild
  distAuftakt = Math.max(distFern, Math.min(distWeit * 0.82, 2100 / tanV));
}
function setzeKamera() {
  blick.hoehe = klemme(blick.hoehe, HOEHE_MIN, HOEHE_MAX);
  blick.dist = klemme(blick.dist, distNah, distWeit);
  const nah = 1 - weich(klemme((blick.dist - distNah) / (distHeld - distNah), 0, 1));     // 1 = ganz nah
  const fern = weich(klemme((blick.dist - distHeld) / (distFern - distHeld), 0, 1));       // 1 = ganz fern
  const weit = distWeit > distFern ? weich(klemme((blick.dist - distFern) / (distWeit - distFern), 0, 1)) : 0;   // 1 = Totale mit Figur
  const zielZ = mische(mische(mische(-40, 30, nah), -260, fern), -120, weit);
  const c = Math.cos(blick.hoehe);
  kamera.position.set(blick.dist * c * Math.cos(blick.az), blick.dist * c * Math.sin(blick.az), zielZ + blick.dist * Math.sin(blick.hoehe));
  kamera.lookAt(0, 0, zielZ);
  kamera.updateMatrixWorld();
  EINHEITEN.uKamera.value.copy(kamera.position);
}

// ====================================================================================================
// 7  Bedienung
// ====================================================================================================
const strahl = new THREE.Raycaster();
const zeiger = new Map();
let griff = null;                 // { art: 'blatt' | 'kamera' | 'zoom', … }
let gewaehlt = 0;
let lauf = null;                  // laufende Bewegung zu einer Stellung
let zuletztBewegt = 0;

function strahlBei(x, y) {
  const r = buehne.getBoundingClientRect();
  strahl.setFromCamera(new THREE.Vector2((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1), kamera);
  return strahl.ray;
}
function trifftEbene(ray, z) {
  if (ray.direction.z > -1e-4) return null;
  const t = (z - ray.origin.z) / ray.direction.z;
  return t > 0 ? [ray.origin.x + ray.direction.x * t, ray.origin.y + ray.direction.y * t] : null;
}
function abstandBei(x, y) {
  const fx = (x - SDF.x0) / SDF.px - 0.5, fy = (y - SDF.y0) / SDF.px - 0.5, i = Math.floor(fx), j = Math.floor(fy);
  if (i < 0 || j < 0 || i >= SDF.B - 1 || j >= SDF.H - 1) return -6;
  const u = fx - i, v = fy - j, o = j * SDF.B + i;
  return (abstand[o] * (1 - u) + abstand[o + 1] * u) * (1 - v) + (abstand[o + SDF.B] * (1 - u) + abstand[o + SDF.B + 1] * u) * v;
}
// Was liegt unter dem Finger? 'knauf' (Pömpel), eine Blattnummer oder 0
function treffer(x, y) {
  const ray = strahlBei(x, y);
  const k = trifftEbene(ray, AUFBAU.poempelZ + 6);
  if (k && Math.hypot(k[0], k[1]) < 11) return { art: 'knauf' };
  for (const n of NUMMERN) {                                   // von oben nach unten
    const p = trifftEbene(ray, AUFBAU.blattZ[n] + BLATT.dicke);
    if (!p) continue;
    const w = blaetter[n].winkel, c = Math.cos(w), s = Math.sin(w);
    if (abstandBei(c * p[0] + s * p[1], -s * p[0] + c * p[1]) > -1.2 && Math.hypot(p[0], p[1]) > 6) return { art: 'blatt', n, p };
  }
  return { art: 'leer' };
}

function zeigerRunter(e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  buehne.setPointerCapture(e.pointerId);
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  beruehrt();
  if (zeiger.size === 2) {
    const [a, b] = [...zeiger.values()];
    griff = { art: 'zoom', weite: Math.hypot(a.x - b.x, a.y - b.y), dist: blick.dist };
    return;
  }
  const t = treffer(e.clientX, e.clientY);
  griff = { art: t.art === 'blatt' ? 'blatt' : 'kamera', ziel: t, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), weg: 0, zeit: performance.now() };
  if (t.art === 'blatt') {
    lauf = null;
    griff.n = t.n;
    griff.phi = Math.atan2(t.p[1], t.p[0]);
    blaetter[t.n].tempo = 0;
  }
  blick.tempoAz = blick.tempoHoehe = 0;
}
function zeigerBewegt(e) {
  if (!zeiger.has(e.pointerId) || !griff) return;
  zeiger.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const jetzt = performance.now();
  if (griff.art === 'zoom') {
    if (zeiger.size < 2) return;
    const [a, b] = [...zeiger.values()];
    blick.dist = griff.dist * griff.weite / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y));
    zeichne();
    return;
  }
  const dx = e.clientX - griff.x, dy = e.clientY - griff.y, dt = Math.max(1, jetzt - griff.zeit) / 1000;
  griff.weg = Math.max(griff.weg, Math.hypot(e.clientX - griff.x0, e.clientY - griff.y0));
  griff.x = e.clientX; griff.y = e.clientY; griff.zeit = jetzt;
  if (griff.weg < 6) return;                                     // noch ein Antippen
  if (griff.art === 'blatt') {
    const p = trifftEbene(strahlBei(e.clientX, e.clientY), AUFBAU.blattZ[griff.n] + BLATT.dicke);
    if (p && Math.hypot(p[0], p[1]) > 8) {
      const phi = Math.atan2(p[1], p[0]), d = umlauf(phi - griff.phi), b = blaetter[griff.n];
      griff.phi = phi;
      b.winkel += d;
      b.tempo = mische(b.tempo, d / dt, 0.5);
    }
  } else {
    const k = 0.0052;
    blick.az -= dx * k; blick.hoehe += dy * k;
    blick.tempoAz = mische(blick.tempoAz, -dx * k / dt, 0.5);
    blick.tempoHoehe = mische(blick.tempoHoehe, dy * k / dt, 0.5);
  }
  zeichne();
}
function zeigerHoch(e) {
  if (!zeiger.has(e.pointerId)) return;
  zeiger.delete(e.pointerId);
  const g = griff;
  if (!g) return;
  if (g.art === 'zoom') { griff = null; return; }
  griff = null;
  const kurz = performance.now() - g.t0 < 450 && g.weg < 8;
  if (kurz) {
    blick.tempoAz = blick.tempoHoehe = 0;
    if (g.ziel.art === 'blatt') waehle(gewaehlt === g.ziel.n ? 0 : g.ziel.n);
    else if (g.ziel.art === 'knauf') naechsteStellung();
    else waehle(0);
  } else if (performance.now() - g.zeit > 80) {                 // losgelassen, ohne zu schwingen
    if (g.art === 'blatt') blaetter[g.n].tempo = 0; else blick.tempoAz = blick.tempoHoehe = 0;
  }
  merke();
  zeichne();
}
function rad(e) {
  e.preventDefault();
  beruehrt();
  blick.dist *= Math.exp(e.deltaY * 0.0012);
  zeichne();
}
function taste(e) {
  if (e.key >= '1' && e.key <= '8') { beruehrt(); waehle(+e.key === gewaehlt ? 0 : +e.key); }
  else if (e.key === 'Escape') waehle(0);
  else if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && gewaehlt) {
    beruehrt(); lauf = null;
    blaetter[gewaehlt].winkel += (e.key === 'ArrowLeft' ? 1 : -1) * 6 * GRAD;
    merke();
  } else if (e.key === 'o') { beruehrt(); naechsteStellung(); }
  else return;
  zeichne();
}

// Tippen auf den Pömpel: geschlossen → halb geöffnet → geöffnet → geschlossen
const FOLGE = ['geschlossen', 'halb', 'offen'];
let stellung = 0;
function naechsteStellung() { geheZu(FOLGE[stellung = (stellung + 1) % FOLGE.length], 1500); }
function geheZu(name, dauer) {
  const ziel = STELLUNG[name];
  lauf = { t0: performance.now(), dauer, von: {}, nach: {} };
  for (const n of NUMMERN) {
    const b = blaetter[n];
    b.tempo = 0;
    lauf.von[n] = b.winkel;
    lauf.nach[n] = b.winkel + umlaufNah(ziel[n] * GRAD - b.winkel, name);
  }
  zeichne();
}
// kürzester Weg, außer beim Öffnen und Schließen: dort wie in der Blender-Animation (ohne Umweg über hinten)
function umlaufNah(d, name) {
  const k = umlauf(d);
  return name === 'offen' || name === 'geschlossen' ? (Math.abs(d) <= Math.PI * 1.5 ? d : k) : k;
}

// ====================================================================================================
// 8  Auswahl und AR-Start (gleiche Technik wie ar.js, Pfade aus den Seiten /1/ … /8/)
// ====================================================================================================
const ua = navigator.userAgent;
const istIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const istAndroid = /Android/i.test(ua) && !/Firefox/i.test(ua);
const googleApp = istIOS && /GSA\//.test(ua);
const andereApp = istIOS && /CriOS\/|EdgiOS\/|FxiOS\/|DuckDuckGo\//.test(ua);
const quickLook = istIOS && !googleApp && (andereApp || (() => { const a = document.createElement('a'); return !!(a.relList && a.relList.supports && a.relList.supports('ar')); })());
const KEINE_AR = '#keine-ar';
const szenen = {};
let arLink = null;

async function ladeSzene(n) {
  if (szenen[n]) return szenen[n];
  const seite = new URL('../' + n + '/', location.href);
  const s = { n, titel: 'szene ' + n, usdz: null, glb: null, ton: null, da: false };
  try {
    const html = await (await fetch(seite, { cache: 'no-cache' })).text();
    const doc = new DOMParser().parseFromString(html, 'text/html'), blatt = doc.getElementById('blatt'), h1 = doc.querySelector('h1');
    const pfad = name => { const v = blatt && blatt.getAttribute(name); return v ? new URL(v, seite).href : null; };
    s.usdz = pfad('data-usdz'); s.glb = pfad('data-glb'); s.ton = pfad('data-ton');
    if (h1 && h1.textContent.trim()) s.titel = h1.textContent.trim();
    const datei = quickLook ? s.usdz : istAndroid ? s.glb : null;
    if (datei) s.da = (await fetch(datei, { method: 'HEAD', cache: 'no-store' })).ok;
  } catch (fehler) { /* Seite nicht erreichbar: Szene gilt als nicht vorhanden */ }
  return (szenen[n] = s);
}
function oeffneQuickLook(s) {
  if (!arLink) {
    arLink = document.createElement('a');
    arLink.setAttribute('rel', 'ar');
    arLink.style.display = 'none';
    arLink.appendChild(document.createElement('img'));
    document.body.appendChild(arLink);
  }
  arLink.setAttribute('href', s.usdz + '#allowsContentScaling=0');   // 1:1, kein Skalieren
  arLink.click();
}
function sceneViewerAdresse(s) {
  const parameter = { file: s.glb, mode: 'ar_preferred', resizable: 'false', disable_occlusion: 'true', title: s.titel };
  if (s.ton) parameter.sound = s.ton;
  const abfrage = Object.keys(parameter).map(k => k + '=' + encodeURIComponent(parameter[k])).join('&');
  return 'intent://arvr.google.com/scene-viewer/1.2?' + abfrage +
    '#Intent;scheme=https;package=com.google.android.googlequicksearchbox;action=android.intent.action.VIEW;S.browser_fallback_url=' +
    encodeURIComponent(location.href.split('#')[0] + KEINE_AR) + ';end;';
}

const feld = { wahl: el('wahl'), nummer: el('nummer'), titel: el('titel'), knopf: el('ar-knopf'), hinweis: el('hinweis'), einstieg: el('einstieg') };
function waehle(n) {
  gewaehlt = n;
  feld.wahl.hidden = !n;
  if (n) feld.einstieg.classList.add('weg');
  feld.knopf.hidden = true;
  feld.hinweis.textContent = '';
  if (n) {
    feld.nummer.textContent = '0' + n;
    feld.titel.textContent = 'szene ' + n;
    ladeSzene(n).then(s => {
      if (gewaehlt !== n) return;
      feld.titel.textContent = s.titel;
      if (location.hash === KEINE_AR) feld.hinweis.textContent = 'Dieses Handy kann die AR-Ansicht leider nicht öffnen.';
      else if (quickLook) { if (s.da) feld.knopf.hidden = false; else feld.hinweis.textContent = 'Diese Szene ist noch in Arbeit.'; }
      else if (istIOS) feld.hinweis.textContent = 'Bitte in Safari öffnen.';
      else if (istAndroid) { if (s.da) feld.knopf.hidden = false; else feld.hinweis.textContent = 'Für Android ist diese Szene noch in Arbeit.'; }
      else feld.hinweis.textContent = 'Bitte mit dem Smartphone öffnen.';
    });
  }
  merke();
  zeichne();
}
feld.knopf.addEventListener('click', () => {
  const s = szenen[gewaehlt];
  if (!s || !s.da) return;
  merke();
  if (quickLook) oeffneQuickLook(s); else if (istAndroid) location.href = sceneViewerAdresse(s);
});
window.addEventListener('hashchange', () => { if (location.hash === KEINE_AR && gewaehlt) waehle(gewaehlt); });

// Zustand merken, damit die Knospe nach der AR-Szene so dasteht wie vorher
// (eigener Speicherplatz für Fassung 3, damit der erste Besuch des Entwurfs mit dem Auftakt beginnt)
function merke() {
  try {
    sessionStorage.setItem('designinai-v3', JSON.stringify({ w: NUMMERN.map(n => +blaetter[n].winkel.toFixed(4)), k: [blick.az, blick.hoehe, blick.dist], g: gewaehlt, s: stellung }));
  } catch (fehler) { /* kein Speicher: dann eben nicht */ }
}
function erinnere() {
  try {
    const z = JSON.parse(sessionStorage.getItem('designinai-v3') || 'null');
    if (!z || !Array.isArray(z.w) || z.w.length !== 8) return false;
    NUMMERN.forEach((n, i) => { blaetter[n].winkel = +z.w[i] || 0; });
    [blick.az, blick.hoehe, blick.dist] = z.k;
    stellung = z.s | 0;
    return z;
  } catch (fehler) { return false; }
}

// ====================================================================================================
// 9  Grundfigur: die Figur aus Szene 1 geht lebensgroß um den Sockel (neu in Fassung 2)
// ====================================================================================================
// figur/grundfigur_v2.glb ist aus modell/szene1_v2.glb herausgelöst (werkzeug/figur_herausloesen_v2.py): nur die Figur,
// ohne Spot und ohne Ton, eine Runde von 25,25 s. Den Kreis führt die Seite selbst: Sie liest aus der Datei, wie weit
// die Figur zu jedem Zeitpunkt gegangen ist (sie geht nicht gleichmäßig schnell), und legt diese Strecke auf den
// gewählten Radius. So passen die Schritte zum Boden, auch bei anderem Radius. Zum Ausprobieren: ?radius=1.5 (Meter),
// ?schweben=0.352 (Höhe über dem Boden wie in Szene 1), ?figur=0 (ohne Figur).
const KREIS_SZENE = 2.26;                      // Radius des Kreises in Szene 1 in Metern
const FIGUR_HOCH = 1650;                       // Körperhöhe in mm
const figur = {
  an: PARAM.get('figur') !== '0',
  radius: klemme(+(PARAM.get('radius') || KREIS_SZENE), 0.5, 4), // Meter
  schweben: klemme(+(PARAM.get('schweben') || 0), 0, 1),         // Meter über dem Boden; in Szene 1 sind es 0,352
  startWinkel: 140 * GRAD,                                       // beginnt hinten links und geht hinter dem Sockel vorbei
  mixer: null, kreis: null, netz: null, stoff: null, gang: null, zeit: 0, deck: 0, offen: 0,
  // drei Kugeln übereinander umschließen den Körper: damit wird geprüft, ob die Figur im Bild ist
  kugeln: [280, 830, 1380].map(z => ({ z, kugel: new THREE.Sphere(new THREE.Vector3(), 520) })),
  sicht: new THREE.Frustum(), m4: new THREE.Matrix4()
};

async function ladeFigur() {
  try {
    const { GLTFLoader } = await import('./lib/addons/loaders/GLTFLoader.js');
    const gltf = await new GLTFLoader().loadAsync(new URL('./figur/grundfigur_v2.glb', import.meta.url).href);
    const halter = new THREE.Group();
    halter.rotation.x = Math.PI / 2;                    // in der Datei zeigt Y nach oben, hier Z
    halter.scale.setScalar(1000);                       // Meter → Millimeter
    halter.position.z = -AUFBAU.sockelHoehe;            // der Boden liegt am Fuß des Sockels
    halter.add(gltf.scene);
    gltf.scene.traverse(o => {
      if (!o.isSkinnedMesh) return;
      // Die Figur leuchtet selbst, wie in der AR-Szene: ihr Leuchtbild, durchscheinend, von beiden Seiten sichtbar.
      figur.stoff = new THREE.MeshBasicMaterial({ map: o.material.emissiveMap || o.material.map, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });
      figur.stoff.color.setScalar(0.9);                 // bleibt knapp unter der Schwelle fürs Überstrahlen
      o.material = figur.stoff;
      o.frustumCulled = false;                          // ob sie im Bild ist, prüft bewegeFigur
      o.visible = false;
      figur.netz = o;
    });
    figur.kreis = gltf.scene.getObjectByName('Kreis_Grund');
    if (!figur.netz || !figur.kreis || !gltf.animations.length) throw new Error('Figur unvollständig');
    figur.kreis.children[0].position.x = figur.radius;
    figur.kreis.children[0].position.z = figur.schweben;
    const clip = gltf.animations[0];
    const spur = clip.tracks.find(t => t.name === 'Kreis_Grund.quaternion');
    if (!spur) throw new Error('Kreisbewegung fehlt');
    // die Kreisdrehung aus Szene 1 als Wegstrecke über der Zeit (Meter, wächst im Uhrzeigersinn)
    const strecke = new Float32Array(spur.times.length);
    for (let i = 0, winkel = 0, vor = 0; i < strecke.length; i++) {
      const a = 2 * Math.atan2(spur.values[i * 4 + 2], spur.values[i * 4 + 3]);
      if (i) winkel += umlauf(a - vor);
      vor = a;
      strecke[i] = -winkel * KREIS_SZENE;
    }
    figur.gang = { zeiten: spur.times, strecke, dauer: clip.duration, runde: strecke[strecke.length - 1] };
    clip.tracks = clip.tracks.filter(t => t !== spur);  // den Kreis führt ab hier bewegeFigur
    const mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(clip).play();
    figur.zeit = +(PARAM.get('fzeit') || 0);            // für Standbilder: Zeitpunkt in Sekunden
    mixer.setTime(figur.zeit);
    szene.add(halter);
    figur.mixer = mixer;
    if (anfahrt && anfahrt.wartet) {                    // Totale noch kurz stehen lassen, dann zur Knospe fahren
      anfahrt.wartet = false;
      if (performance.now() < anfahrt.t0) anfahrt.t0 = performance.now() + 2600;
    }
    zeichne();
  } catch (fehler) {
    console.warn('Grundfigur nicht geladen:', fehler);
    figur.an = false;
    if (anfahrt && anfahrt.wartet) { anfahrt.wartet = false; anfahrt.t0 = Math.min(anfahrt.t0, performance.now()); }
  }
}
// zurückgelegte Strecke in Metern zur Zeit t, wie in Szene 1
function wegBei(t) {
  const g = figur.gang, runden = Math.floor(t / g.dauer), u = t - runden * g.dauer;
  let i = 1;
  while (i < g.zeiten.length - 1 && g.zeiten[i] < u) i++;
  const a = g.zeiten[i - 1], b = g.zeiten[i];
  return runden * g.runde + mische(g.strecke[i - 1], g.strecke[i], b > a ? klemme((u - a) / (b - a), 0, 1) : 0);
}
// Figur einen Schritt weiter (dt in Sekunden); liefert, ob sie gerade zu sehen ist
function bewegeFigur(dt) {
  if (!figur.mixer) return false;
  const steht = PARAM.has('still');
  if (steht) dt = 0;
  figur.zeit += dt;
  const w = figur.startWinkel - wegBei(figur.zeit) / figur.radius;   // im Uhrzeigersinn, von oben gesehen
  figur.kreis.rotation.set(0, 0, w);
  const x = figur.radius * 1000 * Math.cos(w), y = figur.radius * 1000 * Math.sin(w), fuss = figur.schweben * 1000 - AUFBAU.sockelHoehe;
  // einblenden; ganz nah an der Kamera löst sie sich auf, statt durch die Linse zu gehen
  figur.deck = steht ? 1 : Math.min(1, figur.deck + dt / 2.5);
  const k = kamera.position, dz = Math.max(0, fuss - k.z, k.z - (fuss + FIGUR_HOCH));
  const nah = weich(klemme((Math.hypot(k.x - x, k.y - y, dz) - 700) / 1100, 0, 1));
  figur.stoff.opacity = figur.deck * nah;
  // steht sie von der Kamera aus vor der Knospe, wird sie nach den Blättern gezeichnet, sonst davor
  figur.netz.renderOrder = x * Math.cos(blick.az) + y * Math.sin(blick.az) > 0 ? 40 : 6;
  figur.sicht.setFromProjectionMatrix(figur.m4.multiplyMatrices(kamera.projectionMatrix, kamera.matrixWorldInverse));
  let zuSehen = false;
  if (figur.stoff.opacity > 0.003) for (const { z, kugel } of figur.kugeln) {
    kugel.center.set(x, y, fuss + z);
    if (figur.sicht.intersectsSphere(kugel)) { zuSehen = true; break; }
  }
  figur.netz.visible = zuSehen;
  // die Glieder nur bewegen, wenn man sie sieht; die Zeit dazwischen wird nachgeholt
  figur.offen += dt;
  if (zuSehen || steht) { figur.mixer.update(figur.offen); figur.offen = 0; }
  return zuSehen;
}

// ====================================================================================================
// 10  Zeichnen
// ====================================================================================================
let anfahrt = null;               // Kamerafahrt zum Einstieg
let wach = 0, bildNr = 0, zeitVor = 0, laeuft = false, langsam = 0, aufloesung = 1, ruht = false;

function beruehrt() {
  zuletztBewegt = performance.now();
  if (anfahrt && anfahrt.auftakt) {
    // Auftakt mit Figur: nicht in der Totale stehen bleiben, sondern zügig zur Knospe fahren
    if (!anfahrt.eilt) anfahrt = { t0: performance.now(), dauer: 1500, dist: blick.dist, hoehe: blick.hoehe, az: blick.az, auftakt: true, eilt: true };
  } else if (anfahrt) anfahrt = null;
  feld.einstieg.classList.add('leise');
}
function zeichne() { wach = performance.now() + 900; if (!laeuft) { laeuft = true; zeitVor = performance.now(); requestAnimationFrame(bild); } }

function bild(jetzt) {
  const dtEcht = Math.min(0.25, (jetzt - zeitVor) / 1000);       // die Figur geht in Echtzeit, auch wenn das Bild stockt
  const dt = Math.min(0.05, dtEcht);
  zeitVor = jetzt;
  let bewegt = false;

  if (anfahrt) {
    const t = klemme((jetzt - anfahrt.t0) / anfahrt.dauer, 0, 1);
    if (anfahrt.auftakt) {
      // lange Fahrt aus der Totale: weich an- und auslaufen, der Abstand schrumpft gleichmäßig im Verhältnis
      const s = anfahrt.eilt ? weich(t) : weich(weich(t));
      blick.dist = anfahrt.dist * Math.pow(distHeld / anfahrt.dist, s);
      blick.hoehe = mische(anfahrt.hoehe, 50 * GRAD, s);
      blick.az = mische(anfahrt.az, -90 * GRAD, s);
    } else {
      const s = 1 - Math.pow(1 - t, 3);
      blick.dist = mische(anfahrt.dist, distHeld, s);
      blick.hoehe = mische(anfahrt.hoehe, 50 * GRAD, s);
      blick.az = mische(anfahrt.az, -90 * GRAD, s);
    }
    if (t >= 1) {
      anfahrt = null;
      blick.tempoAz = blick.tempoHoehe = 0;
      if (griff && griff.art === 'zoom' && zeiger.size === 2) {   // läuft gerade ein Zoom mit zwei Fingern: von hier aus weiter
        const [a, b] = [...zeiger.values()];
        griff.weite = Math.hypot(a.x - b.x, a.y - b.y); griff.dist = blick.dist;
      }
    }
    bewegt = true;
  }
  if (lauf) {
    const t = klemme((jetzt - lauf.t0) / lauf.dauer, 0, 1);
    for (const n of NUMMERN) {
      const tn = klemme(t * 1.35 - (n - 1) * 0.05, 0, 1);         // die oberen Blätter beginnen zuerst
      blaetter[n].winkel = mische(lauf.von[n], lauf.nach[n], weich(weich(tn)));
    }
    if (t >= 1) { lauf = null; merke(); }
    bewegt = true;
  }
  const zieht = griff && griff.art !== 'zoom';
  for (const n of NUMMERN) {
    const b = blaetter[n];
    if (!(zieht && griff.art === 'blatt' && griff.n === n) && Math.abs(b.tempo) > 0.02) {
      b.winkel += b.tempo * dt;
      b.tempo *= Math.exp(-dt * 3.2);                              // Reibung auf der Achse
      bewegt = true;
    }
    const zielWahl = gewaehlt === n ? 1 : 0;
    if (Math.abs(b.wahl - zielWahl) > 0.004) { b.wahl = mische(b.wahl, zielWahl, 1 - Math.exp(-dt * 7)); bewegt = true; } else b.wahl = zielWahl;
  }
  if (!zieht && (Math.abs(blick.tempoAz) > 0.01 || Math.abs(blick.tempoHoehe) > 0.01)) {
    blick.az += blick.tempoAz * dt; blick.hoehe += blick.tempoHoehe * dt;
    const brems = Math.exp(-dt * 4.5);
    blick.tempoAz *= brems; blick.tempoHoehe *= brems;
    bewegt = true;
  }

  setzeWinkel();
  setzeKamera();
  const figurImBild = bewegeFigur(dtEcht);
  if (bewegt || griff) wach = jetzt + 900;
  const ruhe = jetzt >= wach;                                      // nichts tut sich mehr
  // Mit Figur läuft die Uhr immer weiter. Gezeichnet wird dann nur, solange sich etwas tut oder die Figur zu sehen ist.
  if (!ruhe || !ruht || figurImBild || bildNr < 3) {
    composer.render();
    if (++bildNr === 2) pruefeBildfolge();
    // Zu langsam? Dann Auflösung senken, zuletzt das Überstrahlen abschalten.
    if (bildNr > 20 && !PARAM.has('still')) {
      if (dt > 0.040) { if (++langsam > 40) { langsam = 0; drossle(); } } else langsam = Math.max(0, langsam - 1);
    }
  }
  if (ruhe && !ruht) merke();
  ruht = ruhe;
  if (!ruhe || figur.mixer) requestAnimationFrame(bild); else laeuft = false;
}
function drossle() {
  if (aufloesung > 0.62) { aufloesung *= 0.8; passeGroesseAn(); }
  else if (bloom.enabled) bloom.enabled = false;
}

// Bildfolge: Szene (mit Kantenglättung) → Überstrahlen → Farbwiedergabe
function baueBildfolge(glaettung) {
  const ziel = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: glaettung });
  composer = new EffectComposer(renderer, ziel);
  composer.addPass(new RenderPass(szene, kamera));
  bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.34, 0.62, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
}
// Manche Geräte können geglättete Gleitkomma-Bilder nicht: dann ohne Glättung neu aufbauen
function pruefeBildfolge() {
  try {
    const gl = renderer.getContext(), e = renderer.properties.get(composer.renderTarget1);
    const fb = e.__webglMultisampledFramebuffer || e.__webglFramebuffer;
    if (!fb) return;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    const gut = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    renderer.resetState();
    if (!gut) { baueBildfolge(0); passeGroesseAn(); }
  } catch (fehler) { /* Prüfung nicht möglich: weiter wie bisher */ }
}

function passeGroesseAn() {
  const b = buehne.clientWidth, h = buehne.clientHeight;
  if (!b || !h) return;
  const dichte = Math.min(window.devicePixelRatio || 1, 2) * aufloesung;
  renderer.setPixelRatio(dichte);
  renderer.setSize(b, h, false);
  composer.setPixelRatio(dichte);
  composer.setSize(b, h);
  kamera.aspect = b / h;
  kamera.updateProjectionMatrix();
  const vorher = distHeld;
  berechneHeld();
  if (!anfahrt && Math.abs(blick.dist - vorher) < 1) blick.dist = distHeld;
  zeichne();
}

// ====================================================================================================
// 11  Start
// ====================================================================================================
function start() {
  try {
    renderer = new THREE.WebGLRenderer({ canvas: buehne, antialias: false, alpha: false, powerPreference: 'high-performance' });
  } catch (fehler) {
    document.body.classList.add('ohne-3d');
    return;
  }
  renderer.toneMapping = { agx: THREE.AgXToneMapping, aces: THREE.ACESFilmicToneMapping, neutral: THREE.NeutralToneMapping }[PARAM.get('ton')] || THREE.NeutralToneMapping;
  renderer.toneMappingExposure = +(PARAM.get('bel') || 1.0);
  baueSzene();

  baueBildfolge(4);

  berechneHeld();
  blick.dist = distHeld;
  // gemerkter Stand von vorhin; mit Probier-Parametern (radius, schweben) beginnt die Seite frisch, mit Auftakt
  const alt = !PARAM.has('zustand') && !PARAM.has('kamera') && !PARAM.has('radius') && !PARAM.has('schweben') && erinnere();
  if (PARAM.has('zustand') && STELLUNG[PARAM.get('zustand')]) {
    const z = STELLUNG[PARAM.get('zustand')];
    for (const n of NUMMERN) blaetter[n].winkel = z[n] * GRAD;
    stellung = Math.max(0, FOLGE.indexOf(PARAM.get('zustand')));
  }
  if (PARAM.has('kamera')) {
    const k = PARAM.get('kamera').split(',').map(Number);
    blick.az = k[0] * GRAD; blick.hoehe = k[1] * GRAD; if (k[2]) blick.dist = k[2];
  }
  passeGroesseAn();
  if (PARAM.has('kamera') && PARAM.get('kamera').split(',')[2]) blick.dist = +PARAM.get('kamera').split(',')[2];
  if (alt) { feld.einstieg.classList.add('leise'); if (alt.g) waehle(alt.g); }
  else if (!RUHIG && !PARAM.has('kamera')) {
    if (figur.an) {
      // mit Figur: Beginn in der Totale; die Fahrt zur Knospe beginnt, kurz nachdem die Figur geladen ist (spätestens nach 9 s)
      blick.dist = distAuftakt; blick.hoehe = 14 * GRAD; blick.az = -100 * GRAD;
      anfahrt = { t0: performance.now() + 9000, wartet: true, dauer: 7000, dist: blick.dist, hoehe: blick.hoehe, az: blick.az, auftakt: true };
    } else {
      blick.dist = distHeld * 2.1; blick.hoehe = 30 * GRAD; blick.az = -112 * GRAD;
      anfahrt = { t0: performance.now() + 250, dauer: 3400, dist: blick.dist, hoehe: blick.hoehe, az: blick.az };
    }
  }
  if (figur.an) ladeFigur();
  if (PARAM.has('wahl')) waehle(+PARAM.get('wahl'));

  buehne.addEventListener('pointerdown', zeigerRunter);
  buehne.addEventListener('pointermove', zeigerBewegt);
  buehne.addEventListener('pointerup', zeigerHoch);
  buehne.addEventListener('pointercancel', zeigerHoch);
  buehne.addEventListener('wheel', rad, { passive: false });
  buehne.addEventListener('contextmenu', e => e.preventDefault());
  window.addEventListener('keydown', taste);
  window.addEventListener('resize', passeGroesseAn);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) zeichne(); });
  buehne.addEventListener('webglcontextlost', e => e.preventDefault());
  buehne.addEventListener('webglcontextrestored', () => zeichne());

  document.body.classList.add('bereit');
  zeichne();

  // für Tests und zum Ausprobieren in der Konsole
  window.knospe = {
    blaetter, blick, geheZu, waehle, zeichne,
    stellung: name => { for (const n of NUMMERN) blaetter[n].winkel = STELLUNG[name][n] * GRAD; zeichne(); },
    projiziere: (x, y, z) => { const v = new THREE.Vector3(x, y, z).project(kamera); return [(v.x + 1) / 2 * buehne.clientWidth, (1 - v.y) / 2 * buehne.clientHeight]; },
    licht: EINHEITEN, bloom: () => bloom, renderer: () => renderer, gewaehlt: () => gewaehlt, szenen, sceneViewerAdresse, figur
  };
}
start();
