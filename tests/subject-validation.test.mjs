import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { createServer } from 'vite'

const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
const { validateSubject, normalizeSubjectText } = await server.ssrLoadModule('/src/utils/subjectValidation.ts')
after(() => server.close())
const fields = { name: 'Lập trình C++ (cơ bản)', code: '', credits: '3', teacher: '', semesterId: '11' }
const semesters = [{ id: '11' }, { id: '12' }]
const check = (changes = {}, subjects = [], editing = '') => validateSubject({ ...fields, ...changes }, semesters, subjects, editing)

test('required fields and legitimate Vietnamese course punctuation', () => {
  assert.deepEqual(check(), {})
  for (const name of ['C++', 'C#', 'Toán 1', 'Cơ sở dữ liệu - SQL', 'Kỹ thuật & công nghệ', 'Lập trình .NET', 'A/B: phần 1']) assert.deepEqual(check({ name }), {}, name)
  for (const name of ['', '   ', 'A', '123', '+++', '<script>', 'Môn @@@', 'Môn 😀', 'Môn\nA', 'Môn\u200bA', 'A'.repeat(201)]) assert(check({ name }).name, name)
  assert(check({ semesterId: '' }).semesterId)
  assert(check({ semesterId: '999' }).semesterId)
})
test('optional codes and required credits reject malformed and out of range values', () => {
  for (const code of ['', 'cs01', 'CS-01', 'CS_01.2']) assert.equal(check({ code }).code, undefined)
  for (const code of ['CS 01', 'CS@01', '-CS', 'CS-', 'CS..01', 'MÔN01', 'X'.repeat(51)]) assert(check({ code }).code, code)
  for (const credits of ['1', '30']) assert.equal(check({ credits }).credits, undefined)
  for (const credits of ['', ' ', '0', '-1', '31', '1.5', '1e1', 'Infinity', 'NaN', 'abc', '999999999999999999999']) assert(check({ credits }).credits, credits)
})
test('teacher names accept accents and titles but reject numbers and markup', () => {
  for (const teacher of ['', 'PGS. TS. Nguyễn Văn An', "O'Connor", 'Jean-Luc', 'Nguyễn Văn An (TS.)']) assert.equal(check({ teacher }).teacher, undefined)
  for (const teacher of ['A', '123', 'An123', '<b>An</b>', 'An 😀', 'An\nB', 'X'.repeat(201)]) assert(check({ teacher }).teacher, teacher)
})
test('duplicates normalize whitespace, case and Unicode; editing self and other semesters remain valid', () => {
  const subject = { id: '1', semesterId: '11', name: 'Cơ sở dữ liệu', code: 'CS-01' }
  assert(check({ name: '  cơ   SỞ dữ liệu '.normalize('NFD') }, [subject]).name)
  assert(check({ code: ' cs-01 ' }, [subject]).code)
  assert.deepEqual(check({ name: subject.name, code: subject.code }, [subject], '1'), {})
  assert.deepEqual(check({ name: subject.name, code: subject.code, semesterId: '12' }, [subject]), {})
  assert.equal(normalizeSubjectText('  Cơ   sở '.normalize('NFD')), 'Cơ sở')
})
