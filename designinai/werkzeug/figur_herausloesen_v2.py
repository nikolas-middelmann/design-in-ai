# figur_herausloesen_v2.py – löst die Grundfigur aus modell/szene1_v2.glb heraus (Fassung 2).
# Ergebnis: eine leichte GLB-Datei nur mit der Figur (ohne Spot, ohne Ton), Bewegung auf eine Runde gekürzt.
# Die Szenendatei selbst wird nur gelesen.
#   python3 figur_herausloesen_v2.py modell/szene1_v2.glb designinai/figur/grundfigur_v2.glb
#
# Frühere Fassung: figur_herausloesen.py (erzeugt figur/grundfigur.glb, bleibt unverändert).
# Neu in Fassung 2: die weißen Flecken an den Knien verschwinden. In den Hosenbeinen stecken Flächen, die beim
# Bemalen der Figur keine Farbe bekommen haben (innen liegende Abschlüsse der Hosenröhren). Ihre Stellen in der
# Textur sind leer: weiß und fast deckend. Durch die durchscheinende Hose sah man sie als weiße Bänder.
# Hier werden diese leeren Texturstellen durchsichtig gemacht; das Netz und alles Bemalte bleiben, wie sie sind.
import sys, json, struct, io
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

quelle, ziel = sys.argv[1], sys.argv[2]
RUNDEN = 6                       # die Szene enthält sechs gleiche Runden
TEXTUR = 1024                    # Kantenlänge der Textur in der Web-Fassung

roh = open(quelle, 'rb').read()
l0 = struct.unpack('<I', roh[12:16])[0]
g = json.loads(roh[20:20 + l0]); binaer = roh[20 + l0 + 8:]
acc, bv, nodes = g['accessors'], g['bufferViews'], g['nodes']
DT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
CT = {np.dtype(v): k for k, v in DT.items()}
NK = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def lies(i):
    a = acc[i]; v = bv[a['bufferView']]; n = NK[a['type']]; dt = np.dtype(DT[a['componentType']])
    o = v.get('byteOffset', 0) + a.get('byteOffset', 0); st = v.get('byteStride', 0)
    if st and st != n * dt.itemsize:
        d = np.frombuffer(binaer, dtype=np.uint8, count=st * a['count'], offset=o).reshape(a['count'], st)[:, :n * dt.itemsize].copy().view(dt)
    else:
        d = np.frombuffer(binaer, dtype=dt, count=a['count'] * n, offset=o)
    return (d.reshape(a['count'], n) if n > 1 else d).copy()

# ---------- neue Datei aufbauen ----------
neu = {'asset': {'version': '2.0', 'generator': 'figur_herausloesen_v2.py (design in ai)'}, 'accessors': [], 'bufferViews': [], 'buffers': [{}]}
daten = bytearray()

def sicht(b, ziel_art=None):
    while len(daten) % 4: daten.append(0)
    v = {'buffer': 0, 'byteOffset': len(daten), 'byteLength': len(b)}
    if ziel_art: v['target'] = ziel_art
    daten.extend(b); neu['bufferViews'].append(v)
    return len(neu['bufferViews']) - 1

def zugriff(a, typ, normalisiert=False, grenzen=False, ziel_art=None):
    a = np.ascontiguousarray(a)
    e = {'bufferView': sicht(a.tobytes(), ziel_art), 'componentType': CT[a.dtype], 'count': int(a.shape[0]), 'type': typ}
    if normalisiert: e['normalized'] = True
    if grenzen:
        m = a.reshape(a.shape[0], -1)
        e['min'] = [float(x) for x in m.min(axis=0)]; e['max'] = [float(x) for x in m.max(axis=0)]
    neu['accessors'].append(e)
    return len(neu['accessors']) - 1

# ---------- Knoten: alles außer dem Spot ----------
weg = set()
def sammle(i):
    weg.add(i)
    for c in nodes[i].get('children', []): sammle(c)
for i, n in enumerate(nodes):
    if n.get('name') == 'K10_Folger': sammle(i)
karte = {}
for i in range(len(nodes)):
    if i not in weg: karte[i] = len(karte)
neu['nodes'] = []
for i, n in enumerate(nodes):
    if i in weg: continue
    m = {k: v for k, v in n.items() if k not in ('children', 'mesh', 'skin')}
    kinder = [karte[c] for c in n.get('children', []) if c not in weg]
    if kinder: m['children'] = kinder
    if 'mesh' in n: m['mesh'] = 0; m['skin'] = 0
    neu['nodes'].append(m)
sz = g['scenes'][g.get('scene', 0)]
neu['scenes'] = [{'name': 'Grundfigur', 'nodes': [karte[i] for i in sz['nodes'] if i not in weg]}]
neu['scene'] = 0

