# 🔌 MCP Supabase Setup für Cursor

Diese Anleitung zeigt, wie du MCP (Model Context Protocol) für Supabase in Cursor einrichtest, um direkt mit Supabase zu kommunizieren.

## 📋 Voraussetzungen

1. Cursor IDE installiert
2. Supabase Projekt erstellt
3. Supabase Access Token (Service Role Key)

## 🚀 Setup-Schritte

### 1. Supabase Access Token holen

1. Gehe zu deinem Supabase Dashboard: https://app.supabase.com
2. Wähle dein Projekt aus
3. Gehe zu **Settings** → **API**
4. Kopiere den **`service_role` key** (⚠️ WICHTIG: Dieser Key hat Admin-Rechte!)
   - ODER erstelle ein **Personal Access Token** (empfohlen für MCP)

### 2. MCP Server in Cursor konfigurieren

**Option A: Über Cursor Settings (Empfohlen)**

1. Öffne Cursor Settings (Cmd/Ctrl + ,)
2. Suche nach "MCP" oder "Model Context Protocol"
3. Klicke auf "Add MCP Server"
4. Füge folgende Konfiguration hinzu:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "DEIN_SUPABASE_ACCESS_TOKEN_HIER"
      ],
      "env": {
        "SUPABASE_URL": "https://cvkyvhkwsylmzlrdlbxz.supabase.co",
        "SUPABASE_ANON_KEY": "DEIN_ANON_KEY_HIER"
      }
    }
  }
}
```

**Option B: Über Konfigurationsdatei**

Erstelle eine Datei `.cursor/mcp.json` im Projekt-Root:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server-supabase@latest",
        "--access-token",
        "DEIN_SUPABASE_ACCESS_TOKEN_HIER"
      ],
      "env": {
        "SUPABASE_URL": "https://cvkyvhkwsylmzlrdlbxz.supabase.co",
        "SUPABASE_ANON_KEY": "DEIN_ANON_KEY_HIER"
      }
    }
  }
}
```

### 3. Cursor neu starten

Nach der Konfiguration:
1. Cursor komplett schließen
2. Cursor neu öffnen
3. MCP Server sollte automatisch verbunden sein

## ✅ Verifizierung

Nach dem Setup kannst du in Cursor:
- Direkt Supabase-Datenbanken abfragen
- Tabellen-Struktur prüfen
- Daten direkt einsehen
- SQL-Queries ausführen

## 🔒 Sicherheit

⚠️ **WICHTIG:**
- **NIEMALS** den `service_role` key in Git committen!
- Verwende `.gitignore` für MCP-Konfigurationen
- Erstelle separate Access Tokens für Development/Production
- Beschränke Berechtigungen auf das Minimum

## 📚 Nützliche MCP Commands

Nach dem Setup kannst du in Cursor fragen:
- "Zeige mir alle Tabellen in Supabase"
- "Was ist die Struktur der `lists` Tabelle?"
- "Zeige mir alle Listen von User X"
- "Führe diese SQL-Query aus: ..."

## 🐛 Troubleshooting

### MCP Server verbindet nicht
- Prüfe, ob `npx` installiert ist
- Prüfe, ob der Access Token korrekt ist
- Cursor neu starten

### "Access denied" Fehler
- Prüfe, ob der Access Token noch gültig ist
- Prüfe, ob der Token die richtigen Berechtigungen hat

### Network Errors
- Prüfe, ob Supabase-URL erreichbar ist
- Prüfe Firewall/Proxy-Einstellungen

## 🔗 Ressourcen

- [Supabase MCP Server GitHub](https://github.com/supabase/mcp-server-supabase)
- [Cursor MCP Documentation](https://docs.cursor.com/mcp)
- [Supabase API Documentation](https://supabase.com/docs/reference)





