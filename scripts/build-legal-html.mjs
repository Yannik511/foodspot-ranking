// Erzeugt docs/index.html (öffentliche Apple-Privacy-URL via GitHub Pages) aus
// src/data/legal.js, damit In-App-Texte und öffentliche Seite nie auseinanderlaufen.
// Aufruf: npm run legal:html
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LEGAL, LAST_UPDATED } from '../src/data/legal.js'

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Reihenfolge + Anker wie bisher auf der Seite
const PAGES = [
  ['datenschutz', LEGAL.privacy],
  ['nutzungsbedingungen', LEGAL.terms],
  ['impressum', LEGAL.impressum],
]

const renderSection = ({ heading, paragraphs = [], list }) =>
  [
    `  <h3>${esc(heading)}</h3>`,
    ...paragraphs.map((p) => `  <p>${esc(p)}</p>`),
    ...(list
      ? ['  <ul>', ...list.map((li) => `    <li>${esc(li)}</li>`), '  </ul>']
      : []),
  ].join('\n')

const body = PAGES.map(([id, page]) =>
  [`  <h2 id="${id}">${esc(page.title)}</h2>`, ...page.sections.map(renderSection)].join('\n\n'),
).join('\n\n')

const nav = PAGES.map(([id, page]) => `    <a href="#${id}">${esc(page.title.replace('erklärung', ''))}</a>`).join('\n')

const html = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Rankify – Rechtliches</title>
  <!--
    Öffentliche Rechtstexte für Rankify (App-Store-Privacy-URL via GitHub Pages).
    GENERIERT aus src/data/legal.js via \`npm run legal:html\` — nicht von Hand bearbeiten.
  -->
  <style>
    :root { color-scheme: light dark; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 720px;
      margin: 0 auto;
      padding: 32px 20px 80px;
      line-height: 1.6;
      color: #1a1a1a;
      background: #ffffff;
    }
    @media (prefers-color-scheme: dark) {
      body { color: #e5e5e5; background: #111114; }
      a { color: #ff9357; }
    }
    h1 { font-size: 28px; margin-bottom: 4px; }
    h2 { font-size: 20px; margin-top: 40px; border-top: 1px solid rgba(128,128,128,0.25); padding-top: 24px; }
    h3 { font-size: 16px; margin-top: 24px; }
    .updated { color: #888; font-size: 14px; margin-bottom: 24px; }
    nav { margin: 24px 0; font-size: 15px; }
    nav a { margin-right: 16px; }
    a { color: #FF7E42; }
    ul { padding-left: 20px; }
    li { margin-bottom: 8px; }
    footer { margin-top: 48px; color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <h1>Rankify</h1>
  <p class="updated">Stand: ${LAST_UPDATED}</p>
  <nav>
${nav}
  </nav>

${body}

  <footer>© 2026 Rankify. Alle Rechte vorbehalten.</footer>
</body>
</html>
`

const out = fileURLToPath(new URL('../docs/index.html', import.meta.url))
writeFileSync(out, html)
console.log(`docs/index.html geschrieben (Stand ${LAST_UPDATED})`)
