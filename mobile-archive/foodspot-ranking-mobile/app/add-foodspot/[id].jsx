import { useLocalSearchParams } from 'expo-router'
import AddFoodspot from '../../src/pages/AddFoodspot'

export default function AddFoodspotScreen() {
  const { id, spotId } = useLocalSearchParams()
  return <AddFoodspot listId={id} spotId={spotId} />
}

