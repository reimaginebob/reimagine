// Clips any message over 8,000 characters before My Coach's conversation is
// persisted to localStorage (2026-09-17 follow-up to PR #968's 300,000-byte
// paste cap and PR #969's file-upload GA): a single message can now carry up
// to 300,000 bytes, and with no clipping, a browser holding just a couple of
// large pastes or attached documents in its last 50 messages could push
// localStorage['reimagine_chat_history'] into the multi-hundred-KB range on
// every keystroke this effect re-runs. The full text always stays in
// chat_messages on the server; this only shrinks the client's own cached
// copy, which exists for fast reload, not as the source of truth.
export const CHAT_HISTORY_STORAGE_CLIP_CHARS = 8000
export function clipChatHistoryForStorage(messages) {
  return (Array.isArray(messages) ? messages : []).map(m => {
    if (!m || typeof m.content !== 'string' || m.content.length <= CHAT_HISTORY_STORAGE_CLIP_CHARS) return m
    return { ...m, content: m.content.slice(0, CHAT_HISTORY_STORAGE_CLIP_CHARS) + '\n\n[The rest of this message was a document shared earlier in the conversation.]' }
  })
}
