// Unit tests for src/playbook-refresh.mjs — ordering and the sequential runner
// behind "Bring my playbook up to date".
import { orderForRefresh, runRefresh, REFRESH_ORDER } from '../src/playbook-refresh.mjs'

let passed = 0
const fail = (msg) => { console.error('FAIL: ' + msg); process.exitCode = 1 }
const ok = (cond, msg) => { if (cond) passed++; else fail(msg) }
const eq = (a, b, msg) => ok(JSON.stringify(a) === JSON.stringify(b), `${msg} — got ${JSON.stringify(a)}, wanted ${JSON.stringify(b)}`)

// Ordering: the dependencies are the whole point.
eq(orderForRefresh(['income', 'p6']), ['p6', 'income'], 'Bridge Story runs before Income Now')
eq(orderForRefresh(['p11', 'p6']), ['p6', 'p11'], 'Bridge Story runs before Interview Prep')
eq(orderForRefresh(['income', 'p8']), ['p8', 'income'], 'LinkedIn Remix runs before Income Now')
eq(orderForRefresh(['income', 'p11', 'p8', 'p6']), ['p6', 'p8', 'p11', 'income'], 'a full chain sorts end to end')
eq(orderForRefresh([]), [], 'nothing to do is not an error')
eq(orderForRefresh(['p5']), ['p5'], 'a single section is left alone')
eq(orderForRefresh(['zzz', 'p6']), ['p6', 'zzz'], 'an unrecognised section runs last rather than being dropped')
eq(orderForRefresh(['zzz', 'yyy']), ['zzz', 'yyy'], 'unrecognised sections keep their arrival order')
eq(orderForRefresh(null), [], 'a non-array is not an error')
ok(REFRESH_ORDER.indexOf('p6') < REFRESH_ORDER.indexOf('p11'), 'the order itself puts p6 before p11')
ok(REFRESH_ORDER.indexOf('p8') < REFRESH_ORDER.indexOf('income'), 'the order itself puts p8 before income')

// The runner: sequential, in order, and it reports honestly.
const run = async () => {
  const seen = []
  const res = await runRefresh(['income', 'p6', 'p5'], async (id) => { seen.push(id) })
  eq(seen, ['p6', 'p5', 'income'], 'sections rebuild in dependency order')
  eq(res.done, ['p6', 'p5', 'income'], 'every section is reported done')
  eq(res.failed, [], 'nothing failed')
  eq(res.total, 3, 'total counts the queue')

  // One failure does not take the rest down.
  const seen2 = []
  const res2 = await runRefresh(['p6', 'p5', 'p11'], async (id) => {
    seen2.push(id)
    if (id === 'p5') throw new Error('that came back empty')
  })
  eq(seen2, ['p6', 'p5', 'p11'], 'a failure does not stop the queue')
  eq(res2.done, ['p6', 'p11'], 'the successes are reported')
  eq(res2.failed, [{ id: 'p5', message: 'that came back empty' }], 'the failure is named with its reason')

  // A thrown non-Error still reports something usable.
  const res3 = await runRefresh(['p5'], async () => { throw 'nope' })
  eq(res3.failed, [{ id: 'p5', message: 'Generation failed' }], 'a non-Error failure gets a default message')

  // Sequencing is real: no section starts before the previous one finishes.
  let inFlight = 0
  let overlapped = false
  await runRefresh(['p6', 'p5', 'p11'], async () => {
    inFlight++
    if (inFlight > 1) overlapped = true
    await new Promise((r) => setTimeout(r, 5))
    inFlight--
  })
  ok(!overlapped, 'sections never run concurrently')

  // Progress reporting, and a broken progress handler cannot break the run.
  const steps = []
  const res4 = await runRefresh(['p6', 'p5'], async () => {}, { onStep: (s) => steps.push(`${s.phase}:${s.id}:${s.index}/${s.total}`) })
  eq(steps, ['start:p6:0/2', 'end:p6:0/2', 'start:p5:1/2', 'end:p5:1/2'], 'progress reports each start and end with position')
  eq(res4.done, ['p6', 'p5'], 'progress does not disturb the result')
  const res5 = await runRefresh(['p5'], async () => {}, { onStep: () => { throw new Error('bad handler') } })
  eq(res5.done, ['p5'], 'a throwing progress handler does not fail the run')

  console.log(`test-playbook-refresh: OK (${passed} cases passed)`)
}

run()
