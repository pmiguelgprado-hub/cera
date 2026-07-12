#!/usr/bin/env python3
"""Genera el SVG del mapa de recurso solar de Asturias + datos JSON.
Cada concejo se pinta con el recurso PVGIS del punto de medida más cercano
(teselación por vecino más próximo). Datos E_y reales de PVGIS v5.2.

Reproducir (una sola vez, en build — nada de esto corre en runtime):
  1) Geometría de concejos (IGN, 78 municipios) a EPSG:4326:
     curl -sL "https://visorasturias.es/arcgis/rest/services/Asturias/\
MunicipiosETRS/MapServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson" \
       -o ast-mun.geojson
  2) Producción por punto (kWh/kWp·año) de PVGIS v5.2 (loss=14, ángulo óptimo):
     re.jrc.ec.europa.eu/api/v5_2/PVcalc?lat=..&lon=..&peakpower=1&loss=14&optimalangles=1
     Valores horneados en PUNTOS[] abajo (fecha de consulta: 2026-07-12).
  3) python3 build_map.py  ->  mapa-asturias.svg + zonas-asturias.json
Salida a copiar: mapa-asturias.svg -> assets/  (datos ya inline en js/app.js)."""
import json, math

GEO = json.load(open('ast-mun.geojson'))

# 8 puntos PVGIS reales (kWh/kWp·año, loss 14%, inclinación óptima).
PUNTOS = [
    # nombre, lat, lon, E_y, angulo_opt, municipio
    ("Occidente costero", 43.47, -7.05, 1112, 36, "Vegadeo"),
    ("Suroccidente (Narcea)", 43.18, -6.55, 1243, 35, "Cangas del Narcea"),
    ("Avilés y bajo Nalón", 43.55, -5.92, 1210, 38, "Avilés"),
    ("Centro (Oviedo)", 43.36, -5.85, 1182, 39, "Oviedo"),
    ("Gijón y Cabo Peñas", 43.54, -5.66, 1201, 37, "Gijón"),
    ("Cuencas del Caudal", 43.25, -5.77, 1125, 35, "Mieres"),
    ("Cuencas del Nalón", 43.30, -5.68, 1143, 37, "Langreo"),
    ("Oriente", 43.42, -4.75, 1115, 38, "Llanes"),
]

LAT0 = 43.4  # paralelo de referencia para escalar la longitud

def proj(lon, lat):
    x = lon * math.cos(math.radians(LAT0))
    y = -lat
    return x, y

def centroid(coords_multi):
    xs, ys, n = 0.0, 0.0, 0
    for poly in coords_multi:
        for ring in poly:
            for lon, lat in ring:
                x, y = proj(lon, lat)
                xs += x; ys += y; n += 1
    return xs / n, ys / n

def geom_polys(geom):
    if geom['type'] == 'Polygon':
        return [geom['coordinates']]
    return geom['coordinates']  # MultiPolygon

# bounds
minx = miny = 1e9; maxx = maxy = -1e9
feats = []
for f in GEO['features']:
    polys = geom_polys(f['geometry'])
    cx, cy = centroid(polys)
    # punto más cercano
    best = min(range(len(PUNTOS)),
              key=lambda i: (proj(PUNTOS[i][2], PUNTOS[i][1])[0]-cx)**2
                          + (proj(PUNTOS[i][2], PUNTOS[i][1])[1]-cy)**2)
    feats.append((f['properties']['Nombre'], polys, best))
    for poly in polys:
        for ring in poly:
            for lon, lat in ring:
                x, y = proj(lon, lat)
                minx=min(minx,x); maxx=max(maxx,x)
                miny=min(miny,y); maxy=max(maxy,y)

W = 1000.0
scale = W / (maxx - minx)
H = (maxy - miny) * scale

def sx(x): return (x - minx) * scale
def sy(y): return (y - miny) * scale

def dp(points, eps):
    """Douglas-Peucker: simplifica una polilínea conservando la silueta."""
    if len(points) < 3:
        return points
    ax, ay = points[0]; bx, by = points[-1]
    dx, dy = bx-ax, by-ay
    seglen = math.hypot(dx, dy) or 1e-9
    dmax, idx = 0.0, 0
    for i in range(1, len(points)-1):
        px, py = points[i]
        # distancia perpendicular a la recta a-b
        d = abs((px-ax)*dy - (py-ay)*dx) / seglen
        if d > dmax:
            dmax, idx = d, i
    if dmax > eps:
        left = dp(points[:idx+1], eps)
        right = dp(points[idx:], eps)
        return left[:-1] + right
    return [points[0], points[-1]]

