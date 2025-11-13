#!/bin/bash

# Script zum Starten von Vite und Öffnen von 3 iOS Simulatoren
# Verwendung: ./scripts/dev-with-ios.sh

echo "🚀 Starte Vite Dev Server und iOS Simulatoren..."
echo ""

# Starte Vite im Hintergrund
echo "📦 Starte Vite Dev Server..."
vite &
VITE_PID=$!

# Warte bis Vite gestartet ist
echo "⏳ Warte auf Vite Server..."
sleep 5

# Prüfe ob Vite läuft
if ! kill -0 $VITE_PID 2>/dev/null; then
  echo "❌ Vite Server konnte nicht gestartet werden!"
  exit 1
fi

echo "✅ Vite Server läuft (PID: $VITE_PID)"
echo ""

# Hole die lokale IP-Adresse (für Zugriff vom Simulator)
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
URL="http://${LOCAL_IP}:5173"

echo "📍 URL: ${URL}"
echo ""

# Funktion zum Starten eines Simulators und Öffnen von Safari
start_simulator() {
  local device_udid=$1
  local device_name=$2
  
  echo "📱 Starte Simulator: ${device_name}"
  
  # Starte den Simulator
  xcrun simctl boot "${device_udid}" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "   ✅ Simulator gestartet"
  else
    echo "   ℹ️  Simulator bereits gestartet"
  fi
  
  # Öffne den Simulator (falls nicht bereits geöffnet)
  open -a Simulator 2>/dev/null
  
  # Warte kurz, damit der Simulator Zeit zum Starten hat
  sleep 3
  
  # Öffne Safari im Simulator und navigiere zur URL
  xcrun simctl openurl "${device_udid}" "${URL}" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "   ✅ Safari geöffnet"
  else
    echo "   ⚠️  Öffne Safari manuell und navigiere zu: ${URL}"
  fi
  echo ""
}

# Finde automatisch die ersten 3 verfügbaren iPhone Simulatoren
echo "📋 Suche nach verfügbaren iPhone Simulatoren..."
DEVICE_LIST=$(xcrun simctl list devices available | grep "iPhone" | grep -v "unavailable" | head -3)

if [ -z "$DEVICE_LIST" ]; then
  echo "❌ Keine verfügbaren iPhone Simulatoren gefunden!"
  echo "💡 Stelle sicher, dass Xcode installiert ist."
  kill $VITE_PID 2>/dev/null
  exit 1
fi

# Extrahiere Gerätenamen und UDIDs
DEVICE_COUNT=0
while IFS= read -r line; do
  if [ $DEVICE_COUNT -ge 3 ]; then
    break
  fi
  
  # Extrahiere UDID (alles zwischen den Klammern)
  DEVICE_UDID=$(echo "$line" | sed -E 's/.*\(([^)]+)\).*/\1/')
  
  # Extrahiere Gerätenamen (alles vor der öffnenden Klammer, trimmen)
  DEVICE_NAME=$(echo "$line" | sed -E 's/[[:space:]]*\(.*$//' | sed 's/^[[:space:]]*//')
  
  if [ -n "$DEVICE_UDID" ] && [ -n "$DEVICE_NAME" ]; then
    DEVICE_COUNT=$((DEVICE_COUNT + 1))
    start_simulator "${DEVICE_UDID}" "${DEVICE_NAME}"
    sleep 2
  fi
done <<< "$DEVICE_LIST"

echo "✅ Fertig! ${DEVICE_COUNT} Simulator(s) gestartet."
echo ""
echo "🌐 Vite Server läuft auf: ${URL}"
echo "🛑 Drücke Ctrl+C zum Beenden"
echo ""

# Warte auf Ctrl+C
trap "echo ''; echo '🛑 Beende Vite Server...'; kill $VITE_PID 2>/dev/null; exit" INT TERM

# Warte auf Vite Prozess
wait $VITE_PID








