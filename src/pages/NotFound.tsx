import { Link } from 'react-router-dom'
import { Button, EmptyState } from '../components/ui'
import { IconInfo } from '../components/icons'

export default function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <EmptyState icon={<IconInfo size={22} />} title="Page not found"
        hint="The page you are looking for does not exist."
        action={<Link to="/"><Button>Go home</Button></Link>} />
    </div>
  )
}
