import { useNavigate } from 'react-router-dom'
import CreateSharedList from '../components/social/CreateSharedList'

function CreateSharedListPage() {
  const navigate = useNavigate()

  const handleClose = () => {
    // Navigiere zurück zur vorherigen Seite
    navigate(-1)
  }

  return (
    <CreateSharedList onClose={handleClose} isFullscreen={true} />
  )
}

export default CreateSharedListPage