EPS = 1.6  # px de tolerancia sobre el viewBox de 1000

def dp_ring(pts, eps):
    """DP para un anillo cerrado: lo parte por el vértice más lejano del
    primero (la recta base de un anillo cerrado es degenerada)."""
    if len(pts) < 4:
        return pts
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    ax, ay = pts[0]
    far = max(range(len(pts)), key=lambda i: (pts[i][0]-ax)**2 + (pts[i][1]-ay)**2)
    a = dp(pts[:far+1], eps)
    b = dp(pts[far:] + [pts[0]], eps)
    return a[:-1] + b[:-1]

def path_d(polys):
    d = []
    for poly in polys:
        for ring in poly:
            pts = [(sx(proj(lon,lat)[0]), sy(proj(lon,lat)[1])) for lon,lat in ring]
            pts = dp_ring(pts, EPS)
            if len(pts) < 3:
                continue
            s = [f"{x:.1f},{y:.1f}" for x,y in pts]
            d.append("M" + "L".join(s) + "Z")
    return "".join(d)

# color por E_y (rampa crema→solar→verde según recurso, teñida CERA)
vals = [p[3] for p in PUNTOS]
vmin, vmax = min(vals), max(vals)
def color(ey):
    t = (ey - vmin) / (vmax - vmin)  # 0..1
    # interpola de #F3E9C8 (bajo) a #E3B23C (medio) a #1E7B45 (alto)
    stops = [(0.0,(243,233,200)),(0.5,(227,178,60)),(1.0,(30,123,69))]
    for (t0,c0),(t1,c1) in zip(stops,stops[1:]):
        if t<=t1:
            f=(t-t0)/(t1-t0) if t1>t0 else 0
            r=round(c0[0]+(c1[0]-c0[0])*f)
            g=round(c0[1]+(c1[1]-c0[1])*f)
            b=round(c0[2]+(c1[2]-c0[2])*f)
            return f"#{r:02X}{g:02X}{b:02X}"
    return "#1E7B45"

# construye paths agrupados por zona
zonas_paths = {i: [] for i in range(len(PUNTOS))}
concejos_por_zona = {i: [] for i in range(len(PUNTOS))}
svg_paths = []
for nombre, polys, zi in feats:
    d = path_d(polys)
    concejos_por_zona[zi].append(nombre)
    svg_paths.append(
        f'<path d="{d}" fill="{color(PUNTOS[zi][3])}" data-zona="{zi}" '
        f'stroke="#0B2A20" stroke-width="0.6" stroke-opacity="0.25">'
        f'<title>{nombre} · {PUNTOS[zi][0]}: {PUNTOS[zi][3]} kWh/kWp·año</title></path>')

svg = (f'<svg id="mapa-svg" viewBox="0 0 {W:.0f} {H:.0f}" '
       f'xmlns="http://www.w3.org/2000/svg" role="img" '
       f'aria-label="Mapa de recurso solar fotovoltaico de Asturias por zonas">\n'
       + "\n".join(svg_paths) + "\n</svg>")

open('mapa-asturias.svg','w').write(svg)

# datos por zona
zonas = []
for i,(nombre,lat,lon,ey,ang,muni) in enumerate(PUNTOS):
    zonas.append({
        "id": i, "nombre": nombre, "punto": muni,
        "lat": lat, "lon": lon, "eyKwhKwp": ey, "anguloOptimo": ang,
        "color": color(ey),
        "concejos": sorted(concejos_por_zona[i]),
    })
open('zonas-asturias.json','w').write(json.dumps(zonas, ensure_ascii=False, indent=2))

print(f"SVG {W:.0f}x{H:.0f}, {len(feats)} concejos, {len(PUNTOS)} zonas")
print(f"rango E_y: {vmin}-{vmax} kWh/kWp")
for z in zonas:
    print(f"  {z['nombre']:22} {z['eyKwhKwp']} kWh/kWp  ({len(z['concejos'])} concejos)")
