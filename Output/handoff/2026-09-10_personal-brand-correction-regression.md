Prompt for Code
Urgent, ungated, ahead of everything else in the batch. Save this file verbatim to Output/handoff/2026-09-10_personal-brand-correction-regression.md, then fix it. Standing rules: reproduce to the symptom first, trace the path in the PR, run it in a browser on the preview, adversarial second look. Report PR URL and merge SHA. No Coach copy is involved.




Date: 2026-09-10 Type: Production regression, Personal Brand correction path ("Does this feel right?") Build: 629f044 (identical to aed414a for app code) Source: Bob's Part L run on the Lindsey account, test L3, verbatim in the master log (Concierge test feedback log, "Regenerated Personal Brand from L2" at the end of the Doc; the correction text quoted there is L3's).
What happened
On the Personal Brand screen, Bob typed one sentence into "Does this feel right?": "agree that my background points towards mid-size organizations, I am very interested in increasing the scope of my responsibilities to do this at larger scale." The expected result is a change to the one passage about organization size.

What came back was a rewritten brand: the "Your update is in" panel reported "Here are the 21 new lines," and the "Also worth a look" review listed 7 lines that changed wording and 27 lines that are gone, each with its own "Put it back" button. Three stat tiles on the page went to "n/a" (the $4.8M total rewards refresh, the six-point voluntary turnover drop, the 76% placement rate in the claims restructure). Passages that disappeared include the Continental mental health benefit expansion, the DEI function built from nothing, the CFO/partners exchange ("presented as a leadership choice rather than as an HR ask... They accepted it unanimously"), and the M&A / scaling / client-facing paragraphs that named specific sectors.

Bob's verdict: "This is a disaster and needs to be fixed ASAP."
What must be true

1. A correction changes what the correction is about and nothing else. One sentence about scale produces one changed passage (the "mid-size... larger scale" lines in Where You Thrive) and leaves every other line byte-identical.
2. A correction can never remove a number, a named program, or a proof point that was in the previous version. If the model's rewrite drops any of them, the rewrite is rejected and re-run with the dropped items named, or the previous text is kept for those passages.
3. The "Also worth a look" review is for a handful of incidental changes. If it would list more than a few, the correction has failed rule 1 and should not be shown as "Your update is in."

Do this

* Reproduce first: on a test account with a built brand, submit the same one-sentence correction and capture the before/after diff. Confirm the wholesale rewrite.
* Trace the correction path (the rework prompt for p3, how the previous text is passed, whether the model is asked to edit in place or to regenerate). Say in the PR which it is today and why the result was a regeneration.
* Fix so the model edits in place: previous text supplied in full, instruction to return the full text with only the passages the correction touches changed, and a server-side check that (a) every numeric token and every capitalized program/company name in the previous version is still present, and (b) the changed-line count is small (pick a threshold and state it). On failure, retry once with the missing items named; on second failure, keep the previous text for the untouched passages and apply only the passage the correction names.
* Stat tiles: derive from the text as today, but never render "n/a" for a tile whose value existed in the previous version; keep the previous value if the new text lost it.
* Check the same path for the other places "Does this feel right?" or "Did we get this wrong?" boxes exist (Focus sections, Opportunity cards, Compensation): same correction mechanism, same risk. Report whether they share the code.
* Browser test on the preview: build brand, correct one sentence, assert the diff touches only the target passage and all numbers survive.

Also, while you're in there
The "Also worth a look" review flags lines whose wording changed by a word or two ("no longer says 'together'") alongside lines that are gone. That review is noise at this volume; once rule 1 holds it should rarely show more than one or two items. No redesign needed, just confirm it behaves once the correction path is fixed.
Report
PR URL and merge SHA; the before/after diff from the reproduction; the path as traced; the threshold chosen; which other correction boxes share the mechanism; the browser test name.
