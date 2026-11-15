# 30-Second Live Demo Script and Backup Video Checklist [GENAI]

Presenter: Member 5 (slide 6). Device: the presentation laptop, browser at full screen, zoom 100%.

## Before the session (Mon 16 Nov and Tue 17 Nov, 9:00 am)

1. Open the live URL https://pharmashield-gcc.vercel.app in a fresh browser window, one tab per page in this order: Scorecard, Scenario & Order Split, Approval & Audit.
2. On the Scenario page, check that the badge says "Live recompute in browser (parity with Python verified)".
3. On the Approval page, clear old demo entries if needed (browser local storage) or confirm the shared audit store works.
4. Keep the backup video on the desktop, ready to play with one click.

## The 30-second click path

| Time | Action | Say |
|---|---|---|
| 0:00 | Scorecard tab, Normal mode. Click the Eugia row. | "Every maker is scored on five risks. Eugia ranks last: here are the three reasons the model gives." |
| 0:08 | Scenario tab, Normal mode. Point at the split (Teva 70%, AVYXA 15%, Hospira 10%, Gland 5%). | "Today's split keeps a small India-made trial." |
| 0:13 | Click "Crisis (Hormuz)". | "Hormuz closes. One click changes the weights, the route stress and the price of risk. The India-made trial drops out: India-made volume goes from 5% to 0%, for 1.4% more cost." |
| 0:21 | Approval tab, Crisis mode. Type "CPO" as approver. Click "Approve and log". | "A human approves. Nothing is ordered automatically, and the decision is logged with its weights." |
| 0:28 | Point at the new log row. | "Full audit trail, downloadable as CSV." |

Expected values on screen at 0:13 (Crisis profile, lambda 2.0): Teva 70%, Hospira 15%, AVYXA 15%; monthly purchase cost USD 1,672,430; India-made 0%; expected late shipments 1.59%. Normal (lambda 1.0) shows USD 1,648,949 and India-made 5%.

## If something fails

- **Page does not load:** switch to the backup video immediately. Do not debug live.
- **Live Alerts shows "cached on 2026-11-14":** this is designed behaviour (openFDA timeout fallback). Say so in one sentence.
- **Slider does not respond:** the badge will say "Precomputed Python results". Show the lambda sensitivity table at the bottom of the Scenario page instead; it holds the same numbers.

## Backup video recording checklist

- [ ] Record on Mon 16 Nov after the final deploy, using the live URL (not localhost).
- [ ] Screen recorder: Windows Snipping Tool (Record) or Xbox Game Bar (Win + G), 1920 x 1080, browser at full screen, notifications off (Focus assist on).
- [ ] Follow the click path above exactly; target 30 seconds, hard limit 40.
- [ ] Narrate with the "Say" column, or record silent and narrate live.
- [ ] Check that every number in the video matches the expected values above.
- [ ] Save as `deck/backup_demo_30s.mp4`, and copy it to a USB stick and to the presentation laptop desktop.
- [ ] Do not commit the video to GitHub if it is over 50 MB.
- [ ] Log the recording in docs/progress.md.
