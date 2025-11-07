# 🚀 GitHub Repository Setup

## ✅ Bereits erledigt

- ✅ Git Repository initialisiert
- ✅ Erster Commit erstellt
- ✅ Branch auf `main` umbenannt

## 📝 Nächste Schritte

### 1. GitHub Repository erstellen

**Option A: Über GitHub Website (Empfohlen)**

1. Gehe zu [github.com](https://github.com) und logge dich ein
2. Klicke auf **"+"** (oben rechts) → **"New repository"**
3. Fülle das Formular aus:
   - **Repository name:** `foodspot-ranking`
   - **Description:** `Personal food spot ranking app with tier system`
   - **Visibility:** Wähle **Private** oder **Public**
   - **⚠️ WICHTIG:** Lass alle Checkboxen **UNGEHACKT**:
     - ❌ Add README file
     - ❌ Add .gitignore
     - ❌ Choose a license
4. Klicke auf **"Create repository"**

**Option B: Über GitHub CLI** (falls installiert)

```bash
gh repo create foodspot-ranking --private --source=. --remote=origin --push
```

### 2. Lokales Repository mit GitHub verbinden

Nachdem du das Repository auf GitHub erstellt hast, führe diese Befehle aus:

```bash
# Remote Repository hinzufügen (ersetze USERNAME mit deinem GitHub-Username)
git remote add origin https://github.com/USERNAME/foodspot-ranking.git

# Oder mit SSH (wenn du SSH-Keys eingerichtet hast):
# git remote add origin git@github.com:USERNAME/foodspot-ranking.git

# Änderungen zu GitHub pushen
git push -u origin main
```

### 3. Repository-URL anzeigen

Falls du die URL später nochmal brauchst:

```bash
# Remote URL anzeigen
git remote -v

# Remote URL ändern (falls nötig)
git remote set-url origin https://github.com/USERNAME/foodspot-ranking.git
```

## 🔐 SSH Setup (Optional, aber empfohlen)

Falls du noch keine SSH-Keys für GitHub hast:

### 1. SSH-Key generieren

```bash
# Erstelle einen neuen SSH-Key (ersetze EMAIL mit deiner GitHub-Email)
ssh-keygen -t ed25519 -C "your_email@example.com"

# Drücke Enter für den Standard-Pfad
# Optional: Gib ein Passwort ein (sicherer)
```

### 2. SSH-Key zu GitHub hinzufügen

```bash
# Zeige deinen öffentlichen Key an
cat ~/.ssh/id_ed25519.pub

# Kopiere den gesamten Output
```

Dann auf GitHub:
1. Gehe zu **Settings** → **SSH and GPG keys**
2. Klicke auf **"New SSH key"**
3. **Title:** z.B. "MacBook Pro"
4. **Key:** Füge den kopierten Key ein
5. Klicke auf **"Add SSH key"**

### 3. Repository mit SSH verbinden

```bash
# Entferne den HTTPS Remote (falls bereits hinzugefügt)
git remote remove origin

# Füge SSH Remote hinzu
git remote add origin git@github.com:USERNAME/foodspot-ranking.git

# Pushe zu GitHub
git push -u origin main
```

## 📋 Nützliche Git-Befehle

### Änderungen pushen

```bash
# Status anzeigen
git status

# Alle Änderungen hinzufügen
git add .

# Commit erstellen
git commit -m "Deine Commit-Nachricht"

# Zu GitHub pushen
git push
```

### Branching

```bash
# Neuen Branch erstellen
git checkout -b feature/neue-funktion

# Zu Branch wechseln
git checkout main

# Branch zu GitHub pushen
git push -u origin feature/neue-funktion
```

### Pull Requests (via GitHub Website)

1. Erstelle einen neuen Branch: `git checkout -b feature/xyz`
2. Mache deine Änderungen und committe
3. Pushe den Branch: `git push -u origin feature/xyz`
4. Gehe zu GitHub → **"Compare & pull request"**
5. Beschreibe deine Änderungen
6. Klicke auf **"Create pull request"**

## 🛡️ Sicherheit

### Wichtige Dateien die NICHT committed werden sollten:

- ✅ `.env` (bereits in .gitignore)
- ✅ `.cursor/mcp.json` (bereits in .gitignore)
- ✅ `node_modules/` (bereits in .gitignore)
- ✅ Private Keys oder Passwörter

### Prüfen was committed wird:

```bash
# Zeige alle Dateien die hinzugefügt werden
git status

# Zeige Unterschiede
git diff

# Zeige was im nächsten Commit ist
git diff --cached
```

## 🎯 Next Steps nach GitHub Setup

1. ✅ Repository auf GitHub erstellen
2. ✅ Lokales Repository verbinden
3. ✅ Ersten Push durchführen
4. 📝 README.md aktualisieren (falls nötig)
5. 🔧 GitHub Actions für CI/CD einrichten (optional)
6. 📦 Releases/Tags erstellen (optional)

## 📚 Weitere Ressourcen

- [GitHub Docs](https://docs.github.com)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)
- [GitHub CLI Docs](https://cli.github.com/manual/)

---

**Fragen?** Schaue in die [GitHub Docs](https://docs.github.com) oder die [Git Dokumentation](https://git-scm.com/doc).

