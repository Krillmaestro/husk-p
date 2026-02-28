# 🏠 Lägenhetsjakten

Personlig tracker för lägenheter vi tittar på. Håll koll på objekt, visningar, pris och intryck.

## Funktioner

- Lägg till lägenheter manuellt med adress, pris, yta, rum, avgift m.m.
- Statusflöde: Intressant → Kontaktad → Visning bokad → Besökt → Budgivning
- Boka visning med datum & tid, skriv intryck efteråt
- Favorit-markering, prissänkt-flagga
- Sortering & filtrering
- Kr/m²-beräkning med färgkodning
- Egna anteckningar per objekt
- SQLite-databas (persistent på Railway via volume mount)

## Deploy till Railway

1. Pusha till GitHub
2. Gå till [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Railway läser `railway.toml` och `Dockerfile` automatiskt
4. Lägg till Volume mount under Settings → Mounts: source `tracker-data`, destination `/app/data`
5. Deploy!

## Lokalt

```bash
npm install
npm run dev
```

Öppna [http://localhost:3000](http://localhost:3000)

## Teknikstack

- Next.js 16 (App Router, standalone output)
- SQLite via better-sqlite3
- Docker + Railway
