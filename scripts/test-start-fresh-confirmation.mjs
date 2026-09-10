// Batch item 8 (Output/handoff/2026-09-09_concierge-batch-and-phase4-brief.md,
// 2026-09-10 revision): Start Fresh (account deletion) used a browser-native
// window.confirm(); this replaces it with an in-app dialog. Cancel is the
// visual default (first, autoFocus); the destructive button reads "Delete my
// account"; the body text is unchanged from the brief's own quoted copy.
import fs from 'node:fs'

let failures = 0
const check = (ok, msg) => { if (!ok) { failures++; console.error(`  FAIL ${msg}`) } }

const APP = 'src/App.jsx'
const app = fs.readFileSync(APP, 'utf8')

// The old native confirm is gone from deleteAccount.
check(!app.includes("window.confirm('This permanently deletes your profile"),
  `${APP}: deleteAccount still shows a window.confirm() instead of the in-app dialog`)

// New modal state.
check(app.includes('const[startFreshModal,setStartFreshModal]=useState(false)'),
  `${APP}: startFreshModal state is missing`)

// The dialog itself: exact body copy from the brief, Cancel first with
// autoFocus (the "Cancel is the default" requirement), destructive button
// labeled "Delete my account" and visually distinct from the rest of the
// button set.
const modalIdx = app.indexOf('{startFreshModal&&<div')
check(modalIdx !== -1, `${APP}: the startFreshModal dialog is missing`)
const modalBlock = modalIdx !== -1 ? app.slice(modalIdx, modalIdx + 1200) : ''
check(modalBlock.includes('role="dialog"') && modalBlock.includes('aria-modal="true"'),
  `${APP}: the Start Fresh dialog is not marked as an accessible modal dialog`)
check(modalBlock.includes('This permanently deletes your profile, outputs, saved playbooks, and chat history. You can sign back in with the same email to start over.'),
  `${APP}: the dialog body text has drifted from the brief's exact copy`)
check(/<Btn secondary autoFocus onClick=\{\(\)=>setStartFreshModal\(false\)\}>Cancel<\/Btn>/.test(modalBlock),
  `${APP}: Cancel is not the first, auto-focused button in the dialog`)
check(/<Btn onClick=\{\(\)=>\{setStartFreshModal\(false\);deleteAccount\(\)\}\} style=\{\{background:C\.err,color:'#FFFFFF'\}\}>Delete my account<\/Btn>/.test(modalBlock),
  `${APP}: the destructive "Delete my account" button is missing, mislabeled, or not visually distinct`)

// Btn forwards arbitrary native props (autoFocus among them) -- needed for
// the dialog's Cancel button above to actually receive focus.
check(app.includes('function Btn({onClick,disabled,secondary,small,prominent,children,style={},...rest}){'),
  `${APP}: Btn no longer forwards arbitrary props (...rest) -- autoFocus on Cancel would be silently dropped`)
check(app.includes('onClick={onClick} disabled={disabled} {...rest}>{children}</button>'),
  `${APP}: Btn's underlying <button> no longer spreads ...rest -- forwarded props would not reach the DOM node`)

// All three trigger sites open the dialog instead of calling deleteAccount()
// directly: the account-menu item, the Welcome screen's "Or start fresh"
// link, and the ?reset=1 URL-triggered path.
check(app.includes("onClick={()=>{setAccountMenuOpen(false);setStartFreshModal(true)}} title=\"Delete your profile and start over from scratch\""),
  `${APP}: the account-menu "Start Fresh" item no longer opens the confirmation dialog`)
check(app.includes('{signedInUser&&<button onClick={()=>setStartFreshModal(true)} style='),
  `${APP}: the Welcome screen's "Or start fresh" link no longer opens the confirmation dialog`)
check(app.includes("window.history.replaceState({},'',newUrl);setStartFreshModal(true)},[signedInUser])"),
  `${APP}: the ?reset=1 URL-triggered path no longer opens the confirmation dialog (it would otherwise call deleteAccount() with no confirmation of any kind now that the native confirm is gone)`)

// deleteAccount itself is now the direct action (no confirmation of its own)
// -- it must still keep the deletingRef guard and the actual delete request.
check(app.includes('const deleteAccount=async()=>{') && app.includes("const r=await fetch('/api/account/delete',{method:'POST',credentials:'include'})"),
  `${APP}: deleteAccount no longer performs the actual delete request`)

if (failures) {
  console.error(`test-start-fresh-confirmation: ${failures} check(s) failed`)
  process.exit(1)
} else {
  console.log('test-start-fresh-confirmation: OK (window.confirm replaced by an in-app dialog; Cancel is the first, auto-focused button; "Delete my account" is the visually-distinct destructive action; Btn forwards arbitrary props so autoFocus actually reaches the DOM; all three trigger sites -- account menu, Welcome screen link, ?reset=1 URL path -- open the dialog instead of deleting unconditionally; deleteAccount is now the dialog-only action, unchanged in what it actually does)')
}
