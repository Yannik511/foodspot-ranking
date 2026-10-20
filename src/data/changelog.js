// Changelog für die In-App-Seite "Neuigkeiten" (Einstellungen → App-Info).
// Neueste Version immer OBEN. Bei jedem Store-Update hier einen Eintrag ergänzen
// und MARKETING_VERSION in Xcode auf dieselbe Version setzen — ein Test
// (changelog.test.js) prüft, dass beides übereinstimmt.
// Texte nutzerfreundlich halten: was kann ich jetzt, nicht wie es gebaut ist.

export const CHANGELOG = [
  {
    version: '1.0',
    date: '2026-10-20',
    title: 'Willkommen bei Rankify',
    intro: 'Die erste Version ist da – alles, was du brauchst, um deine Lieblingsspots zu ranken.',
    items: [
      { icon: '🏆', title: 'Tier-Listen', text: 'Restaurants, Gerichte und mehr von S bis D sortieren.' },
      { icon: '👥', title: 'Geteilte Listen', text: 'Freunde einladen, gemeinsam bewerten und den Durchschnitt sehen.' },
      { icon: '🧭', title: 'Entdecken', text: 'Die beliebtesten Spots in deiner Nähe und was deine Freunde zuletzt bewertet haben.' },
      { icon: '🌍', title: 'Weltkarte', text: 'Alle Orte, die du bewertet hast, auf einen Blick in deinem Profil.' },
      { icon: '📍', title: 'Ortssuche', text: 'Standort beim Anlegen direkt über Apple Maps finden.' },
      { icon: '🔔', title: 'Benachrichtigungen', text: 'Freundschaftsanfragen, Einladungen und neue Bewertungen sofort mitbekommen.' },
      { icon: '🔐', title: 'Schneller Login', text: 'Mit Benutzername oder E-Mail – und optional mit Face ID.' },
      { icon: '🛡️', title: 'Sicher unterwegs', text: 'Inhalte und Nutzer melden oder blockieren.' },
      { icon: '🌙', title: 'Dark Mode', text: 'Schont die Augen beim Ranken am Abend.' },
    ],
  },
]

export const APP_VERSION = CHANGELOG[0].version
