import { app, BrowserWindow, Menu } from 'electron'
import * as path from 'path'
import { registerIpcHandlers } from './ipc/register'
import { createApplicationMenu } from './menu'
import { registerShortcuts } from './shortcuts'
import { loadSettings, flushSettings, adoptRepairedEditorTheme } from './settings'
import { applyThemeOverride } from './theme'
import { applySpellcheckSetting } from './spellcheck'
import { registerSpellcheckContextMenu } from './contextMenu'
import { recentItemsConfigPath } from './recentItemsPath'
import { themesDir } from './themes/path'
import { ensureThemesDirectory, seedMissingDefaultThemes } from './themes/store'
import { migrateLegacyCustomTheme } from './themes/migration'
import { resolveLaunchBounds, trackWindowState, flushWindowState } from './windowState'
import { reconcileExplorerClosedWithoutWorkspace } from './workspaceExplorerState'
import { windowIconPath } from './windowIcon'
import { legacyConfigPath, universalConfigPath, migrateConfigFile } from './configPath'
import { initOsOpenHost, setOsOpenWindow, clearOsOpenWindow } from './osOpenHost'
import {
  findAppImageIcon,
  ensureFolderAction,
  folderActionLocations,
  removeFolderAction,
  resolveXdgDataHome,
  REMOVE_FOLDER_ACTION_FLAG,
  PRODUCT_NAME
} from './linuxDesktopEntry'
import * as os from 'os'
import { pathToFileURL } from 'url'

if (process.env.MM_USER_DATA_DIR) {
  app.setPath('userData', process.env.MM_USER_DATA_DIR)
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const { bounds, isMaximized } = resolveLaunchBounds()
  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    show: false,
    icon: windowIconPath({
      platform: process.platform,
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
      mainDir: __dirname
    }),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, '../preload/index.js')
    }
  })
  const developmentUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:5173'
  const productionUrl = pathToFileURL(path.join(__dirname, '../renderer/index.html')).toString()
  const isApprovedUrl = (candidate: string): boolean => {
    if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
      try {
        return new URL(candidate).origin === new URL(developmentUrl).origin
      } catch {
        return false
      }
    }
    return candidate === productionUrl
  }
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isApprovedUrl(url)) event.preventDefault()
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.once('ready-to-show', () => {
    if (isMaximized) mainWindow?.maximize()
    // Policy: launching must never steal focus from whatever the user is
    // working in (maximize() itself shows without focusing).
    mainWindow?.showInactive()
  })
  trackWindowState(mainWindow)

  if (process.platform === 'darwin') {
    createApplicationMenu()
  } else {
    Menu.setApplicationMenu(null)
  }
  registerShortcuts(mainWindow)
  registerSpellcheckContextMenu(mainWindow)
  registerIpcHandlers(
    mainWindow,
    process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL
      ? developmentUrl
      : productionUrl
  )

  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(developmentUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
    clearOsOpenWindow()
  })
  setOsOpenWindow(mainWindow)
}

function ensureLinuxFolderAction(): void {
  if (process.platform !== 'linux' || !process.env.APPIMAGE) return
  const dataHome = resolveXdgDataHome(process.env)
  if (!dataHome) return
  const mountRoot = process.env.APPDIR ?? path.dirname(app.getPath('exe'))
  const outcome = ensureFolderAction({
    locations: folderActionLocations(dataHome),
    appImagePath: process.env.APPIMAGE,
    iconSource: findAppImageIcon(mountRoot)
  })
  if (!outcome.ok) {
    console.warn(`[folder-action] could not update the desktop entry: ${outcome.message}`)
  }
}

function initThemes(): void {
  try {
    const dir = themesDir()
    ensureThemesDirectory(dir)
    seedMissingDefaultThemes(dir)
    const outcome = migrateLegacyCustomTheme(recentItemsConfigPath(), dir)
    if (outcome.repairedThemeName !== null) adoptRepairedEditorTheme(outcome.repairedThemeName)
  } catch {
    console.warn('[themes] could not initialise the themes folder')
  }
}

function bootApp(): void {
  ensureLinuxFolderAction()
  if (!process.env.MM_CONFIG_DIR) {
    const homeDir = os.homedir()
    if (homeDir) {
      const appDataDir = app.getPath('appData')
      const underHome = path.relative(homeDir, appDataDir)
      if (!underHome || (!underHome.startsWith('..') && !path.isAbsolute(underHome))) {
        const legacy = legacyConfigPath({ homeDir, platform: process.platform, appDataDir })
        const universal = universalConfigPath({
          homeDir,
          platform: process.platform,
          xdgConfigHome: process.env.XDG_CONFIG_HOME
        })
        if (legacy !== universal) {
          const outcome = migrateConfigFile(legacy, universal)
          if (outcome === 'failed') {
            console.warn('[config] could not migrate config to universal location')
          }
        }
      }
    }
  }
  initThemes()
  reconcileExplorerClosedWithoutWorkspace()
  applyThemeOverride(loadSettings().themeOverride)
  applySpellcheckSetting(loadSettings().spellcheckEnabled, loadSettings().spellcheckLanguage)
  createWindow()
}

if (process.argv.includes(REMOVE_FOLDER_ACTION_FLAG)) {
  try {
    const dataHome = resolveXdgDataHome(process.env)
    const outcome = dataHome
      ? removeFolderAction(folderActionLocations(dataHome))
      : { removedEntry: false, removedIcon: false }
    console.log(
      outcome.removedEntry || outcome.removedIcon
        ? `Removed the ${PRODUCT_NAME} folder action.`
        : `No ${PRODUCT_NAME} folder action was found.`
    )
  } catch {
    console.log(`Could not remove the ${PRODUCT_NAME} folder action.`)
  }
  app.exit(0)
}

const shouldContinue = initOsOpenHost()

if (shouldContinue) {
  app.whenReady().then(bootApp)
}

app.on('window-all-closed', () => {
  flushSettings()
  flushWindowState()
  app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
