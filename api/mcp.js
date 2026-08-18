// Reimagine MCP connector (phase-2). A Streamable-HTTP JSON-RPC MCP server that
// a user's assistant adds as a connector. Authenticated by the user's push token
// (Authorization: Bearer <token>) — the same per-user token minted by
// api/push-token.js and resolved by its SHA-256 hash against users.push_token_hash.
//
// Two tools, scoped to the authenticated user:
//   - list_pursuits   : read their Opportunity Playbooks (record ids + titles) and
//                       current status, so the assistant can MATCH mail/calendar to
//                       the right opportunity and knows the id to write back.
//   - update_pursuit  : write one opportunity's status (stage / next conversation /
//                       next move / closed / outcome). Upsert; update-only fields.
//
// Design guarantees for a trustworthy connector:
//   - The assistant can only address opportunities that already exist (ids come
//     from list_pursuits); it never invents records.
//   - Writes land in pursuit_status, never in the profile_state blob (no clobber).
//   - Everything is scoped by the token's user; no cross-user access.
//
// NOTE: auth is bearer-token via the Authorization header. Whether a given MCP
// client (e.g. claude.ai custom connectors) can supply that header vs. requiring
// OAuth is a client-side question to verify live; OAuth is a later addition.

import crypto from 'node:crypto'
import { sql } from './_lib/db.js'
import { stripNul } from './_lib/strip-nul.js'
import { baseUrl } from './_lib/oauth.js'

const PROTOCOL_VERSION = '2025-06-18'
const SERVER_INFO = { name: 'Reimagine', version: '1.0.0' }

const VALID_STAGES = new Set(['researching', 'applied', 'in_conversation', 'interviewing', 'offer', 'closed'])
const VALID_IV_ROLES = new Set(['hiring_manager', 'skip_level', 'peer', 'cross_functional', 'recruiter_screen'])
const VALID_OUTCOMES = new Set(['accepted', 'declined', 'not_selected', 'withdrew', 'no_response'])

const TOOLS = [
  {
    name: 'list_pursuits',
    description: "List the user's active Opportunity Playbooks (the jobs they're pursuing) with each one's record_id, title, and current tracked status. Call this FIRST to learn which opportunities exist and their ids before updating anything. Match emails/calendar events to these by company and role; never invent an opportunity that is not in this list.",
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'update_pursuit',
    description: "Update the tracked status of ONE existing opportunity (identified by a record_id from list_pursuits). Only set fields you have real evidence for from the user's mail/calendar; omit fields you do not know. Never guess a stage. Keep the two dates distinct: next_conversation_at is a real MEETING on the calendar; next_step_at is a self-reminder for the user's next action, not an appointment. Use situation_note for a short state-of-play drawn from what you actually read.",
    inputSchema: {
      type: 'object',
      properties: {
        record_id: { type: 'string', description: 'The opportunity id from list_pursuits.' },
        stage: { type: 'string', enum: [...VALID_STAGES], description: 'Where the pursuit stands.' },
        next_conversation_at: { type: 'string', description: 'ISO 8601 timestamp of the next scheduled MEETING — a real event on the calendar (interview, screen, call). Set this ONLY from an actual calendar event; null to clear. Never put a self-reminder here.' },
        next_move: { type: 'string', description: 'The next step the user will take (the text of "My Next Steps"), e.g. "send a follow-up note". Pairs with next_step_at. null to clear.' },
        next_step_at: { type: 'string', description: 'ISO 8601 date for the user\'s next action (their "My Next Steps" date) — a follow-up / prep / outreach reminder, NOT a scheduled meeting. null to clear.' },
        situation_note: { type: 'string', description: 'A short (<=280 chars) plain-language "state of play" for this opportunity, composed ONLY from what you actually read in the user\'s mail/calendar: the latest development and/or who they are waiting on and since when (e.g. "Recruiter said a decision by Fri Aug 22; waiting to hear." or "They have rescheduled the panel twice."). Real, sourced facts only — never speculation, and never infer that the employer went silent or is slow beyond what a message actually shows. Overwrites the previous note; null to clear.' },
        closed_at: { type: 'string', description: 'ISO 8601 timestamp the pursuit closed, or null.' },
        outcome: { type: 'string', enum: [...VALID_OUTCOMES], description: 'Outcome, meaningful only when stage is closed.' },
      },
      required: ['record_id'],
    },
  },
  {
    name: 'add_interviewers',
    description: "Add people the user will interview with — found on a real calendar invite or in email (attendees, a named panel) — to an opportunity's Interview Team. They appear as 'found by your assistant' suggestions the user adopts with one tap; they feed Interview Prep. Only add real people you actually found; never invent names. Check current_interviewers from list_pursuits first and do not re-add someone already on the team. Deduplicated automatically.",
    inputSchema: {
      type: 'object',
      properties: {
        record_id: { type: 'string', description: 'The opportunity id from list_pursuits.' },
        interviewers: {
          type: 'array',
          description: 'The people found for this opportunity.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: "The person's full name." },
              title: { type: 'string', description: 'Their role or title, if known.' },
              notes: { type: 'string', description: 'Optional short context you learned about them.' },
              role: { type: 'string', enum: [...VALID_IV_ROLES], description: 'How they fit the interview loop, if you can tell: hiring_manager, skip_level, peer, cross_functional, or recruiter_screen. Usually omit — a calendar invite rarely says.' },
            },
            required: ['name'],
          },
        },
      },
      required: ['record_id', 'interviewers'],
    },
  },
]

