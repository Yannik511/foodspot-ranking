// Kurzes Anzeige-/Filter-Label (lists.city) aus der vollen MapKit-Adresse ableiten.
// z. B. "München, Bayern, Deutschland" -> "München". Bleibt kompatibel zur
// bestehenden city-basierten Anzeige und Filterung.
export function cityLabelFromAddress(address) {
  if (!address) return ''
  return address.split(',')[0].trim().slice(0, 100)
}
