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

// Windows PowerShell 5.1's Move-Item fails past 260 characters, which
// transcripts in deep project folders pass; .NET with the \\?\ prefix does
// not. Nothing is overwritten: a file already at the destination stops it.
const longPath = (p: string) => `\\\\?\\${p.replace(/\//g, '\\')}`

export function moveScript(from: string, toDir: string): Script {
  const name = from.replace(/[\\/]+$/, '').split(/[\\/]/).pop() ?? ''
  const dest = `${toDir.replace(/[\\/]+$/, '')}/${name}`

  return {
    ps:
      `$ErrorActionPreference='Stop'; ` +
      `$from=${psLiteral(longPath(from))}; $dest=${psLiteral(longPath(dest))}; ` +
      `[IO.Directory]::CreateDirectory(${psLiteral(longPath(toDir))}) | Out-Null; ` +
      `if ([IO.File]::Exists($dest) -or [IO.Directory]::Exists($dest)) { throw 'already exists at the destination' }; ` +
      `if ([IO.Directory]::Exists($from)) { [IO.Directory]::Move($from, $dest) } else { [IO.File]::Move($from, $dest) }`,
    sh: ['sh', '-c', 'mkdir -p "$1" && [ ! -e "$1/$(basename "$2")" ] && mv "$2" "$1"/', 'sh', toDir, from],
  }
}

// A failed move's error, in words a person can act on.
export function moveFailure(raw: string): string {
  // PowerShell run with -EncodedCommand reports errors as CLIXML.
  const error = raw
    .replace('#< CLIXML', '')
    .replace(/_x000D__x000A_/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (/used by another process|being used|sharing violation/i.test(error)) return 'it is open in another window or app; close it there first'
  if (/already exists/i.test(error)) return 'a file with that name is already there'
  if (/could not find|does not exist|cannot find/i.test(error)) return 'its file is no longer where it was'
  if (/denied/i.test(error)) return 'Windows denied access to it'

  return error.split('\n')[0]?.slice(0, 120) || 'the move failed'
}

export function removeScript(dir: string): Script {
  return {
    ps: `$ErrorActionPreference='Stop'; [IO.Directory]::Delete(${psLiteral(longPath(dir))}, $true)`,
    sh: ['sh', '-c', 'rm -rf "$1"', 'sh', dir],
  }
}

export function olderThan(list: readonly PastSession[], days: number, now: number): PastSession[] {
  const cutoff = now - days * 86_400_000

  return list.filter(s => !s.isLive && s.mtimeMs < cutoff)
}
