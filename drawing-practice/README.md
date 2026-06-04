# Vježba projekcija (Nacrt / Tlocrt / Bokocrt)

Generator radnih listića za tehničko crtanje. Aplikacija prikaže tijelo u
**izometriji** (sastavljeno od jediničnih kocaka, 1 kocka = 10 × 10 × 10 cm),
a učenik crta tri ortogonalne projekcije u priložene mreže. Klikom na *Pokaži
rješenje* otkrivaju se točne projekcije.

## Pokretanje

Datoteke su čisti HTML/CSS/JS bez build koraka. Zbog ES modula treba ih
poslužiti preko HTTP-a (otvaranje `file://` ne radi zbog CORS-a):

```bash
cd drawing-practice
python3 -m http.server 8000
# pa otvori http://localhost:8000/
```

## Kako radi

- **`src/voxels.js`** — model tijela kao skup jediničnih kocaka (voksela) u
  koordinatama `x` (širina), `y` (dubina), `z` (visina). Provjera povezanosti
  i normalizacija na ishodište.
- **`src/generator.js`** — proceduralno generiranje: popuni se kvadar pa se
  ureže nekoliko kutova. Tri razine težine (lako / srednje / teško) određuju
  dimenzije i broj ureza. RNG je *seedabilan* pa je svaki set reproducibilan
  (dijeljenje preko `?seed=...`).
- **`src/renderer.js`** — sva geometrija:
  - **izometrija** — matematička projekcija, vidljive plohe se crtaju
    straga-prema-naprijed (slikarski algoritam), unutarnje plohe se odbacuju;
  - **NTB** — za svaki pogled se mreža ćelija dobije sažimanjem matrice po
    odgovarajućoj osi. Brid na liniji mreže crta se kao **puna linija**
    (vidljiv) ili **isprekidana** (skriven), ovisno o usporedbi dubinskih
    profila susjednih ćelija.
- **`src/app.js`** — generiranje seta, prikaz kartica, navigacija, ispis.

## Konvencije

- Raspored projekcija je **Mongeova projekcija (1. kvadrant)**: nacrt
  gore-lijevo, tlocrt ispod nacrta, bokocrt desno od nacrta.
- Puna linija = vidljivi brid, isprekidana = skriveni brid.

## Testovi

```bash
node test.mjs
```

Provjeravaju determinizam, valjanost (povezanost, granice 5×5×5), rast
složenosti po razinama te ispravnost pojave skrivenih (isprekidanih) bridova.
