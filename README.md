# Guthaben-Schulden-Spiel Pro Edition 🎮

Ein interaktives Lernspiel für positive und negative Zahlen mit Firebase-Backend.

## 🚀 Features

### Kernspiel
- Interaktive Aufgaben mit Guthaben- und Schulden-Tickets
- 6 Schwierigkeitsstufen (Anfänger bis Meister)
- Computer-Gegner mit KI
- Streak-System und Level-Aufstieg
- 14 freischaltbare Errungenschaften

### Admin-System (Benutzername: Higer)
- Vollständiges Admin-Panel
- Benutzer verwalten (bearbeiten, sperren, löschen)
- Punkte, Level und Streak manuell setzen
- Doppelte Passwörter erkennen und Benutzer sperren
- Alle Systembenachrichtigungen einsehen
- Detaillierte Geräte- und Login-Logs
- Nachrichten an einzelne oder alle Benutzer senden

### Soziale Features
- Rangliste mit Echtzeit-Daten
- Freundessystem mit Anfragen
- User-zu-User Chat in Echtzeit

### Neue Module
- **Taschenrechner**: Grundlegend + Wissenschaftlich (sin, cos, tan, log, ln, √, etc.)
- **Mathe-Blitz**: Zeitbasiertes Blitz-Quiz mit Schwierigkeitsstufen
- **Tagesbonus**: Tägliche Belohnung mit Login-Serie
- **Statistik-Dashboard**: Responsive Charts und Heatmap

### Datenschutz & Sicherheit
- Passwörter werden im Klartext gespeichert (für Admin-Vergleich)
- Geräte-/Browser-Daten werden bei Login erfasst:
  - User-Agent, Plattform, Sprache
  - Bildschirmauflösung, Pixeldichte
  - Zeitzone, RAM-Schätzung, CPU-Kerne
  - Verbindungstyp, Akkustatus
  - Berührungspunkte, Do-Not-Track

## 🔧 Firebase-Datenbankstruktur

```
/users/{uid}/
  profile/       — Benutzerprofil
  gameStats/     — Spielstatistiken
  achievements/  — Errungenschaften
  inbox/         — Eingehende Nachrichten
  devices/       — Geräteprotokolle
  log/           — Login-Aktivitätslogs
  sessions/      — Spielsitzungen
  friends/       — Freundesliste

/users_by_username/{username} → uid (Index)
/leaderboard/{uid}            — Ranglisten-Eintrag
/chats/{chatId}/messages/     — Chat-Nachrichten
/friendRequests/{uid}/        — Freundschaftsanfragen
```

## ⚙️ Setup

1. Firebase-Projekt erstellen unter https://firebase.google.com
2. Realtime Database aktivieren
3. Konfiguration in `js/firebase-config.js` eintragen
4. Firebase Security Rules anpassen
5. `index.html` auf einem HTTPS-Server bereitstellen

## 👑 Super-Admin

- **Benutzername**: `Higer`
- **Passwort**: `19105887638`

## 📱 PWA

Die App kann als Progressive Web App installiert werden (Add to Home Screen).

## 🌐 Technologien

- Vanilla JavaScript (ES Modules)
- Firebase Realtime Database v10
- Tailwind CSS (CDN)
- Chart.js 4.x
- Web Audio API
- Service Worker (Offline-Unterstützung)
