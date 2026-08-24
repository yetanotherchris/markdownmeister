import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/400-italic.css'
import '@milkdown/crepe/theme/classic.css'
import '@milkdown/crepe/theme/common/style.css'
import App from './App'
import { loadSettingsFromMain } from './state/settings'
import { loadEditorThemesFromMain } from './state/editorThemes'

async function start(): Promise<void> {
  await Promise.all([loadSettingsFromMain(), loadEditorThemesFromMain()])
  const root = document.getElementById('root')
  if (root) {
    ReactDOM.createRoot(root).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    )
  }
}

void start()
