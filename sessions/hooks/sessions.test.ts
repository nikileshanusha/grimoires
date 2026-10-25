import { expect, test } from 'claude-code/testing'

import type { Session } from '../types'
import { parseSessions } from './register'

test('parseSessions unescapes paths, falls back on a title and sorts newest first', async () => {
  // As the listing script prints them: fields JSON-escaped, CRLF, a blank line.
  const stdout = [
    String.raw`aaaa|2026-10-22T13:57:01+05:30|1048576|C:\\Users\\N\\Desktop\\gnp_data|Female \u00d7 Among | spec`,
    '',
    String.raw`bbbb|2026-10-25T20:00:00+05:30|10|C:\\Users\\N|`,
  ].join('\r\n')

  const [newest, older] = parseSessions(stdout) as [Session, Session]
  expect(newest.id).toBe('bbbb')
  expect(newest.title).toBe('(untitled)')
  expect(older.cwd).toBe(String.raw`C:\Users\N\Desktop\gnp_data`)
  expect(older.title).toBe('Female × Among | spec')
  expect(older.bytes).toBe(1048576)
})