async function resolveUser(req) {
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  if (!bearer) return null
  const hash = crypto.createHash('sha256').update(bearer).digest('hex')
  // OAuth access token (the connector's normal path); fall back to the API push
  // token (Claude Code / scripts). Both resolve to a Reimagine user.
  let rows = await sql`
    SELECT u.id, u.feature_flags, u.suspended_at
    FROM oauth_tokens t JOIN users u ON u.id = t.user_id
    WHERE t.access_token_hash = ${hash} AND t.expires_at > NOW() LIMIT 1`
  if (rows.length === 0) {
    rows = await sql`SELECT id, feature_flags, suspended_at FROM users WHERE push_token_hash = ${hash} LIMIT 1`
  }
  const user = rows[0]
  if (!user) return null
  if (user.suspended_at) return null
  const flags = Array.isArray(user.feature_flags) ? user.feature_flags : []
  if (!flags.includes('my_search')) return null
  return user
}

async function toolListPursuits(user) {
  const rows = await sql`SELECT profile_state FROM users WHERE id = ${user.id}::uuid LIMIT 1`
  const profile = (rows[0] && rows[0].profile_state) || {}
  const saved = Array.isArray(profile.savedPlaybooks) ? profile.savedPlaybooks.filter(r => r && !r.archivedAt) : []
  const door2 = saved.filter(r => r && r.source === 'door2' && r.id)

  const statusRows = await sql`SELECT record_id, stage, next_conversation_at, next_step_at, next_move, situation_note, closed_at, outcome, updated_at FROM pursuit_status WHERE user_id = ${user.id}::uuid`
  const byId = new Map(statusRows.map(s => [s.record_id, s]))

  return door2.map(r => {
    const s = byId.get(r.id) || {}
    return {
      record_id: r.id,
      title: r.title || r.company || 'Opportunity',
      company: r.company || null,
      role: r.role || null,
      stage: s.stage || null,
      current_interviewers: (Array.isArray(r.panel && r.panel.interviewers) ? r.panel.interviewers : []).map(i => i && i.name).filter(Boolean),
      next_conversation_at: s.next_conversation_at || null,
      next_step_at: s.next_step_at || null,
      next_move: s.next_move || null,
      situation_note: s.situation_note || null,
      closed_at: s.closed_at || null,
      outcome: s.outcome || null,
    }
  })
}

