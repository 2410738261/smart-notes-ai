
# Smart Notes – AI-Assisted Note App

Smart Notes ist eine webbasierte Notiz‑Applikation, die im Rahmen eines Hackathon‑Projekts entwickelt wurde.  
Der Fokus liegt auf **AI‑Assisted Coding mit GitHub Copilot in VS Code** sowie auf der praktischen Integration eines AI‑Features.

Beim Speichern einer Notiz wird automatisch ein kurzer Titel durch ein Large Language Model generiert.

---

## Features

- Login / Logout mit Supabase Auth  
- Erstellen und Anzeigen von Notizen  
- Automatische Titelgenerierung mittels AI  
- Serverseitige AI‑Integration über Supabase Edge Functions  
- Robustes Error‑Handling, Timeouts und Fallback‑Logik  

---

## Tech Stack

- **Frontend:** Vue.js (Vite)
- **Backend:** Supabase (Auth, PostgreSQL, Edge Functions)
- **AI:** OpenRouter (LLM)
- **AI‑Coding‑Assistent:** GitHub Copilot (VS Code)
- **Tests & Debugging:** Browser DevTools, PowerShell

---

## Architektur (Kurzüberblick)

- Vue Frontend ruft Supabase APIs und Edge Functions auf  
- AI‑Requests laufen **serverseitig über eine Edge Function** (kein API‑Key im Frontend)
- OpenRouter wird als LLM‑Gateway verwendet
- Notizen werden in einer PostgreSQL‑Datenbank gespeichert (Row Level Security aktiv)

---

## Setup

### 1. Abhängigkeiten installieren
```bash
npm install
