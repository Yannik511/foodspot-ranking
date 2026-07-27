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
    case 'Eis':
      return {
        plural: 'Eissorten',
        singular: 'Eis',
        createAction: 'Eisbewertung erstellen',
        editAction: 'Eisbewertung bearbeiten',
        headerPrefix: 'Eissorten'
      }
    case 'Wein':
      return {
        plural: 'Weine',
        singular: 'Wein',
        createAction: 'Weinbewertung erstellen',
        editAction: 'Weinbewertung bearbeiten',
        headerPrefix: 'Weine'
      }
    case 'Kaffeebohnen':
      return {
        plural: 'Kaffeebohnen',
        singular: 'Kaffeebohne',
        createAction: 'Kaffeebewertung erstellen',
        editAction: 'Kaffeebewertung bearbeiten',
        headerPrefix: 'Kaffeebohnen'
      }
    case 'Tee':
      return {
        plural: 'Tees',
        singular: 'Tee',
        createAction: 'Teebewertung erstellen',
        editAction: 'Teebewertung bearbeiten',
        headerPrefix: 'Tees'
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




