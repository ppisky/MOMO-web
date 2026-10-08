const FILE_NATIVE_PATH_PROPERTY = '__chatboxNativePath'

type FileWithRememberedNativePath = File & {
  [FILE_NATIVE_PATH_PROPERTY]?: string
}

export function rememberFileNativePath(file: File, nativePath: string): string {
  if (nativePath) {
    Object.defineProperty(file, FILE_NATIVE_PATH_PROPERTY, {
      value: nativePath,
      configurable: true,
    })
  }
  return nativePath
}

export function getBestEffortFileNativePath(file: File): string {
  const remembered = (file as FileWithRememberedNativePath)[FILE_NATIVE_PATH_PROPERTY]
  if (remembered) return remembered
  // Electron 44 removed File.path; desktop paths now come from preload webUtils.
  return 'path' in file && typeof file.path === 'string' ? file.path : ''
}