# ---------- Mesh der Figur ----------
mesh = next(m for m in g['meshes'] if m.get('name') == 'Grund_Figur'); p = mesh['primitives'][0]; at = p['attributes']
pos = lies(at['POSITION']).astype(np.float32)
uv = lies(at['TEXCOORD_0']).astype(np.float64)
gel = lies(at['JOINTS_0']); gew = lies(at['WEIGHTS_0']).astype(np.float64)
idx = lies(p['indices']).astype(np.uint32)
assert gel.max() < 256, gel.max()
attribute = {'POSITION': zugriff(pos, 'VEC3', grenzen=True, ziel_art=34962)}
if uv.min() >= 0.0 and uv.max() <= 1.0:
    attribute['TEXCOORD_0'] = zugriff(np.round(uv * 65535).astype(np.uint16), 'VEC2', normalisiert=True, ziel_art=34962)
else:
    attribute['TEXCOORD_0'] = zugriff(uv.astype(np.float32), 'VEC2', ziel_art=34962)
attribute['JOINTS_0'] = zugriff(gel.astype(np.uint8), 'VEC4', ziel_art=34962)
gew = gew / np.maximum(gew.sum(axis=1, keepdims=True), 1e-9)          # Gewichte als Bytes, Summe genau 255
g8 = np.round(gew * 255).astype(np.int32)
g8[np.arange(len(g8)), np.argmax(g8, axis=1)] += 255 - g8.sum(axis=1)
assert g8.min() >= 0 and g8.max() <= 255 and (g8.sum(axis=1) == 255).all()
attribute['WEIGHTS_0'] = zugriff(g8.astype(np.uint8), 'VEC4', normalisiert=True, ziel_art=34962)
neu['meshes'] = [{'name': 'Grund_Figur', 'primitives': [{'attributes': attribute, 'indices': zugriff(idx, 'SCALAR', ziel_art=34963), 'material': 0, 'mode': 4}]}]

# ---------- Skin ----------
skin = g['skins'][0]
neu['skins'] = [{'joints': [karte[j] for j in skin['joints']], 'inverseBindMatrices': zugriff(lies(skin['inverseBindMatrices']).astype(np.float32), 'MAT4')}]
if 'skeleton' in skin: neu['skins'][0]['skeleton'] = karte[skin['skeleton']]

# ---------- Bewegung: eine Runde ----------
an = g['animations'][0]
ende = max(float(lies(s['input']).max()) for s in an['samplers'])
T = round(ende * 60 / RUNDEN) / 60 if abs(round((ende * 60 + 1) / RUNDEN) - (ende * 60 + 1) / RUNDEN) < 0.01 else (ende / RUNDEN)
T = round((ende * 60 + 1) / RUNDEN) / 60                                    # 9090 Bilder / 6 = 1515 Bilder = 25,25 s
kanaele, proben, groesste = [], [], 0.0
for c in an['channels']:
    if c['target']['node'] in weg: continue
    s = an['samplers'][c['sampler']]
    t = lies(s['input']).astype(np.float64); w = lies(s['output'])
    behalte = t < T - 1e-6
    i = int(behalte.sum())                                                  # erster Schlüssel ab T
    f = (T - t[i - 1]) / (t[i] - t[i - 1])
    soll = w[i - 1].astype(np.float64) * (1 - f) + w[i].astype(np.float64) * f   # wahrer Wert am Rundenende
    start = w[0].astype(np.float64)
    if c['target']['path'] == 'rotation' and np.dot(soll, start) < 0: start = -start   # gleiche Drehung, anderes Vorzeichen
    groesste = max(groesste, float(np.abs(soll - start).max()) / (32767.0 if w.dtype == np.int16 else 1.0))
    t2 = np.concatenate([t[:i], [T]]).astype(np.float32)
    w2 = np.concatenate([w[:i], start[None, :].round().astype(w.dtype) if w.dtype != np.float32 else start[None, :].astype(np.float32)])
    proben.append({'input': zugriff(t2, 'SCALAR', grenzen=True), 'interpolation': s.get('interpolation', 'LINEAR'),
                   'output': zugriff(w2, acc[s['output']]['type'], normalisiert=bool(acc[s['output']].get('normalized')))})
    kanaele.append({'sampler': len(proben) - 1, 'target': {'node': karte[c['target']['node']], 'path': c['target']['path']}})
neu['animations'] = [{'name': 'Runde', 'channels': kanaele, 'samplers': proben}]

# ---------- Textur: Leuchtfarbe + Deckkraft in einem Bild ----------
mat = next(m for m in g['materials'] if m.get('name', '').startswith('Figur'))
def bild(texturindex):
    im = g['images'][g['textures'][texturindex]['source']]; v = bv[im['bufferView']]
    return Image.open(io.BytesIO(binaer[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]))
farbe = bild(mat['emissiveTexture']['index']).convert('RGB')
deck = bild(mat['pbrMetallicRoughness']['baseColorTexture']['index']).getchannel('A')
assert farbe.size == deck.size
S = farbe.size[0]

