# Reimagine — Future Enhancements

Ideas and deferred work worth remembering, not yet scoped into a brief. Not part of the build; this is a running note, not a commitment.

---

## Later

- **CoachMark avatar (2026-09-09).** `CoachMark` (`src/components/CoachMark.jsx`) currently renders Coach's presence as a small gold dot — used on the My Coach minimized pill and beside Coach's own turns in the transcript. If Coach ever gets a real avatar (an icon, a small illustration), this is the one place to swap it: both call sites already go through this component, so the change is local rather than a hunt through `Chat.jsx` for every inline dot. No design direction chosen yet — flagging the seam, not the shape.
