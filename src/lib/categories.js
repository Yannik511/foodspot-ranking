export const DEFAULT_SCALE = 5

export const CATEGORIES = {
  Döner: {
    imageUrl: '/images/categories/doener.jpg',
    criteria: ['Brot', 'Fleisch', 'Soße', 'Frische', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Burger: {
    imageUrl: '/images/categories/burger.jpg',
    criteria: ['Bun', 'Patty', 'Toppings/Cheese', 'Soßen', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Pizza: {
    imageUrl: '/images/categories/pizza.jpg',
    criteria: ['Teig', 'Belag', 'Soße', 'Backen', 'Location'],
    scale: DEFAULT_SCALE
  },
  Asiatisch: {
    imageUrl: '/images/categories/asiatisch.jpg',
    criteria: ['Nudeln/Reis', 'Protein', 'Soße', 'Gemüse', 'Location'],
    scale: DEFAULT_SCALE
  },
  Bratwurst: {
    imageUrl: '/images/categories/bratwurst.jpg',
    criteria: ['Geschmack & Würze', 'Bratgrad & Textur', 'Beilage & Sauce', 'Semmel', 'Preis-Leistungs-Verhältnis'],
    scale: DEFAULT_SCALE
  },
  Glühwein: {
    imageUrl: '/images/categories/gluehwein.jpg',
    criteria: ['Geschmack', 'Temperatur', 'Gewürze', 'Alkoholgehalt', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Sushi: {
    imageUrl: '/images/categories/sushi.jpg',
    criteria: ['Fischqualität', 'Reis & Textur', 'Frische & Temperatur', 'Kreativität & Vielfalt', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  'Deutsche Küche': {
    imageUrl: '/images/categories/deutsche-kuche.jpg',
    criteria: ['Soße & Braten', 'Beilagen', 'Würzung & Authentizität', 'Frische & Regionalität', 'Portion & Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Bier: {
    imageUrl: '/images/categories/bier.jpg',
    criteria: ['Geschmack & Ausgewogenheit', 'Aroma & Geruch', 'Frische & Temperatur', 'Schaumqualität & Kohlensäure', 'Sortencharakter & Authentizität'],
    scale: DEFAULT_SCALE
  },
  Steak: {
    imageUrl: '/images/categories/steak.jpg',
    criteria: ['Fleischqualität', 'Gargrad & Zubereitung', 'Beilagen & Saucen', 'Konsistenz', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  'Fast Food': {
    imageUrl: '/images/categories/fast-food.jpg',
    criteria: ['Pommes', 'Sauberkeit & Ordnung', 'Preis / Leistung', 'Burger', 'Chicken Nuggets / Beilagen'],
    scale: DEFAULT_SCALE
  },
  Streetfood: {
    imageUrl: '/images/categories/streetfood.jpg',
    criteria: ['Authentizität & Geschmack', 'Kreativität & Vielfalt', 'Frische & Qualität', 'Atmosphäre & Erlebnis', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  },
  Leberkässemmel: {
    imageUrl: '/images/categories/leberkaessemmel.jpg',
    criteria: ['Semmel', 'Soßen', 'Leberkäs-Sorte', 'Rand / Knusprigkeit', 'Preis-Leistung'],
    scale: DEFAULT_SCALE
  }
}

export const CRITERIA_ICONS = {
  'Brot': '🍞', 'Fleisch': '🥩', 'Soße': '🥫', 'Soßen': '🥫',
  'Frische': '🥗', 'Location': '📍', 'Bun': '🍞', 'Patty': '🥩',
  'Toppings/Cheese': '🧀', 'Geschmack': '😋', 'Teig': '🍞', 'Belag': '🍕',
  'Backen': '🔥', 'Nudeln/Reis': '🍜', 'Protein': '🥩', 'Gemüse': '🥗',
  'Tortilla': '🌯', 'Füllung': '🥙', 'Soße/Schärfe': '🌶️',
  'Temperatur': '🌡️', 'Gewürze': '🧂', 'Alkoholgehalt': '🍷',
  'Preis-Leistung': '💰', 'Soße & Braten': '🥘', 'Beilagen': '🥔',
  'Würzung & Authentizität': '🌿', 'Frische & Regionalität': '🌱',
  'Portion & Preis-Leistung': '💰', 'Geschmack & Ausgewogenheit': '😋',
  'Aroma & Geruch': '👃', 'Frische & Temperatur': '❄️',
  'Schaumqualität & Kohlensäure': '🫧', 'Sortencharakter & Authentizität': '🏆',
  'Fischqualität': '🐟', 'Reis & Textur': '🍚', 'Kreativität & Vielfalt': '🎨',
  'Fleischqualität': '🥩', 'Gargrad & Zubereitung': '🔥', 'Beilagen & Saucen': '🥄',
  'Ambiente & Service': '🛎️', 'Konsistenz': '🧈', 'Geschmack & Frische': '😋',
  'Schnelligkeit & Service': '⚡', 'Sauberkeit & Ordnung': '🧼',
  'Markenerlebnis': '✨', 'Authentizität & Geschmack': '🧭',
  'Frische & Qualität': '🥗', 'Atmosphäre & Erlebnis': '🎉',
  'Geschmack & Würze': '🌭', 'Bratgrad & Textur': '🔥', 'Beilage & Sauce': '🥖',
  'Authentizität & Atmosphäre': '🎪', 'Semmel': '🥯', 'Leberkäs-Sorte': '🥩',
  'Rand / Knusprigkeit': '🥨', 'Preis-Leistungs-Verhältnis': '💰',
  'Pommes': '🍟', 'Preis / Leistung': '💰', 'Burger': '🍔',
  'Chicken Nuggets / Beilagen': '🍗'
}

export const getCategoryScale = (category) => CATEGORIES[category]?.scale || DEFAULT_SCALE

export const calculateOverallRating = (ratings, category) => {
  if (!category) return 0
  const values = Object.values(ratings || {})
  const filled = values.filter(r => r > 0)
  if (filled.length === 0) return 0
  const avg = filled.reduce((a, b) => a + b, 0) / filled.length
  const scale = getCategoryScale(category)
  return Math.round((avg / scale) * 100) / 10
}

export const calculateTier = (score) => {
  if (score >= 9.0) return 'S'
  if (score >= 8.0) return 'A'
  if (score >= 6.5) return 'B'
  if (score >= 5.0) return 'C'
  return 'D'
}
