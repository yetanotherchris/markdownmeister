import { BrowserWindow, Menu, session } from 'electron'
import { spellcheckMenuActions } from './spellcheckMenu'


export function registerSpellcheckContextMenu(window: BrowserWindow): void {
  window.webContents.on('context-menu', (_event, params) => {
    const actions = spellcheckMenuActions(params)
    if (actions.length === 0) return

    const template = actions.map((action) => ({
      label: action.label,
      click: () => {
        if (action.kind === 'suggestion') {
          window.webContents.replaceMisspelling(action.suggestion)
        } else {
          session.defaultSession.addWordToSpellCheckerDictionary(action.word)
        }
      }
    }))

    Menu.buildFromTemplate(template).popup({ window })
  })
}
