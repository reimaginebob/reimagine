# Consult: encouragement and challenge, the other half of Coach's affect handling

**For:** Code
**From:** Cowork research consult, checked against `api/coach.js`'s `SYSTEM_PROMPT_STABLE` and `CLAUDE.md`'s voice principles
**Date:** 2026-09-07

## Prompt for Code

Bob asked what the research says about balancing encouragement against pushing someone outside their comfort zone, and whether there's anything to lean on for training Coach to walk that line. The research across four separate fields converges on one shape, and it isn't a dial between the two. It's checked here against what Coach's system prompt actually does today, and the finding is concrete: Coach has a well-built, code-verified mechanism for the encouraging half and nothing built for the challenging half, and one of the product's own voice rules would currently block a direct version of it. This is a research consult, not a brief. It names the gap and the decision Bob and Code need to make about it; it doesn't propose specific prompt text.

## What the research actually says, across four fields

Sanford's "challenge and support" theory of student development, self-determination theory's account of the competence need, the Yerkes-Dodson relationship between arousal and performance, and the comfort/stretch/panic zone model used in workplace coaching all describe the same inverted-U shape from four independent traditions. Too little challenge produces boredom or stagnation. Too much produces overwhelm and a drop in performance. The peak sits at a point specific to that person's current skill and confidence, not at a level you set once. Sanford names the two failure modes directly: challenge without enough support leaves someone unable to cope, support without enough challenge removes the developmental opportunity. SDT frames it in motivational terms — a task too easy kills engagement because no real mastery is happening, a task too hard erodes the sense of competence the whole system depends on. The zone model adds a mechanism worth carrying forward on its own: comfort zones shrink when people avoid stretch for too long, so a coach that only ever reassures is not neutral, it can measurably narrow what someone can tolerate over time.

## The reframe that's actually useful for building something: two axes, not one dial

Kim Scott's Radical Candor work reframes the tension in a way that matters for design, not just diagnosis. Encouragement and challenge aren't opposite ends of a spectrum to average into a medium setting. They're two independent axes meant to both be pushed on at once. Her map names the specific failure a system optimizing for "positively engaged" drifts into by default: warmth without direct challenge is Ruinous Empathy, staying quiet or softening a hard truth because the moment shouldn't feel bad, well-intentioned and still worse for the person than a direct comment would have been. The fix for "too encouraging" in this frame isn't dialing encouragement down. It's confirming real challenge exists on top of it.

## What the newest evidence says about AI coaches specifically

A 2026 study on directiveness in AI coaching chatbots is a direct data point rather than an inference from human coaching. A directive bot, giving structured guidance and concrete next steps rather than open-ended questioning, outperformed a non-directive one on perceived usefulness, agreement on action steps, agreement on goals, and a trend toward better goal attainment — against the standing convention in professional human coaching, which leans non-directive on the theory that the client should arrive at their own answer. The authors attribute the gap to cognitive load: a concrete next step costs less mental effort than being questioned into finding one, especially in a short, text-based exchange with someone who isn't a domain expert. The real caveat: highly extraverted users still preferred the directive bot on usefulness, but rated it lower specifically on goal alignment, suggesting a text-only directive coach under-delivers on relational richness for people who need more of that texture. That argues for reading engagement style rather than assuming one directiveness level fits everyone, not for softening the challenge itself.

## What's actually in the code today: one well-built half

`SYSTEM_PROMPT_STABLE` has a real, considered mechanism for the encouraging half. The `DISCOURAGEMENT` block gives the model seven distinct angles for when someone is worn down (Name It and Tame It, Choose Your Attitude, Your Quota Is One, and four others), each with an exemplar showing register rather than a script to recite, each keyed to a specific emotional read rather than applied uniformly. That's genuinely good design: it matches the "read the moment, don't apply a fixed rule" requirement the research above actually calls for, just on one side of the line.

There is no equivalent for the other side. Every one of the seven angles answers "how do I keep going when this is hard." None of them are built to fire when someone is coasting, avoiding a next step they already know about, or has plateaued somewhere comfortable. And `CLAUDE.md`'s own voice principles currently contain a rule that would block a direct version of this if added as written: "Positive framing. Frame every step as a gain. Never set up the user's current state as deficient or in need of correction." Read literally, that rule and a real challenge mechanism are in tension. A genuine push, naming that someone's been avoiding the harder conversation, or that their target list hasn't moved in three weeks, requires being able to name a gap, which is close to the thing this rule was written to prevent (talking down to someone, implying they're behind). Resolving that tension, deciding whether "positive framing" means the steps forward stay framed as gains while an honest, direct read of where someone is stuck is still allowed, is the actual decision this consult surfaces. It isn't resolved here.

## A signal that may already exist

`api/coach.js` already computes something close to the moment a challenge mechanism would need to detect. Around line 736, the per-user context block includes: `'Nothing changed in their pipeline or activity since their last session — a quiet stretch, not a stalled one.'` That's the product already noticing when someone has gone quiet on their own search, and currently choosing to phrase it as reassurance rather than as an opening for a harder question. Whether this specific signal, or a variant of it (same lane held for N sessions, a known next step named and never acted on), is the right hook for a challenge mechanism is worth checking before building a new detection path from nothing.

## Recommendation

1. Treat this as a real gap to close, not a values debate to relitigate: Coach has a full, code-verified system for the encouraging half and none for the challenging half, and both this session's research and the product's own north-star document (delight requires honesty, "honest absence beats fabricated inclusion") point the same direction.
2. Resolve the tension with the existing "positive framing" rule explicitly, in words, before writing any new prompt block. Whatever the resolution, name it in `CLAUDE.md` so the next person reading that rule doesn't hit the same contradiction.
3. Design the challenge mechanism as a mirror of `DISCOURAGEMENT`'s own shape, a small set of angles keyed to a real read of the moment, exemplars rather than scripts, credited voice, not a single generic "you should push harder" instruction, since that structure is what already lets the encouraging half calibrate per person rather than apply uniformly.
4. Check whether the existing quiet-stretch signal at `api/coach.js` line ~736 is the right trigger before building a separate detection path.
5. Whatever ships, this stays subordinate to `ensureDistressSupport`, same as every other prompt-timing decision in this thread. A challenge mechanism must never fire into a moment the distress safety net should be handling instead.

## Verification

None yet, this is a research consult. Once something ships, the check that matters: does the challenge angle actually fire on a real plateau or avoidance signal rather than an arbitrary schedule, and does it read as direct rather than as criticism, the same register discipline already proven on the `DISCOURAGEMENT` block.

## Sources

- [Sanford: Challenge & Support (Middlebury Academic Advising Resources)](https://sites.middlebury.edu/academicadvisingresources/theories/sanford-challenge-support/)
- [Rethinking directiveness in AI coaching chatbots (Frontiers in Psychology, 2026)](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2026.1822088/full)
- [Our Approach: Kim Scott's Feedback Framework (Radical Candor)](https://www.radicalcandor.com/our-approach)
- [Yerkes-Dodson Law of Arousal and Performance (Simply Psychology)](https://www.simplypsychology.org/what-is-the-yerkes-dodson-law.html)
- [Self-Determination Theory of Motivation (Simply Psychology)](https://www.simplypsychology.org/self-determination-theory.html)
- [Navigating the comfort, stretch, and panic zones at work (BiteSize Learning)](https://www.bitesizelearning.co.uk/resources/comfort-zone-stretch-zone-panic-zone)
