import { useLocalSearchParams } from 'expo-router'
import TierList from '../../src/pages/TierList'

export default function TierListScreen() {
  const { id } = useLocalSearchParams()
  return <TierList listId={id} />
}

