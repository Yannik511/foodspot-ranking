#!/bin/bash

# Script zum Starten der Vite App auf 3 iOS Simulatoren
# Verwendung: ./scripts/start-ios-simulators.sh

# Warte kurz, damit der Vite Server Zeit zum Starten hat
echo "⏳ Warte 3 Sekunden, damit der Vite Server startet..."
sleep 3

# Hole die lokale IP-Adresse (für Zugriff vom Simulator)
LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo "localhost")
URL="http://${LOCAL_IP}:5173"

echo "🚀 Starte iOS Simulatoren..."
echo "📍 URL: ${URL}"
echo ""

# Funktion zum Starten eines Simulators und Öffnen von Safari
start_simulator() {
  local device_udid=$1
  local device_name=$2
  
  echo "📱 Starte Simulator: ${device_name} (${device_udid})"
  
  # Starte den Simulator
  xcrun simctl boot "${device_udid}" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "   ✅ Simulator gestartet"
  else
    echo "   ℹ️  Simulator bereits gestartet oder Fehler"
  fi
  
  # Öffne den Simulator (falls nicht bereits geöffnet)
  open -a Simulator 2>/dev/null
  
  # Warte kurz, damit der Simulator Zeit zum Starten hat
  sleep 3
  
  # Öffne Safari im Simulator und navigiere zur URL
  xcrun simctl openurl "${device_udid}" "${URL}" 2>/dev/null
  if [ $? -eq 0 ]; then
    echo "   ✅ Safari geöffnet mit URL: ${URL}"
  else
    echo "   ⚠️  Konnte Safari nicht automatisch öffnen"
    echo "   💡 Öffne Safari manuell im Simulator und navigiere zu: ${URL}"
  fi
  echo ""
}

# Finde automatisch die ersten 3 verfügbaren iPhone Simulatoren
echo "📋 Suche nach verfügbaren iPhone Simulatoren..."
DEVICE_LIST=$(xcrun simctl list devices available | grep "iPhone" | grep -v "unavailable" | head -3)

if [ -z "$DEVICE_LIST" ]; then
  echo "❌ Keine verfügbaren iPhone Simulatoren gefunden!"
  echo "💡 Stelle sicher, dass Xcode installiert ist und Simulatoren verfügbar sind."
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
    echo "🎯 Gerät ${DEVICE_COUNT}: ${DEVICE_NAME}"
    start_simulator "${DEVICE_UDID}" "${DEVICE_NAME}"
    
    # Kurze Pause zwischen den Simulatoren
    sleep 2
  fi
done <<< "$DEVICE_LIST"

echo "✅ Fertig! ${DEVICE_COUNT} Simulator(s) gestartet."
echo ""
echo "🌐 URL für manuellen Zugriff: ${URL}"
echo "💡 Falls Safari nicht automatisch geöffnet wurde, navigiere manuell in jedem Simulator zu dieser URL."

