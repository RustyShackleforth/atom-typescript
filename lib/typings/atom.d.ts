declare module "atom" {
  interface ConfigValues {
    "atom-typescript.unusedAsInfo": boolean
  }

  interface TextBuffer {
    emitDidStopChangingEvent(): void
    destroy(): void
  }

  interface TextEditor {
    isDestroyed(): boolean
  }

  interface PackageManager {
    activatePackage(name: string): Promise<Package>
  }
}
