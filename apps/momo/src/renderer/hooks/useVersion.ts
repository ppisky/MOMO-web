import { useEffect, useState } from 'react'
import platform from '@/platform'

export default function useVersion() {
  const [version, setVersion] = useState('')
  useEffect(() => {
    void platform.getVersion().then(setVersion)
  }, [])
  return {
    version,
    versionLoaded: Boolean(version),
    isExceeded: false,
    isExceededResolved: true,
    needCheckUpdate: false,
  }
}

export function isFirstDay(): boolean {
  return false
}
