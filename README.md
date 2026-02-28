# 🏠 Husk-P – Näsby Park Apartment Tracker

Interaktiv bostadsbevakning för lägenheter i Näsby Park, Täby kommun.

## Features
- 25 bevakade bostäder med verifierade Hemnet/Booli-länkar
- SQLite-databas – sparar kontaktstatus och anteckningar mellan sessioner
- Sortering: Kr/m², Pris, Yta, Rum
- Filter: Hiss, ≥75m², Dölj kontaktade
- Expanderbara rader med mäklarnot, länk, anteckningar
- Aktivitetslogg per objekt
- Mörkt tema, responsivt

## Tech Stack
- **Next.js 16** (App Router)
- **better-sqlite3** (persistent SQLite)
- **Railway** (deploy med persistent volume)

## Deploy till Railway
1. Pusha till GitHub
2. Gå till [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Välj `Krillmaestro/husk-p`
4. Railway läser `railway.toml` och `Dockerfile` automatiskt
5. Lägg till Volume mount under Settings → Mounts: source `tracker-data`, destination `/app/data`
6. Deploy! 🚀

## Lokalt
```bash
npm install
npm run dev
```
