# 30-Second Live Demo Script and Backup Video Checklist [GENAI]

Presenter: Member 5 (slide 6). Device: the presentation laptop, browser at full screen, zoom 100%.

## Before the session (Mon 16 Nov and Tue 17 Nov, 9:00 am)

1. Open https://pharmashield-gcc.vercel.app/boardroom in a fresh browser window at full screen (F11), plus a second tab on the Scenario page as a fallback.
2. Check that the Boardroom header shows "Live engine (parity verified)".
3. On the Approval page, clear old demo entries if needed (browser local storage) or confirm the shared audit store works.
4. Keep the backup video on the desktop, ready to play with one click.

## The 30-second click path (Boardroom mode)

Open https://pharmashield-gcc.vercel.app/boardroom (or click "Boardroom" in the top bar). Use the right arrow key to advance and Esc to exit.

| Time | Step on screen | Say |
|---|---|---|
| 0:00 | Step 1, the problem | "84 current US oncology shortage records, 8 of 11 carboplatin makers short, and 25 days to replace a failed supplier." |
| 0:05 | Step 2, the ranking | "Eleven qualified makers ranked on five risks. Probation makers can only win a 5-15% trial." |
| 0:10 | Step 3, the crisis click | "Hormuz closes. One click changes weights, route stress and the price of risk: India-made volume goes from 5% to 0% for 1.4% more cost." |
| 0:17 | Step 4, a supplier fails | "If the primary plant fails, the MILP re-solves live. The compliance gate has to relax, and the buyer sees it flagged in red." |
| 0:23 | Step 5, the recommended split | "Teva 70%, Hospira 15%, AVYXA 15%: 1,672,430 dollars a month, no spot buy." |
| 0:27 | Step 6, human approval | "The AI recommends; a category manager approves, and every decision is logged." |

Expected values: Normal USD 1,648,949 (India-made 5%); Crisis USD 1,672,430 (India-made 0%, expected late shipments 1.59%); Teva failure in Crisis: Fresenius Kabi becomes primary with "Gate relaxed", cost +USD 89,043 a month, spot buy 0.

Alternative click path (no Boardroom mode): Scenario page, click "Crisis (Hormuz)", then "Primary (Teva) plant fails" in the disruption simulator, then the Approval page.

## If something fails

- **Page does not load:** switch to the backup video immediately. Do not debug live.
- **Live Alerts shows "cached on 2026-11-14":** this is designed behaviour (openFDA timeout fallback). Say so in one sentence.
- **Live engine badge says "Precomputed (Python)":** the supplier-failure step needs the live engine; skip it and show the lambda sensitivity table on the Scenario page instead.

## Backup video recording checklist

- [ ] Record on Mon 16 Nov after the final deploy, using the live URL (not localhost).
- [ ] Screen recorder: Windows Snipping Tool (Record) or Xbox Game Bar (Win + G), 1920 x 1080, browser at full screen, notifications off (Focus assist on).
- [ ] Follow the Boardroom click path above exactly; target 30 seconds, hard limit 40.
- [ ] Narrate with the "Say" column, or record silent and narrate live.
- [ ] Check that every number in the video matches the expected values above.
- [ ] Save as `deck/backup_demo_30s.mp4`, and copy it to a USB stick and to the presentation laptop desktop.
- [ ] Do not commit the video to GitHub if it is over 50 MB.
- [ ] Log the recording in docs/progress.md.
