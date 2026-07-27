// Zentrale Quelle für alle Rechtstexte (In-App-Seiten + statische GitHub-Pages-Version
// werden aus denselben Inhalten gepflegt). Bei Änderungen BEIDE aktualisieren:
//   - diese Datei  (In-App: /privacy, /impressum, /terms)
//   - docs/index.html  (öffentliche Apple-Privacy-URL via GitHub Pages)
//
// ⚠️ Rechtlicher Hinweis: Diese Texte sind ein fachlich fundierter Entwurf auf Basis der
// tatsächlichen Datenflüsse der App. Sie ersetzen KEINE Rechtsberatung. Vor Release:
//   1. Alle [PLATZHALTER] im Impressum mit echten Daten füllen.
//   2. Supabase-Server-Region bestätigen (EU vs. US → Drittlandtransfer-Klausel).
//   3. Idealerweise einmal juristisch gegenprüfen lassen.

export const LAST_UPDATED = '2026-07-05'

export const LEGAL = {
  privacy: {
    title: 'Datenschutzerklärung',
    updated: LAST_UPDATED,
    sections: [
      {
        heading: '1. Verantwortlicher',
        paragraphs: [
          'Verantwortlich für die Datenverarbeitung in dieser App ist der im Impressum genannte Betreiber. Bei Fragen zum Datenschutz erreichst du uns über die dort angegebenen Kontaktdaten.',
        ],
      },
      {
        heading: '2. Welche Daten wir verarbeiten',
        paragraphs: [
          'Wir verarbeiten nur die Daten, die für den Betrieb der App erforderlich sind oder die du uns freiwillig bereitstellst:',
        ],
        list: [
          'Kontodaten: E-Mail-Adresse, Benutzername und Passwort (das Passwort wird ausschließlich verschlüsselt gespeichert und ist uns nicht im Klartext bekannt).',
          'Profildaten: optionaler Anzeigename, Profilbild und Kurzbeschreibung.',
          'Inhaltsdaten: von dir erstellte Listen, Bewertungen, Foodspots und hochgeladene Fotos.',
          'Standortdaten: nur wenn du die Standortfunktion aktiv nutzt und freigibst, werden GPS-Koordinaten erfasst und einem Foodspot bzw. einer Liste zugeordnet.',
          'Soziale Daten: Freundschaftsbeziehungen und Einladungen zu geteilten Listen.',
        ],
      },
      {
        heading: '3. Zwecke und Rechtsgrundlagen',
        paragraphs: [
          'Kontodaten und Inhaltsdaten verarbeiten wir zur Bereitstellung der App-Kernfunktionen (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO).',
          'Standortzugriff und Kamera-/Fotozugriff erfolgen ausschließlich auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit in den Geräteeinstellungen widerrufen kannst.',
        ],
      },
      {
        heading: '4. Eingesetzte Dienste (Auftragsverarbeiter & Dritte)',
        paragraphs: [
          'Zur Bereitstellung der App nutzen wir folgende Dienste:',
        ],
        list: [
          'Supabase (Supabase Inc.): Hosting von Datenbank, Authentifizierung und Datei-Speicher. Hier werden deine Konto-, Profil- und Inhaltsdaten gespeichert. Serverstandort: [REGION BESTÄTIGEN – z. B. EU]. Bei Verarbeitung außerhalb der EU erfolgt der Transfer auf Grundlage von EU-Standardvertragsklauseln.',
          'Apple MapKit (Apple Inc.): Darstellung von Karten. Bei Kartennutzung werden technisch notwendige Daten (z. B. IP-Adresse, Kartenausschnitt) an Apple übertragen.',
          'OpenStreetMap / Nominatim (OpenStreetMap Foundation): Ortssuche. Wenn du nach einem Ort suchst, wird deine Suchanfrage an nominatim.openstreetmap.org übertragen.',
        ],
      },
      {
        heading: '5. Kein Tracking, keine Werbung',
        paragraphs: [
          'Wir setzen keine Analyse-, Tracking- oder Werbe-Dienste ein und geben deine Daten nicht zu Werbezwecken weiter. Es findet kein geräteübergreifendes Tracking statt.',
        ],
      },
      {
        heading: '6. Speicherdauer & Löschung',
        paragraphs: [
          'Deine Daten werden gespeichert, solange dein Konto besteht. Du kannst dein Konto jederzeit direkt in der App unter Einstellungen → „Account löschen" unwiderruflich löschen. Dabei werden dein Konto, deine Inhalte und deine hochgeladenen Dateien dauerhaft entfernt.',
        ],
      },
      {
        heading: '7. Deine Rechte',
        paragraphs: [
          'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Erteilte Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen. Außerdem steht dir ein Beschwerderecht bei einer Datenschutz-Aufsichtsbehörde zu. Zur Ausübung deiner Rechte kontaktiere uns über die im Impressum genannten Daten.',
        ],
      },
    ],
  },

  impressum: {
    title: 'Impressum',
    updated: LAST_UPDATED,
    sections: [
      {
        heading: 'Angaben gemäß § 5 DDG',
        paragraphs: [
          '[NAME / VERANTWORTLICHE PERSON]',
          '[STRASSE UND HAUSNUMMER]',
          '[PLZ UND ORT]',
          '[LAND]',
        ],
      },
      {
        heading: 'Kontakt',
        paragraphs: [
          'E-Mail: [KONTAKT-E-MAIL]',
        ],
      },
      {
        heading: 'Verantwortlich für den Inhalt',
        paragraphs: [
          '[NAME], Anschrift wie oben.',
        ],
      },
      {
        heading: 'Hinweis',
        paragraphs: [
          'Die Platzhalter in eckigen Klammern sind vor Veröffentlichung mit den tatsächlichen Angaben zu ersetzen. In Deutschland besteht für geschäftsmäßig betriebene Apps eine Impressumspflicht.',
        ],
      },
    ],
  },

  terms: {
    title: 'Nutzungsbedingungen',
    updated: LAST_UPDATED,
    sections: [
      {
        heading: '1. Geltungsbereich',
        paragraphs: [
          'Diese Nutzungsbedingungen regeln die Nutzung der App Rankify. Mit der Registrierung erklärst du dich mit ihnen einverstanden.',
        ],
      },
      {
        heading: '2. Konto',
        paragraphs: [
          'Für die Nutzung ist ein Konto erforderlich. Du bist für die Geheimhaltung deiner Zugangsdaten selbst verantwortlich und stellst sicher, dass deine Angaben zutreffend sind. Ein Konto ist nicht übertragbar.',
        ],
      },
      {
        heading: '3. Inhalte der Nutzer',
        paragraphs: [
          'Für die von dir erstellten Inhalte (Listen, Bewertungen, Fotos) bist du selbst verantwortlich. Du sicherst zu, dass du die erforderlichen Rechte an hochgeladenen Fotos besitzt und keine Rechte Dritter verletzt.',
          'Es ist untersagt, rechtswidrige, beleidigende oder rechteverletzende Inhalte einzustellen.',
          'Wir dulden keine anstößigen, gewaltverherrlichenden, sexuellen, hasserfüllten oder anderweitig unangemessenen Inhalte sowie kein missbräuchliches Verhalten gegenüber anderen Nutzern (Null-Toleranz). Hochgeladene Bilder werden automatisiert auf solche Inhalte geprüft. Verstöße führen zur Entfernung der betreffenden Inhalte und können zur Sperrung oder Löschung deines Kontos führen.',
        ],
      },
      {
        heading: '4. Verfügbarkeit',
        paragraphs: [
          'Wir bemühen uns um eine möglichst unterbrechungsfreie Verfügbarkeit, können diese jedoch nicht garantieren. Wartungen, technische Störungen oder Weiterentwicklungen können zu vorübergehenden Einschränkungen führen.',
        ],
      },
      {
        heading: '5. Kündigung',
        paragraphs: [
          'Du kannst dein Konto jederzeit in der App unter Einstellungen → „Account löschen" beenden. Bei schwerwiegenden oder wiederholten Verstößen gegen diese Bedingungen können wir ein Konto sperren oder löschen.',
        ],
      },
      {
        heading: '6. Haftung',
        paragraphs: [
          'Die Nutzung der App erfolgt auf eigenes Risiko. Für Inhalte anderer Nutzer übernehmen wir keine Gewähr. Im Übrigen richtet sich die Haftung nach den gesetzlichen Bestimmungen.',
        ],
      },
    ],
  },
}
