# Portada A4 memoria CERA — filosofía "Cartografía Serena"
from PIL import Image, ImageDraw, ImageFont, ImageOps

W, H = 2480, 3508  # A4 300 dpi
M = 210            # margen
FDIR = "/Users/pablomiguelgonzalezprado/.claude/skills/canvas-design/canvas-fonts"
ILL = "/Users/pablomiguelgonzalezprado/AIOS-code/cera/docs/candidatas/pueblo-energetico-A-plaza.png"
OUT = "/Users/pablomiguelgonzalezprado/AIOS-code/cera/docs/memoria/portada-memoria-cera.png"

VERDE_NOCHE = (11, 42, 32)
VERDE = (22, 76, 58)
CREMA = (247, 244, 237)
SOLAR = (247, 198, 64)
AZUL = (23, 105, 170)
TINTA_SUAVE = (71, 86, 78)
LINEA = (221, 216, 204)

def font(name, size):
    return ImageFont.truetype(f"{FDIR}/{name}", size)

brico_b = lambda s: font("BricolageGrotesque-Bold.ttf", s)
brico_r = lambda s: font("BricolageGrotesque-Regular.ttf", s)
mono = lambda s: font("DMMono-Regular.ttf", s)

img = Image.new("RGB", (W, H), CREMA)
d = ImageDraw.Draw(img)

def tracked(draw, xy, text, fnt, fill, tracking):
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=fnt, fill=fill)
        x += draw.textlength(ch, font=fnt) + tracking
    return x - tracking

def text_w(draw, text, fnt, tracking=0):
    return sum(draw.textlength(c, font=fnt) for c in text) + tracking * (len(text) - 1)

# ---------- isotipo "parcela solar" ----------
def isotipo(draw, x, y, s, celda, sol, terreno):
    u = s / 48.0
    draw.arc([x + 25*u, y + 2*u, x + 41*u, y + 18*u], start=270, end=360,
             fill=sol, width=max(2, round(3*u)))
    draw.ellipse([x + (33-4.2)*u, y + (10-4.2)*u, x + (33+4.2)*u, y + (10+4.2)*u], fill=sol)
    for cx, cy in [(7, 15), (19.4, 15), (7, 24.4), (19.4, 24.4)]:
        draw.rounded_rectangle([x + cx*u, y + cy*u, x + (cx+10)*u, y + (cy+7.4)*u],
                               radius=1.6*u, fill=celda)
    for (x1, y1, xc, yc, x2, y2) in [(6, 38.5, 24, 34.9, 42, 38.5), (10, 44, 24, 41.2, 38, 44)]:
        pts = []
        for i in range(25):
            t = i / 24
            bx = (1-t)**2 * x1 + 2*(1-t)*t*xc + t**2 * x2
            by = (1-t)**2 * y1 + 2*(1-t)*t*yc + t**2 * y2
            pts.append((x + bx*u, y + by*u))
        draw.line(pts, fill=terreno, width=max(2, round(2.6*u)), joint="curve")

# ---------- cabecera: marca ----------
y = M
iso_s = 130
isotipo(d, M, y, iso_s, VERDE, SOLAR, SOLAR)
wm_f = brico_b(96)
wm_track = 34
wm_y = y + iso_s/2 - 62
tracked(d, (M + iso_s + 56, wm_y), "CERA", wm_f, VERDE, wm_track)

# nº de plano, esquina derecha (marca de disciplina imaginaria)
ref_f = mono(34)
ref = "PLANO 01 / 01 · E 1:7"
d.text((W - M - d.textlength(ref, font=ref_f), y + iso_s/2 - 17), ref, font=ref_f, fill=TINTA_SUAVE)

# regla fina
y = M + iso_s + 70
d.line([(M, y), (W - M, y)], fill=LINEA, width=3)

# ---------- eyebrow ----------
y += 78
eb_f = brico_b(40)
tracked(d, (M, y), "PREVIABILIDAD ENERGÉTICA RURAL · ASTURIAS", eb_f, (138, 90, 13), 10)

