# daten_aus_blender.py – liest die Geometrie für die Web-Knospe aus der Blender-Druckdatei.
# Läuft in Blender 5.1 (Text-Editor oder Blender-MCP) mit geöffneter Datei „design in ai 3d druck.blend“.
# Es wird nur gelesen, nichts verändert. Das Ergebnis steht in der Variablen `result`; daraus ist
# ../daten.js von Hand zusammengestellt (Umriss, Profile, Punktmuster als base64 mit CRC32).
import bpy, bmesh, base64, zlib
import numpy as np
from math import hypot, cos, sin, radians
from collections import defaultdict
from mathutils import Vector
from mathutils.bvhtree import BVHTree

aus = {}

def rdp(p, tol):
    # Ramer-Douglas-Peucker: Punktfolge ausdünnen, Abweichung höchstens tol
    p = np.array(p, dtype=float)
    behalten = np.zeros(len(p), dtype=bool); behalten[0] = behalten[-1] = True
    stapel = [(0, len(p) - 1)]
    while stapel:
        a, b = stapel.pop()
        if b <= a + 1:
            continue
        ab = p[b] - p[a]; l = np.hypot(*ab)
        q = p[a + 1:b] - p[a]
        d = np.hypot(q[:, 0], q[:, 1]) if l < 1e-9 else np.abs(q[:, 0] * ab[1] - q[:, 1] * ab[0]) / l
        k = int(np.argmax(d))
        if d[k] > tol:
            behalten[a + 1 + k] = True
            stapel.append((a, a + 1 + k)); stapel.append((a + 1 + k, b))
    return p[behalten]

def runde(p):
    return [[round(float(x), 2), round(float(y), 2)] for x, y in p]

# ---------- Blattumriss: Rand der nach oben zeigenden Flächen des Blattkörpers (Material 0) ----------
me = bpy.data.meshes["Blatt_1_nmlab_v2"]
bm = bmesh.new(); bm.from_mesh(me); bm.normal_update(); bm.verts.ensure_lookup_table()
oben = set(f.index for f in bm.faces if f.material_index == 0 and f.normal.z > 1e-3)
rand = defaultdict(list)
for e in bm.edges:
    if sum(1 for f in e.link_faces if f.index in oben) == 1:
        a, b = e.verts
        rand[a.index].append(b.index); rand[b.index].append(a.index)
schleifen = []
frei = set(rand.keys())
while frei:
    start = frei.pop(); kette = [start]; vor = None; akt = start
    while True:
        nxt = [n for n in rand[akt] if n != vor]
        nxt = [n for n in nxt if n in frei] or [n for n in nxt if n == start]
        if not nxt or nxt[0] == start:
            break
        vor, akt = akt, nxt[0]; frei.discard(akt); kette.append(akt)
    schleifen.append(np.array([bm.verts[i].co[:] for i in kette]))
schleifen.sort(key=lambda s: -(s[:, 0].max() - s[:, 0].min()))
um = schleifen[0][:, :2]                       # größte Schleife = Umriss (die zweite ist das Nabenloch)
i0 = int(np.argmin(um[:, 0])); um = np.roll(um, -i0, axis=0)
i1 = int(np.argmax(um[:, 0]))
a, b = um[:i1 + 1], np.vstack([um[i1:], um[:1]])
halb = (a if a[:, 1].mean() > 0 else b[::-1]).copy()
halb[0, 1] = 0.0; halb[-1, 1] = 0.0
aus["umriss_halb"] = runde(rdp(halb, 0.012))   # obere Hälfte, von der Nabenseite zur Spitze
bm.free()

