// Zentrale Quelle für alle Rechtstexte (In-App-Seiten + statische GitHub-Pages-Version
// werden aus denselben Inhalten gepflegt). Nur HIER ändern, danach die öffentliche
// Seite neu erzeugen:
//   - diese Datei  (In-App: /privacy, /impressum, /terms)
//   - docs/index.html  (Apple-Privacy-URL via GitHub Pages) ← `npm run legal:html`
//
// ⚠️ Rechtlicher Hinweis: Diese Texte sind ein fachlich fundierter Entwurf auf Basis der
// tatsächlichen Datenflüsse der App. Sie ersetzen KEINE Rechtsberatung. Vor Release:
//   1. ✅ Impressum: Yannik Fuchs (Inhaber Apple-Developer-Account), support@getrankify.app, Postanschrift Gilching.
//   2. ✅ Supabase-Region bestätigt: EU (Frankfurt, aws-eu-central-1).
//   3. Idealerweise einmal juristisch gegenprüfen lassen.

export const LAST_UPDATED = '2026-10-20'

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
          'Push-Benachrichtigungen: wenn du Mitteilungen erlaubst, speichern wir das von Apple vergebene Geräte-Token (Push-Token) und deine Benachrichtigungs-Einstellungen. Darüber senden wir dir Hinweise zu Freundschaftsanfragen, Listen-Einladungen, neuen Bewertungen in geteilten Listen sowie gelegentliche Erinnerungen.',
          'Meldungen und Blockierungen: wenn du Inhalte oder Nutzer meldest bzw. blockierst, speichern wir dies, um Meldungen zu bearbeiten und Blockierungen umzusetzen.',
          'Feedback: wenn du über „Feedback senden“ eine Nachricht schickst, speichern wir sie zusammen mit der gewählten Kategorie, der App-Version und der Plattform (z. B. iOS), um dein Anliegen zu bearbeiten und die App zu verbessern.',
        ],
      },
      {
        heading: '3. Zwecke und Rechtsgrundlagen',
        paragraphs: [
          'Kontodaten und Inhaltsdaten verarbeiten wir zur Bereitstellung der App-Kernfunktionen (Vertragserfüllung, Art. 6 Abs. 1 lit. b DSGVO).',
          'Standortzugriff und Kamera-/Fotozugriff erfolgen ausschließlich auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du jederzeit in den Geräteeinstellungen widerrufen kannst.',
          'Push-Benachrichtigungen versenden wir nur mit deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO). Du kannst sie in den iOS-Einstellungen komplett abschalten oder in der App unter Einstellungen einzeln nach Art steuern.',
          'Die Übermittlung hochgeladener Bilder an OpenAI zur automatischen Prüfung erfolgt auf Grundlage deiner Einwilligung (Art. 6 Abs. 1 lit. a DSGVO), die du beim ersten Foto-Upload erteilst und jederzeit in der App unter Einstellungen → „KI-Bildprüfung“ für die Zukunft widerrufen kannst.',
          'Die Bearbeitung von Meldungen, Blockierungen und Feedback erfolgt auf Grundlage unseres berechtigten Interesses, die App frei von rechtswidrigen und anstößigen Inhalten zu halten und sie weiterzuentwickeln (Art. 6 Abs. 1 lit. f DSGVO).',
        ],
      },
      {
        heading: '4. Eingesetzte Dienste (Auftragsverarbeiter & Dritte)',
        paragraphs: [
          'Zur Bereitstellung der App nutzen wir folgende Dienste:',
        ],
        list: [
          'Supabase (Supabase Inc.): Hosting von Datenbank, Authentifizierung und Datei-Speicher. Hier werden deine Konto-, Profil- und Inhaltsdaten gespeichert. Serverstandort: EU (Frankfurt, aws-eu-central-1) – die Daten werden innerhalb der EU verarbeitet.',
          'Apple MapKit (Apple Inc.): Darstellung von Karten. Bei Kartennutzung werden technisch notwendige Daten (z. B. IP-Adresse, Kartenausschnitt) an Apple übertragen.',
          'OpenStreetMap / Nominatim (OpenStreetMap Foundation): Ortssuche. Wenn du nach einem Ort suchst, wird deine Suchanfrage an nominatim.openstreetmap.org übertragen.',
          'Resend (Resend, Inc., USA): Versand von System-E-Mails wie Konto-Bestätigung und Passwort-Zurücksetzen. Dafür werden deine E-Mail-Adresse und der Inhalt der jeweiligen E-Mail verarbeitet. Der Versand erfolgt über Server in der EU (Irland); soweit dennoch Daten in die USA übermittelt werden, geschieht dies auf Grundlage von EU-Standardvertragsklauseln.',
          'Apple Push Notification Service (Apple Inc.): Zustellung von Push-Benachrichtigungen. Dafür werden dein Geräte-Token und der Inhalt der jeweiligen Benachrichtigung an Apple übertragen.',
          'OpenAI Moderation API (OpenAI, L.L.C., USA): automatische Prüfung hochgeladener Bilder auf anstößige Inhalte, bevor sie gespeichert werden. Übertragen wird nur das Bild selbst, ohne Name, E-Mail-Adresse oder Nutzerkennung, und erst nachdem du beim ersten Foto-Upload ausdrücklich zugestimmt hast. Ohne Zustimmung können keine Fotos hochgeladen werden. Die Übermittlung in die USA erfolgt auf Grundlage von EU-Standardvertragsklauseln.',
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
          'Push-Token löschen wir zusammen mit deinem Konto oder sobald Apple uns meldet, dass ein Token nicht mehr gültig ist (z. B. nach dem Löschen der App).',
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
        heading: 'Verantwortlicher',
        paragraphs: [
          'Yannik Fuchs',
          'Am Bahnhof 4',
          '82205 Gilching',
          'Deutschland',
        ],
      },
      {
        heading: 'Kontakt',
        paragraphs: [
          'E-Mail: support@getrankify.app',
        ],
      },
      {
        heading: 'Hinweis',
        paragraphs: [
          'Rankify ist ein privates, nicht-kommerzielles Projekt. Verantwortlich für die Datenverarbeitung im Sinne der DSGVO ist die oben genannte Person.',
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