# ---------- título ----------
y += 120
t_f = brico_b(168)
for line in ["Calculadora de", "Energía Rural", "Agrivoltaica"]:
    d.text((M, y), line, font=t_f, fill=VERDE)
    y += 196

# subtítulo
y += 40
s_f = brico_r(62)
d.text((M, y), "Siete datos, un primer número honesto.", font=s_f, fill=TINTA_SUAVE)

# ---------- ilustración con esquinas curvadas ----------
y += 170
ill_w = W - 2 * M
ill = Image.open(ILL).convert("RGB")
ill_h = round(ill.height * ill_w / ill.width)
ill = ill.resize((ill_w, ill_h), Image.LANCZOS)
mask = Image.new("L", (ill_w, ill_h), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, ill_w, ill_h], radius=28, fill=255)
img.paste(ill, (M, y), mask)

# ticks de escala en el margen izquierdo de la ilustración (medición serena)
tick_f = mono(30)
for i, frac in enumerate([0.0, 0.25, 0.5, 0.75, 1.0]):
    ty = y + round(ill_h * frac)
    d.line([(M - 46, ty), (M - 18, ty)], fill=TINTA_SUAVE, width=3)
lab = "COMUNIDAD ENERGÉTICA — LEVANTAMIENTO"
d.text((M, y + ill_h + 26), lab, font=tick_f, fill=TINTA_SUAVE)
lab2 = "TODOS LOS VALORES SON FICTICIOS"
d.text((W - M - d.textlength(lab2, font=tick_f), y + ill_h + 26), lab2, font=tick_f, fill=TINTA_SUAVE)

# ---------- fila de métricas (caso demostrativo) ----------
y = y + ill_h + 130
metricas = [("18,5", "kWp", "POTENCIA FV"),
            ("19.385", "kWh/año", "PRODUCCIÓN"),
            ("2.549", "EUR/año", "AHORRO")]
col_w = (W - 2 * M) / 3
num_f = brico_b(104)
uni_f = brico_r(44)
lab_f = mono(34)
for i, (num, uni, lab) in enumerate(metricas):
    cx = M + i * col_w
    if i > 0:
        d.line([(cx, y + 8), (cx, y + 168)], fill=LINEA, width=3)
    tx = cx + (56 if i > 0 else 0)
    d.text((tx, y), num, font=num_f, fill=VERDE)
    d.text((tx + d.textlength(num, font=num_f) + 18, y + 52), uni, font=uni_f, fill=AZUL)
    d.text((tx, y + 132), lab, font=lab_f, fill=TINTA_SUAVE)

# hipótesis como coordenadas (jazz para quien sabe leer un plano)
y += 240
d.line([(M, y), (W - M, y)], fill=LINEA, width=3)
y += 44
hip_f = mono(33)
hip = "6,5 m²/kWp   ·   1.050 kWh/kWp·año   ·   65 % autoconsumo   ·   1.100 EUR/kWp"
d.text((M, y), hip, font=hip_f, fill=TINTA_SUAVE)

# ---------- banda inferior verde-noche ----------
bh = 380
d.rectangle([0, H - bh, W, H], fill=VERDE_NOCHE)
isotipo(d, M, H - bh + 92, 96, (220, 236, 248), SOLAR, SOLAR)
b_f = brico_r(52)
b2_f = brico_b(52)
by = H - bh + 96
d.text((M + 96 + 48, by), "Memoria de proyecto", font=b2_f, fill=CREMA)
d.text((M + 96 + 48, by + 74), "Becas Fundación Caja Rural de Asturias · 2026", font=b_f,
       fill=(196, 205, 197))
aut_f = mono(36)
aut = "PABLO M. GONZÁLEZ PRADO"
d.text((W - M - d.textlength(aut, font=aut_f), H - bh + 118), aut, font=aut_f, fill=(138, 167, 154))
aut2 = "MUII · EPI GIJÓN"
d.text((W - M - d.textlength(aut2, font=aut_f), H - bh + 172), aut2, font=aut_f, fill=(138, 167, 154))

img.save(OUT)
print("saved", OUT, img.size)
