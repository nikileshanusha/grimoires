import type { PastSession } from '../types'

// Pure command builders for moving transcripts in and out of the trash;
// register.tsx runs them.

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

function base64(bytes: Uint8Array): string {
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0)
    out += B64.charAt((n >> 18) & 63) + B64.charAt((n >> 12) & 63)
    out += i + 1 < bytes.length ? B64.charAt((n >> 6) & 63) : '='
    out += i + 2 < bytes.length ? B64.charAt(n & 63) : '='
  }

  return out
}

// PowerShell's -EncodedCommand takes UTF-16LE: no quoting of paths through
// a command line, so a space or an apostrophe in a path is harmless.
export function encodePs(script: string): string {
  const bytes = new Uint8Array(script.length * 2)
  for (let i = 0; i < script.length; i++) {
    const code = script.charCodeAt(i)
    bytes[i * 2] = code & 0xff
    bytes[i * 2 + 1] = code >> 8
  }

  return base64(bytes)
}

const psLiteral = (s: string) => `'${s.replace(/'/g, "''")}'`

export type Script = { ps: string; sh: string[] }

export function moveScript(from: string, toDir: string): Script {
  return {
    ps:
      `$ErrorActionPreference='Stop'; New-Item -ItemType Directory -Force -Path ${psLiteral(toDir)} | Out-Null; ` +
      `Move-Item -LiteralPath ${psLiteral(from)} -Destination ${psLiteral(toDir)} -Force`,
    sh: ['sh', '-c', 'mkdir -p "$1" && mv -f "$2" "$1"/', 'sh', toDir, from],
  }
}

export function removeScript(dir: string): Script {
  return {
    ps: `$ErrorActionPreference='Stop'; Remove-Item -LiteralPath ${psLiteral(dir)} -Recurse -Force`,
    sh: ['sh', '-c', 'rm -rf "$1"', 'sh', dir],
  }
}

export function olderThan(list: readonly PastSession[], days: number, now: number): PastSession[] {
  const cutoff = now - days * 86_400_000

  return list.filter(s => !s.isLive && s.mtimeMs < cutoff)
}
