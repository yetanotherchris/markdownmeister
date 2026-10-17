declare function notarizeMacos(context: {
  electronPlatformName: string
  appOutDir: string
  packager: { appInfo: { productFilename: string } }
}): Promise<void>

declare namespace notarizeMacos {
  function missingEnvironment(environment: NodeJS.ProcessEnv): string[]
}

export = notarizeMacos
