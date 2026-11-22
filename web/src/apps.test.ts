import assert from 'node:assert/strict'
import { test } from 'node:test'
import { safeNext } from './apps.ts'

test('sends people back only to the apps', () => {
  assert.equal(safeNext('https://structura-web.netlify.app/topic/rate-limiter/?read')?.app.id, 'structura')
  assert.equal(safeNext('https://deploy-preview-115--structura-web.netlify.app/')?.app.id, 'structura')
  assert.equal(safeNext('https://schemata.studia.dev/questions/revenue-by-category')?.app.id, 'schemata')
  assert.equal(safeNext('https://dsa-atz.netlify.app/?page=problems')?.app.id, 'dsa-atlas')
  assert.equal(safeNext('https://evil.example.com/'), null)
  assert.equal(safeNext('https://structura-web.netlify.app.evil.com/'), null)
  assert.equal(safeNext('http://structura-web.netlify.app/'), null)
  assert.equal(safeNext('javascript:alert(1)'), null)
  assert.equal(safeNext('https://user:pass@structura-web.netlify.app/'), null)
  assert.equal(safeNext('not a url'), null)
  assert.equal(safeNext(null), null)
})

test('localhost only while Studia itself runs locally', () => {
  assert.equal(safeNext('http://localhost:5173/'), null)
  assert.ok(safeNext('http://localhost:5173/', true))
})
