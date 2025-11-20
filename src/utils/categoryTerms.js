/**
 * Gibt die kategorieabhängigen Begriffe zurück
 * @param {string|null|undefined} category - Die Kategorie der Liste
 * @returns {Object} Objekt mit plural, singular, createAction, editAction
 */
export const getCategoryTerms = (category) => {
  if (!category) {
    return {
      plural: 'Foodspots',
      singular: 'Foodspot',
      createAction: 'Foodspot erstellen',
      editAction: 'Foodspot bearbeiten',
      headerPrefix: 'Foodspots'
    }
  }

  const normalizedCategory = category.trim()

  switch (normalizedCategory) {
    case 'Bier':
      return {
        plural: 'Biere',
        singular: 'Bier',
        createAction: 'Bierbewertung erstellen',
        editAction: 'Bierbewertung bearbeiten',
        headerPrefix: 'Biere'
      }
    case 'Glühwein':
      return {
        plural: 'Glühweine',
        singular: 'Glühwein',
        createAction: 'Glühweinbewertung erstellen',
        editAction: 'Glühweinbewertung bearbeiten',
        headerPrefix: 'Glühweine'
      }
    default:
      return {
        plural: 'Foodspots',
        singular: 'Foodspot',
        createAction: 'Foodspot erstellen',
        editAction: 'Foodspot bearbeiten',
        headerPrefix: 'Foodspots'
      }
  }
}



