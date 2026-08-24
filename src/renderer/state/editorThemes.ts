import type {
  EditorColors,
  EditorThemeDefinition,
  EditorThemesList
} from '../../shared/ipc-contract'
import { EMERGENCY_EDITOR_THEME } from '../../shared/editorThemeTokens'



let cached: EditorThemeDefinition[] = []
let cachedInvalidNames: string[] = []

export function getEditorThemes(): EditorThemesList {
  return { themes: cached, invalidNames: cachedInvalidNames }
}

export function updateEditorThemes(list: EditorThemesList): void {
  cached = list.themes
  cachedInvalidNames = list.invalidNames
}

export async function loadEditorThemesFromMain(): Promise<void> {
  const result = await window.api.getEditorThemes()
  if (result.ok) updateEditorThemes(result.value)
}


export function paletteForMode(theme: EditorThemeDefinition, mode: 'light' | 'dark'): EditorColors {
  return mode === 'dark' ? theme.dark : theme.light
}

export interface ResolvedEditorAppearance {
  /** The resolved definition's name, or null when nothing matched. */
  definitionName: string | null
  palette: EditorColors
  typeface: string
}


export function resolveEditorAppearance(
  name: string,
  mode: 'light' | 'dark',
  themes: EditorThemeDefinition[]
): ResolvedEditorAppearance {
  const definition = themes.find((theme) => theme.name === name)
  if (!definition) {
    return {
      definitionName: null,
      palette: EMERGENCY_EDITOR_THEME.light,
      typeface: EMERGENCY_EDITOR_THEME.typeface
    }
  }
  return {
    definitionName: definition.name,
    palette: paletteForMode(definition, mode),
    typeface: definition.typeface
  }
}
