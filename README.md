# What2Play – Brettspiel-Sammlung

Eine private Web-App zur Verwaltung deiner Brettspielsammlung. Hilft dir, den Überblick zu behalten und schnell das passende Spiel für eine Runde zu finden.

## Features

- **Sammlung**: Übersicht aller Spiele mit Karten-Ansicht, Suche und Filtern
- **Heute spielen**: Empfehlungslogik findet passende Spiele basierend auf Spieleranzahl, verfügbarer Zeit und gewünschter Komplexität
- **Spieldetails**: BGG-Metadaten, eigene Notizen, Tags und Standort im Schrank
- **BGG-Import**: Sammlung direkt von BoardGameGeek importieren
- **Manuelles Anlegen**: Spiele ohne BGG-Account hinzufügen

## Tech-Stack

- **Next.js 16** (App Router, TypeScript)
- **React 19**
- **Tailwind CSS 4**
- **SQLite** (via better-sqlite3) – lokale Datenbank, kein Server nötig

## Setup

### Voraussetzungen

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### BGG API-Token einrichten (optional, aber empfohlen)

Seit Juli 2025 erfordert BoardGameGeek einen API-Token. Ohne Token funktioniert die BGG-Suche und der Import nicht – die restliche App (Sammlung, Filter, Empfehlungen) läuft aber problemlos.

1. Gehe zu [boardgamegeek.com/using_the_xml_api](https://boardgamegeek.com/using_the_xml_api)
2. Melde dich mit deinem BGG-Account an (oder erstelle einen)
3. Registriere deine App und erstelle einen API-Token
4. Kopiere `.env.example` nach `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
5. Trage deinen Token in `.env.local` ein:
   ```
   BGG_API_TOKEN=dein_token_hier
   ```

### Starten

```bash
npm run dev
```

Die App ist dann unter **http://localhost:3000** erreichbar.

Beim ersten Aufruf werden automatisch 12 Beispiel-Brettspiele geladen (Seed-Daten).

### Build für Produktion

```bash
npm run build
npm start
```

## Projektstruktur

```
src/
├── app/                    # Next.js App Router
│   ├── api/
│   │   ├── bgg/            # BGG-Import-Endpunkt
│   │   ├── games/          # CRUD für Spiele
│   │   │   └── [id]/       # Einzelnes Spiel (GET/PATCH/DELETE)
│   │   └── seed/           # Seed-Daten laden
│   ├── add/                # Spiel hinzufügen (manuell + BGG)
│   ├── game/[id]/          # Spieldetailseite
│   │   └── edit/           # Spiel bearbeiten
│   ├── today/              # "Heute spielen" Empfehlungen
│   ├── layout.tsx          # Root Layout mit Navigation
│   ├── page.tsx            # Sammlungs-Übersicht (Startseite)
│   └── globals.css
├── components/
│   ├── FilterBar.tsx       # Such- und Filterleiste
│   ├── GameCard.tsx        # Spielkarte für die Übersicht
│   ├── Navigation.tsx      # Navigation (Desktop + Mobile)
│   └── ScoredGameCard.tsx  # Karte mit Score-Anzeige
├── lib/
│   ├── db.ts               # Datenbank-Schicht (SQLite)
│   └── seed.ts             # 12 Beispiel-Brettspiele
├── services/
│   ├── bgg.ts              # BoardGameGeek API Service
│   └── recommendation.ts   # Empfehlungslogik
└── types/
    └── game.ts             # TypeScript-Typen
```

## Datenmodell

Die SQLite-Datenbank speichert alles in einer `games`-Tabelle mit klarer Trennung:

| Bereich | Felder |
|---|---|
| **BGG-Metadaten** | bgg_id, name, yearpublished, min/max_players, playing_time, average_weight, thumbnail, image, categories, mechanics |
| **Besitzdaten** | owned, shelf_location, last_played, favorite |
| **Persönliche Daten** | notes, tags |

## Empfehlungslogik

Der "Heute spielen"-Modus berechnet einen Score (max. 100 Punkte):

| Kriterium | Max. Punkte | Beschreibung |
|---|---|---|
| Spieleranzahl | 35 | Voll wenn im Bereich, Bonus für Sweet Spot |
| Spieldauer | 30 | Passt in verfügbare Zeit, bevorzugt gute Auslastung |
| Komplexität | 20 | Nähe zum gewünschten Wert |
| Favorit | 5 | Bonus für Lieblingsspiele |
| Lange nicht gespielt | 5 | Bonus wenn >30 Tage |
| Tag-Bonus | 5 | z.B. "Neuling-freundlich" wenn Neulinge dabei |

## Nächste Schritte

1. **BGG Thing-API**: Detaildaten nachladen (Kategorien, Mechaniken, Mindestalter) für importierte Spiele
2. **Spielsitzungen**: Protokoll wann was gespielt wurde, mit Gruppengröße
3. **Bessere Bilder**: BGG-Bilder lokal cachen oder Proxy
4. **Dark Mode**: Unterstützung für dunkles Farbschema
5. **PWA**: Offline-Fähigkeit und "Zum Homescreen hinzufügen"
6. **Erweiterte Tags**: Custom Tags anlegen und verwalten
7. **Export/Backup**: Datenbank-Export als JSON
8. **Multi-Device**: Sync über einen einfachen Server oder Cloud-Speicher
