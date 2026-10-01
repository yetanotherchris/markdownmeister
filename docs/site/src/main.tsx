import { createRoot } from 'react-dom/client'
import { DocumentationSite } from './site'
import './styles.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<DocumentationSite />)
}
