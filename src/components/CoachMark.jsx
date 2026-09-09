// CoachMark — the small gold dot that marks Coach's presence: on the pill
// (Chat.jsx's minimized-panel affordance) and beside Coach's own turns in
// the transcript. One component so a future avatar replaces the marker in a
// single place instead of two independently-drifting inline spans (logged
// in Output/reimagine-future-enhancements.md under Later, 2026-09-09).
//
// API: <CoachMark C={colorTokens} size={8} animated={false} style={{}}/>
//   animated plays the same pulse the "Coach is thinking" indicator uses;
//   callers that need that motion pass it rather than duplicating the
//   keyframe. size/style let a caller adjust placement (e.g. marginTop to
//   align with a text baseline) without reaching into the marker's own
//   shape or color.
export default function CoachMark({ C, size = 8, animated = false, style = {} }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-block', flexShrink: 0,
        width: size, height: size, borderRadius: '50%',
        background: C.gold,
        animation: animated ? 'pe-chat-thinking-dot 1.1s ease-in-out infinite' : undefined,
        ...style,
      }}
    />
  )
}