# ---------- Punktmuster aller 8 Blätter als Bitmaske auf dem 1,6-mm-Raster ----------
I0, NI, J0, NJ = -37, 65, -17, 35
punkte = {}
for n in range(1, 9):
    m = bpy.data.meshes["Blatt_%d_nmlab_v2" % n]
    b2 = bmesh.new(); b2.from_mesh(m); b2.verts.ensure_lookup_table()
    besucht = set(); klein = []; gross = []
    for f in b2.faces:
        if f.material_index != 1 or f.index in besucht:
            continue
        st = [f]; besucht.add(f.index); vs = set()
        while st:
            g = st.pop()
            vs.update(v.index for v in g.verts)
            for e in g.edges:
                for h in e.link_faces:
                    if h.material_index == 1 and h.index not in besucht:
                        besucht.add(h.index); st.append(h)
        co = np.array([b2.verts[i].co[:] for i in vs])
        c = (co.min(axis=0) + co.max(axis=0)) / 2; rad = (co[:, 0].max() - co[:, 0].min()) / 2
        (klein if rad < 1.0 else gross).append((float(c[0]), float(c[1]), float(rad)))
    b2.free()
    bits = np.zeros(NI * NJ, dtype=np.uint8); neben = 0
    for x, y, _ in klein:
        fi, fj = (x - 47.0) / 1.6, y / 1.6
        i, j = round(fi), round(fj)
        if abs(fi - i) > 0.03 or abs(fj - j) > 0.03 or not (I0 <= i < I0 + NI and J0 <= j < J0 + NJ):
            neben += 1; continue
        bits[(i - I0) * NJ + (j - J0)] = 1
    roh = np.packbits(bits, bitorder="little").tobytes()
    punkte[str(n)] = {"bits": base64.b64encode(roh).decode(), "anzahl": int(bits.sum()), "neben_raster": neben, "crc": zlib.crc32(roh),
                      "finder": sorted((round(x, 2), round(y, 2), round(r, 2)) for x, y, r in gross)}
aus["raster"] = {"I0": I0, "NI": NI, "J0": J0, "NJ": NJ, "x0": 47.0, "schritt": 1.6}
aus["punkte"] = punkte

# ---------- Drehprofile ----------
def baum(name):
    m = bpy.data.meshes[name]
    return BVHTree.FromPolygons([v.co.copy() for v in m.vertices], [tuple(p.vertices) for p in m.polygons])

def aussen(name, z1, dz, winkel=17.0):
    # Außenradius je Höhe: Strahl von außen zur Achse
    t = baum(name); c, s = cos(radians(winkel)), sin(radians(winkel))
    pts = []; z = 0.0
    while z <= z1 + 1e-6:
        h = t.ray_cast(Vector((200.0 * c, 200.0 * s, z)), Vector((-c, -s, 0.0)))
        if h[0] is not None:
            pts.append((float(np.hypot(h[0].x, h[0].y)), z))
        z += dz
    return pts

def oben_unten(name, r1, dr, winkel):
    # Höhe der Ober- und Unterseite je Radius (winkel: Richtung ohne Bohrung)
    t = baum(name); c, s = cos(radians(winkel)), sin(radians(winkel))
    o, u = [], []; r = 0.0
    while r <= r1 + 1e-6:
        h = t.ray_cast(Vector((r * c, r * s, 100.0)), Vector((0.0, 0.0, -1.0)))
        if h[0] is not None:
            o.append((r, float(h[0].z)))
        h = t.ray_cast(Vector((r * c, r * s, -100.0)), Vector((0.0, 0.0, 1.0)))
        if h[0] is not None:
            u.append((r, float(h[0].z)))
        r += dr
    return o, u

o, u = oben_unten("Grundplatte_F2_gross_v2", 87.6, 0.1, 90.0)      # 90 Grad: zwischen den drei Bohrungen
aus["grundplatte_oben_r_z"] = runde(rdp(o, 0.012))
aus["grundplatte_unten_r_z"] = runde(rdp(u, 0.012))
for name, key, z1, dz in (("Huelse_v6", "huelse", 35.0, 0.05), ("Zwischenscheibe_v2_Kiesel", "scheibe", 3.4, 0.02),
                          ("Abschlussscheibe_v3", "abschluss", 2.6, 0.02), ("Poempel_B_v2", "poempel", 11.6, 0.04)):
    aus[key + "_r_z"] = runde(rdp(aussen(name, z1, dz), 0.012))

# ---------- Höhen der Teile in der Web-Knospe (Sockeloberkante = 0) ----------
koll = bpy.data.collections["Web_Knospe_v1 (nicht drucken)"]
aus["teile_z"] = {o.name: round(o.location.z, 2) for o in koll.objects if o.type == "MESH"}

result = aus
