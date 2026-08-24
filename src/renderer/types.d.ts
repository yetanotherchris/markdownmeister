import type { DesktopApi } from '../shared/ipc-contract'

declare global {
  interface Window {
    api: DesktopApi
  }
}


declare module '*?raw' {
  const content: string
  export default content
}

export {}
