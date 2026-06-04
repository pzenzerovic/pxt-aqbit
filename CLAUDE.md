# CLAUDE.md — Upute za Claude Code sesije

Ova datoteka se učitava automatski u svakoj sesiji. Sadrži kontekst projekta i ovlasti.

## Vlasnik

- GitHub: **pzenzerovic**
- Repozitorij: **pzenzerovic/pxt-aqbit**

## GitHub pristup

Token `GH_TOKEN` pohranjen je u `~/.claude/settings.json` (globalni settings, ne commitati).  
Dostupne operacije (sve osim brisanja):
- GitHub API pozivi: `curl -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/...`
- Repozitorij operacije: branch, PR, Pages, Actions, releases, webhooks
- Za deployment: direktno aktiviraj GitHub Pages, manage brancheve, itd.

### Standardni workflow za deployment

Kad treba deployati web app na GitHub Pages:
1. Kreiraj `gh-pages` granu s app fileovima na korijenu
2. Aktiviraj Pages: `curl -X POST -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/repos/pzenzerovic/pxt-aqbit/pages -d '{"source":{"branch":"gh-pages","path":"/"}}'`
3. Ako već postoji: `curl -X PUT ...` ili provjeri status: `curl https://api.github.com/repos/pzenzerovic/pxt-aqbit/pages`
4. Live URL: **https://pzenzerovic.github.io/pxt-aqbit/**

### Standardni workflow za PR

```bash
# Uvijek razvijaj na feature branchu, nikad direktno na master
git checkout -b feature/naziv
# ... rad ...
git push -u origin feature/naziv
# PR kreiraj kroz GitHub MCP alate ili API
```

## Projekti

### drawing-practice (grana: gh-pages, kod: claude/drawing-practice-generator-mZqCQ)

Generator radnih listića za tehničko crtanje (nacrt/tlocrt/bokocrt).  
Live: **https://pzenzerovic.github.io/pxt-aqbit/**  
Stack: čisti HTML/CSS/JS ESM, bez build koraka.

### pxt-aqbit (master)

MakeCode extension za AQ:bit (micro:bit). TypeScript.

## Vercel

Vercel token još nije konfiguriran. Kad korisnik doda token, pohrani ga kao:
- `VERCEL_TOKEN` u `~/.claude/settings.json`
- Deployment: `npx vercel --token $VERCEL_TOKEN --prod`

## Opće napomene

- Kad deplojaš nešto novo, uvijek provjeri je li Pages aktivan (`curl .../pages`) **prije** nego tražiš od korisnika da nešto klikne
- Koristiti `$GH_TOKEN` iz env-a — ne hardcodirati token u kod
- Za statične web apps: GitHub Pages je default deployment target
