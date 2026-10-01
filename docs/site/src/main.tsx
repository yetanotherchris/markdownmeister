import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import { DocumentationSite } from './site'
import './styles.css'

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(<DocumentationSite />)
}