# ---------- leere Texturstellen unter den Beinen durchsichtig machen ----------
# "Leer" heißt: Die Deckkraft hat genau den Wert des unbemalten Hintergrunds (das ist der häufigste Wert im Bild),
# und zwar in einer zusammenhängenden Fläche, nicht nur in einem einzelnen Bildpunkt.
A = np.asarray(deck).astype(np.int32)
leerwert = int(np.bincount(A.ravel()).argmax())
gleich = A == leerwert
def maske(m): return Image.fromarray((m * 255).astype(np.uint8))
def weite(m, px): return np.asarray(maske(m).filter(ImageFilter.MaxFilter(2 * px + 1))) > 0
def enge(m, px): return np.asarray(maske(m).filter(ImageFilter.MinFilter(2 * px + 1))) > 0
leer = weite(enge(gleich, 2), 3) & gleich
# Beinbereich in der Grundhaltung (Arme seitlich ausgestreckt): Hose und Mantelsaum, ohne Hände, Kopf und Schuhe
mitte = pos[idx.reshape(-1, 3)].mean(axis=1)
bein = (mitte[:, 2] > 0.12) & (mitte[:, 2] < 0.75) & (np.abs(mitte[:, 0]) < 0.35)
def abdruck(dreiecke):
    b = Image.new('L', (S, S), 0); z = ImageDraw.Draw(b)
    for t in dreiecke: z.polygon([(float(uv[i, 0]) * S, float(uv[i, 1]) * S) for i in t], fill=255, outline=255)
    return np.asarray(b) > 0
ab_bein, ab_rest = abdruck(idx.reshape(-1, 3)[bein]), abdruck(idx.reshape(-1, 3)[~bein])
# durchsichtig wird: leere Fläche unter Beindreiecken, dazu ein schmaler Rand im leeren Umfeld (sonst bliebe eine helle Kante);
# was Hände, Kopf oder Schuhe benutzen, bleibt unberührt
weg_tex = weite(leer & ab_bein, 7) & leer & ~weite(ab_rest, 2)
# Farbe der durchsichtigen Stellen: die der bemalten Nachbarschaft. Unsichtbar ist sie ohnehin; sie verhindert aber, dass
# beim Verkleinern der Textur (auch in der Grafikkarte) Weiß in die bemalten Ränder daneben einfließt.
F = np.asarray(farbe).astype(np.float64)
bemalt = (~gleich).astype(np.float64)
def weich(a, r): return np.asarray(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))).astype(np.float64)
nenner = weich(bemalt * 255, 6) / 255
nachbar = np.dstack([weich(F[:, :, k] * bemalt, 6) for k in range(3)]) / np.maximum(nenner, 1e-3)[:, :, None]
mittel = (F * bemalt[:, :, None]).sum(axis=(0, 1)) / bemalt.sum()
nachbar = np.where(nenner[:, :, None] > 0.02, nachbar, mittel[None, None, :])
F[weg_tex] = nachbar[weg_tex]
A2 = A.copy(); A2[weg_tex] = 0
print('leere Texturfläche unter den Beinen: %d Bildpunkte, durchsichtig gemacht (mit Rand): %d von %d' % (int((leer & ab_bein).sum()), int(weg_tex.sum()), S * S))
farbe = Image.fromarray(np.clip(np.round(F), 0, 255).astype(np.uint8), 'RGB').resize((TEXTUR, TEXTUR), Image.LANCZOS)
deck = Image.fromarray(A2.astype(np.uint8), 'L').resize((TEXTUR, TEXTUR), Image.LANCZOS)
rgba = Image.merge('RGBA', (*farbe.split(), deck))
puffer = io.BytesIO(); rgba.save(puffer, 'WEBP', quality=84, method=6, exact=True)
neu['images'] = [{'name': 'Figur_Struktur', 'mimeType': 'image/webp', 'bufferView': sicht(puffer.getvalue())}]
neu['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
neu['textures'] = [{'sampler': 0, 'extensions': {'EXT_texture_webp': {'source': 0}}}]
neu['extensionsUsed'] = ['EXT_texture_webp']; neu['extensionsRequired'] = ['EXT_texture_webp']
neu['materials'] = [{'name': mat['name'], 'alphaMode': 'BLEND', 'doubleSided': True, 'emissiveFactor': mat.get('emissiveFactor', [1, 1, 1]), 'emissiveTexture': {'index': 0},
                     'pbrMetallicRoughness': {'baseColorFactor': [0, 0, 0, 1], 'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': 1}}]

# ---------- schreiben ----------
while len(daten) % 4: daten.append(0)
neu['buffers'][0]['byteLength'] = len(daten)
j = json.dumps(neu, separators=(',', ':')).encode()
j += b' ' * (-len(j) % 4)
with open(ziel, 'wb') as f:
    f.write(struct.pack('<4sII', b'glTF', 2, 12 + 8 + len(j) + 8 + len(daten)))
    f.write(struct.pack('<I4s', len(j), b'JSON')); f.write(j)
    f.write(struct.pack('<I4s', len(daten), b'BIN\x00')); f.write(daten)
print('Runde: %.4f s | Kanäle %d | größter Sprung am Rundenende %.5f' % (T, len(kanaele), groesste))
print('Punkte %d | Dreiecke %d | Gelenke %d | Textur %d Bytes | Datei %d Bytes' % (len(pos), len(idx) // 3, len(skin['joints']), len(puffer.getvalue()), 20 + len(j) + 8 + len(daten)))
