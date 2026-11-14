# NotebookLM prompt for the 7-slide deck [GENAI]

Paste the prompt below into NotebookLM after uploading deck/notebooklm_source_pack.md and these figures:
- figures/fig_05_panel_share_and_cost.png
- figures/fig_06_panel_evidence_heatmap.png
- figures/fig_07_c2_roc_confusion.png
- figures/fig_08_c2_shap_drivers.png
- figures/fig_10_nlp_classes_confusion.png
- figures/fig_14_milp_split_by_mode.png
- figures/fig_15_lambda_sensitivity.png

This prompt was written with GenAI (prompt log entry 5); log the NotebookLM session itself as a new entry in docs/prompt_log.md.

````text
You are helping a master's student team build a 7-slide boardroom deck for the C-suite of a hypothetical UAE healthcare group purchasing organisation. Use ONLY the uploaded source pack and figures.

Rules:
1. Produce exactly 7 slides, in the order and with the titles given in the source pack (Slide 1 to Slide 7). Do not add a title slide, agenda or appendix.
2. For each slide give: the headline (one sentence), 3 or 4 bullets of at most 22 words each, the figure file name to place, and the speaker notes from the source pack shortened to about 80 seconds of speech.
3. Copy every number exactly as written in the source pack. Do not round, convert or recompute any number. If a number is not in the source pack, do not use it.
4. Keep every [GENAI] marker next to the element it marks, and keep every assumption label such as (A11) next to its number.
5. Keep the wording in the "Do not change" list exactly. Use "MILP", "11 qualified makers", "84 current US oncology shortage records covering 8 drugs", "reduce stock-outs" and "plant- and lane-level evidence where available, country-level otherwise".
6. Plain business English, short sentences. Never use long dashes; use short hyphens only.
7. Never describe carboplatin as a cold-chain product. Never present the GPO as a real company. Never claim that 80% of GCC medicines come from FDA-inspected sites.
8. End with a list of every number you used and the slide it appears on, so the team can check it against docs/number_trace.md.
````