async function toolUpdatePursuit(user, args) {
  const recordId = args && typeof args.record_id === 'string' ? args.record_id.trim() : ''
  if (!recordId) throw new Error('record_id is required')

  // Confirm the id belongs to one of the user's Door 2 records — the connector
  // can only touch opportunities that exist, never invent one.
  const rows = await sql`SELECT profile_state FROM users WHERE id = ${user.id}::uuid LIMIT 1`
  const profile = (rows[0] && rows[0].profile_state) || {}
  const saved = Array.isArray(profile.savedPlaybooks) ? profile.savedPlaybooks.filter(r => r && !r.archivedAt) : []
  const exists = saved.some(r => r && r.source === 'door2' && r.id === recordId)
  if (!exists) throw new Error('record_id does not match any of your opportunities')

  const has = k => Object.prototype.hasOwnProperty.call(args, k)
  const patch = {}
  if (has('stage')) {
    if (args.stage !== null && !VALID_STAGES.has(args.stage)) throw new Error('invalid stage')
    patch.stage = args.stage
  }
  if (has('outcome')) {
    if (args.outcome !== null && !VALID_OUTCOMES.has(args.outcome)) throw new Error('invalid outcome')
    patch.outcome = args.outcome
  }
  if (has('next_move')) patch.next_move = args.next_move === null ? null : stripNul(String(args.next_move)).slice(0, 2000)
  if (has('situation_note')) patch.situation_note = args.situation_note === null ? null : stripNul(String(args.situation_note)).slice(0, 280)
  if (has('next_conversation_at')) patch.next_conversation_at = parseTs(args.next_conversation_at)
  if (has('next_step_at')) patch.next_step_at = parseTs(args.next_step_at)
  if (has('closed_at')) patch.closed_at = parseTs(args.closed_at)
  if (Object.keys(patch).length === 0) throw new Error('no status fields provided')

  // Read-merge-write so an update of one field never clears the others.
  const existing = await sql`SELECT stage, next_conversation_at, next_step_at, next_move, situation_note, closed_at, outcome FROM pursuit_status WHERE user_id = ${user.id}::uuid AND record_id = ${recordId} LIMIT 1`
  const prev = existing[0] || {}
  const stage = has('stage') ? patch.stage : (prev.stage ?? null)
  const nca = has('next_conversation_at') ? patch.next_conversation_at : (prev.next_conversation_at ?? null)
  const nsa = has('next_step_at') ? patch.next_step_at : (prev.next_step_at ?? null)
  const nextMove = has('next_move') ? patch.next_move : (prev.next_move ?? null)
  const situationNote = has('situation_note') ? patch.situation_note : (prev.situation_note ?? null)
  const closedAt = has('closed_at') ? patch.closed_at : (prev.closed_at ?? null)
  const outcome = has('outcome') ? patch.outcome : (prev.outcome ?? null)

  await sql`
    INSERT INTO pursuit_status (user_id, record_id, stage, next_conversation_at, next_step_at, next_move, situation_note, closed_at, outcome, updated_at)
    VALUES (${user.id}::uuid, ${recordId}, ${stage}, ${nca}, ${nsa}, ${nextMove}, ${situationNote}, ${closedAt}, ${outcome}, NOW())
    ON CONFLICT (user_id, record_id)
    DO UPDATE SET stage = EXCLUDED.stage, next_conversation_at = EXCLUDED.next_conversation_at,
                  next_step_at = EXCLUDED.next_step_at,
                  next_move = EXCLUDED.next_move, situation_note = EXCLUDED.situation_note,
                  closed_at = EXCLUDED.closed_at,
                  outcome = EXCLUDED.outcome, updated_at = NOW()
  `
  return { ok: true, record_id: recordId }
}

