// Melde-Gründe für den Report-Flow (Apple App Review 1.2).
// key = stabiler Wert für die DB, label = Anzeigetext.
export const REPORT_REASONS = [
  { key: 'spam', label: 'Spam oder Werbung' },
  { key: 'harassment', label: 'Belästigung oder Hass' },
  { key: 'sexual', label: 'Sexueller oder anstößiger Inhalt' },
  { key: 'violence', label: 'Gewalt oder gefährlich' },
  { key: 'ip', label: 'Verletzt Rechte / geistiges Eigentum' },
  { key: 'other', label: 'Sonstiges' },
]

export const REPORT_REASON_KEYS = REPORT_REASONS.map((r) => r.key)

export function isValidReportReason(key) {
  return REPORT_REASON_KEYS.includes(key)
}