async function toolAddInterviewers(user, args) {
  const recordId = args && typeof args.record_id === 'string' ? args.record_id.trim() : ''
  if (!recordId) throw new Error('record_id is required')
  const incoming = Array.isArray(args.interviewers) ? args.interviewers : []
  if (incoming.length === 0) throw new Error('interviewers is required')

  const rows = await sql`SELECT profile_state FROM users WHERE id = ${user.id}::uuid LIMIT 1`
  const profile = (rows[0] && rows[0].profile_state) || {}
  const saved = Array.isArray(profile.savedPlaybooks) ? profile.savedPlaybooks.filter(r => r && !r.archivedAt) : []
  const rec = saved.find(r => r && r.source === 'door2' && r.id === recordId)
  if (!rec) throw new Error('record_id does not match any of your opportunities')

  // Dedup against who is already on the panel and who is already staged.
  const onPanel = new Set((rec.panel && Array.isArray(rec.panel.interviewers) ? rec.panel.interviewers : []).map(i => String((i && i.name) || '').trim().toLowerCase()).filter(Boolean))
  const stagedRows = await sql`SELECT name FROM pursuit_interviewers WHERE user_id = ${user.id}::uuid AND record_id = ${recordId}`
  const staged = new Set(stagedRows.map(r => String(r.name || '').trim().toLowerCase()))

  let added = 0
  let skipped = 0
  for (const iv of incoming) {
    const name = iv && typeof iv.name === 'string' ? stripNul(iv.name).trim().slice(0, 200) : ''
    if (!name) { skipped++; continue }
    const key = name.toLowerCase()
    if (onPanel.has(key) || staged.has(key)) { skipped++; continue }
    staged.add(key)
    const title = iv.title ? stripNul(String(iv.title)).trim().slice(0, 200) : null
    const notes = iv.notes ? stripNul(String(iv.notes)).trim().slice(0, 1000) : null
    const role = (iv.role && VALID_IV_ROLES.has(iv.role)) ? iv.role : null
    const id = 'sv_' + crypto.randomBytes(8).toString('hex')
    await sql`INSERT INTO pursuit_interviewers (user_id, interviewer_id, record_id, name, title, notes, role)
              VALUES (${user.id}::uuid, ${id}, ${recordId}, ${name}, ${title}, ${notes}, ${role})`
    added++
  }
  return { added, skipped }
}

function parseTs(v) {
  if (v === undefined || v === null || v === '') return null
  const d = new Date(v)
  if (Number.isNaN(d.getTime())) throw new Error('invalid timestamp')
  return d.toISOString()
}

function rpcResult(id, result) { return { jsonrpc: '2.0', id, result } }
function rpcError(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } } }

export default async function handler(req, res) {
  // Streamable HTTP: we only implement the POST (client->server) direction and
  // reply with a single JSON response. No server-initiated SSE stream.
  if (req.method === 'GET') return res.status(405).json({ error: 'Method not allowed' })
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let msg = req.body
  if (typeof msg === 'string') { try { msg = JSON.parse(msg) } catch { return res.status(400).json({ error: 'invalid JSON' }) } }
  if (!msg || typeof msg !== 'object') return res.status(400).json({ error: 'invalid request' })

  const { id = null, method } = msg

  // Notifications (no id) — acknowledge with 202, no body.
  if (method && method.startsWith('notifications/')) return res.status(202).end()

  if (method === 'initialize') {
    return res.status(200).json(rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    }))
  }
  if (method === 'ping') return res.status(200).json(rpcResult(id, {}))

  // Everything past here needs a valid token.
  let user
  try {
    user = await resolveUser(req)
  } catch (err) {
    console.error('mcp: auth lookup failed', err)
    return res.status(500).json(rpcError(id, -32603, 'auth error'))
  }
  if (!user) {
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${baseUrl(req)}/.well-known/oauth-protected-resource"`)
    return res.status(401).json(rpcError(id, -32001, 'Unauthorized: connect this server via OAuth'))
  }

  if (method === 'tools/list') {
    return res.status(200).json(rpcResult(id, { tools: TOOLS }))
  }

  if (method === 'tools/call') {
    const name = msg.params && msg.params.name
    const args = (msg.params && msg.params.arguments) || {}
    try {
      let data
      if (name === 'list_pursuits') data = await toolListPursuits(user)
      else if (name === 'update_pursuit') data = await toolUpdatePursuit(user, args)
      else if (name === 'add_interviewers') data = await toolAddInterviewers(user, args)
      else return res.status(200).json(rpcError(id, -32602, `unknown tool: ${name}`))
      return res.status(200).json(rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(data) }] }))
    } catch (err) {
      // Tool errors are returned as a tool result with isError, per MCP.
      return res.status(200).json(rpcResult(id, { content: [{ type: 'text', text: `Error: ${err.message}` }], isError: true }))
    }
  }

  return res.status(200).json(rpcError(id, -32601, `method not found: ${method}`))
}
