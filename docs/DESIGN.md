# Token Radar: engineering design

## 1. Purpose and scope

- Token Radar turns a fixed protocol snapshot into an inspectable pre-token research board.
- The board orders protocols by a modeled implied value rather than by raw TVL alone.
- It keeps the valuation arithmetic visible beside the resulting rank.
- It also generates a research plan that gives a user concrete questions and actions to investigate.
- The deliverable is a static dashboard that can be opened without a service or a live API.
- The build is deterministic for a given snapshot, model version, and source tree.
- The document separates implemented behavior from proposed future modeling work.
- That separation matters because some economically useful fields are absent from the supplied snapshot.

## 2. Product boundary

- The system is a research aid, not an investment recommendation or reward forecast.
- An implied value is a hypothetical total token valuation, not an expected personal allocation.
- The model does not know whether a protocol will launch a token.
- It does not infer a launch date from growth, index age, or campaign rumors.
- A generated farm plan is a sequence of research prompts, not verified protocol instructions.
- Users must verify official domains, contract addresses, eligibility rules, and withdrawal paths.
- Capital, gas, smart-contract exposure, and changing eligibility rules remain user risks.
- Static output improves reproducibility but does not make a stale snapshot current.

## 3. Repository map

- `main.ts` coordinates input loading, scoring, output validation, copying, and dossier creation.
- `lib/model.ts` owns snapshot normalization, eligibility, scoring, ranking, and farm text generation.
- `dashboard/index.html` provides the semantic page shell and local asset references.
- `dashboard/app.js` builds the interactive board, details view, controls, and model explanation.
- `dashboard/app.css` defines the dashboard's layout, responsive behavior, and visual hierarchy.
- `vendor/makefun-board.ts` supplies the dossier builder expected by the entry environment.
- `scripts/verify.mjs` is a development verification utility rather than part of scoring.
- `out/` is a generated example output and should be rebuilt after model or dashboard edits.

## 4. Runtime and deployment shape

- The program targets Node.js 22 or newer and uses Node's built-in modules.
- No package installation is needed for the production entry path.
- `node main.ts` uses the default mounted input and output locations.
- `--input` accepts either a snapshot file or a directory containing `snapshot.json`.
- `--output` chooses a destination and takes precedence over the output environment variable.
- `MAKEFUN_OUTPUT_DIR` gives local development a writable location outside the grader container.
- The generated dashboard refers to adjacent local data and style files rather than remote services.
- The deliverable remains usable when copied as a directory and opened from disk.

## 5. Data contract at a glance

- The top-level snapshot carries an as-of date, source label, TVL floor, protocol list, and watchlist.
- Each protocol has a stable slug and display name.
- Category and chains are descriptive fields used by ranking explanations and plan text.
- TVL is a required numeric input and is expressed in US dollars.
- Seven-day TVL change, market cap, index listing date, Gecko identifier, and symbol may be absent.
- Null market-cap identifiers are the available evidence used to identify a pre-token record.
- The snapshot schema currently has no emissions schedule or token unlock schedule.
- Missing fields are preserved as null or normalized to safe defaults rather than fabricated.

## 6. Parse and normalization boundary

- `parseSnapshot` first parses JSON and rejects a non-object root.
- It requires an ISO-shaped as-of date, a source string, a positive safe integer floor, and arrays.
- Each protocol must at least contain a string slug, a string name, and a finite numeric TVL.
- Optional descriptive values are narrowed to their expected primitive types.
- Invalid or absent seven-day changes become null rather than a made-up percentage.
- Chain arrays retain string members and discard values of other types.
- The parser is intentionally small and provides readable failure messages for the entry runner.
- A stricter calendar-date check and duplicate-input rejection are useful future hardening steps.

## 7. Source quality and provenance

- The snapshot's `source` and `as_of` fields travel through the model into dashboard data.
- Showing provenance makes the board's time boundary visible to a reader.
- A protocol index listing date describes an index observation, not necessarily protocol creation.
- TVL itself may include borrowed, incentivized, or recursively deposited assets.
- TVL values can differ by chain inclusion, token pricing, and source methodology.
- A single source label does not provide field-level citations or a historical audit trail.
- A future ingestion layer should preserve source URL, retrieval time, and raw response hashes.
- Provenance should follow each field through transformations instead of living only in a header.

## 8. Model design principles

- The implemented score is deliberately multiplicative so that each factor has an inspectable role.
- TVL supplies the starting scale of the estimate.
- Category approximates broad differences in value capture without claiming protocol-specific precision.
- Growth and age act as bounded signals around that scale.
- A cap on growth prevents a short exceptional week from dominating every other input.
- Stable sorting makes ties reproducible and keeps board changes attributable to data or model changes.
- The displayed factors help readers challenge assumptions instead of treating rank as a black box.
- The score is an ordinal research prioritizer built from heuristics, not a calibrated price target.

## 9. Implemented scoring equation

- Let `T` be protocol TVL in USD, `c` be the category multiple, and `g` be seven-day TVL change.
- Let `a` be age in days since the protocol index listing, when that date is available.
- The growth adjustment is `G = 1 + clamp(g, -60, 120) / 100 * 0.5`.
- The maturity adjustment is `M = 0.6 + min(max(age, 0), 1095) / 1095 * 0.4`.
- The discovery signal `S` combines the age bucket and the seven-day growth signal.
- The implied value is `max(1, round(T * 0.25 * c * S * G * M))` in US dollars.
- Null growth contributes zero to `G` and a neutral factor to the growth signal.
- The implementation rounds the composite signal to four decimal places before scoring.

## 10. Baseline TVL multiple

- The baseline multiplier is 0.25, so one dollar of TVL starts at twenty-five cents of implied value.
- The baseline provides a simple common scale before category and signal adjustments.
- It is not estimated from a training set in this repository.
- It does not mean that one quarter of TVL belongs to token holders.
- It does not model fee share, treasury ownership, collateral quality, or protocol liabilities.
- Keeping the baseline explicit makes sensitivity analysis straightforward.
- Any change should increment the model version and update the public explanation.
- A future calibration should compare out-of-sample predictions with defensible observed outcomes.

## 11. Category multiple behavior

- Category matching is case-insensitive substring matching against the snapshot category string.
- Exchange, derivatives, lending, CDP, and collateral terms receive a 0.35 category multiple.
- Yield, vault, curator, allocator, farm, and liquidity-manager terms receive 0.28.
- Bridges and interoperability terms receive 0.15.
- A selected set of other categories, including launchpads and insurance, receive 0.30.
- Categories not recognized by those rules receive 0.22.
- The first matching rule wins, so rule order is part of the model behavior.
- Substring rules are easy to audit but can misclassify ambiguous or composite labels.

## 12. Category interpretation and limits

- The larger exchange and lending multiple encodes an assumption about potential token value capture.
- The smaller bridge multiple encodes an assumption that TVL is a weaker proxy for token economics there.
- These are hypotheses chosen for ranking utility, not universal sector valuations.
- Two protocols in one category can have radically different fee models and governance rights.
- A category label may change upstream and move a score even when TVL is unchanged.
- Broad labels can conflate custodial, non-custodial, and infrastructure products.
- The dashboard should disclose the category multiple and use the same mapping as the scorer.
- A future model can replace string rules with a reviewed protocol-specific classification table.

## 13. Growth adjustment

- `growth_weight` is 0.5, so a one-percent change inside the clamp changes the factor by one-half percent.
- The lower bound is minus 60 percent and the upper bound is plus 120 percent.
- The resulting growth multiplier ranges from 0.70 to 1.60.
- Null observations are treated as zero for this term while remaining null in display data.
- Clamping limits the influence of anomalous spikes and errors without erasing the raw observation.
- This term is continuous within the bounds and does not introduce extra thresholds.
- Seven-day change remains a noisy, short-horizon measure and is not interpreted as durable adoption.
- The output records the clamped percentage and multiplier so the arithmetic can be reproduced.

## 14. Discovery signals

- A separate early-age signal is 1.25 below 120 days, 1.15 below 240 days, and 1.08 below 365 days.
- Older protocols receive 1.0 from that age signal.
- A missing listing date uses the configured unknown age of 365 days for this signal.
- The growth signal is 1.15 at plus 25 percent or higher over seven days.
- It is 1.08 from plus 10 percent up to but not including plus 25 percent.
- It is 0.92 at minus 20 percent or lower and 1.0 between those thresholds.
- The two signals multiply, and their product is rounded to four decimal places.
- Their role is to direct research attention, not to claim launch probability.

## 15. Maturity factor and age semantics

- The maturity term begins at 0.6 and grows linearly to 1.0 over 1,095 days.
- Dates older than three years are capped at the mature end of that range.
- A listing date in the future is clamped to zero age for scoring.
- Invalid date arithmetic returns an unknown age rather than crashing the build.
- Unknown age uses 365 days in the maturity calculation, yielding a neutral middle value.
- The age shown to readers is the computed age since index listing, not an inferred launch age.
- The separate early-age signal and maturity term intentionally express different heuristics.
- Sensitivity should be tested because small date changes can cross discovery-signal bucket boundaries.

## 16. Implied value semantics

- The number represents a hypothetical total token valuation proxy derived from protocol TVL.
- It does not represent circulating market capitalization, fully diluted value, or user reward value.
- It contains no explicit token supply, vesting, unlock, dilution, or fee-sharing input today.
- A positive minimum of one dollar keeps numeric board values valid for very small inputs.
- Integer rounding favors readable, stable output over false precision.
- The model's factors are not probabilities and must not be multiplied as if they were event odds.
- The rank is most useful for deciding what to investigate next within the same snapshot.
- Cross-date comparisons require the same source, scope, and model version to be meaningful.

## 17. Emissions as a future value input

- The current input has no token emission rate, reward budget, or emissions history.
- Therefore the implemented ranking does not calculate value from emissions.
- A future emissions module should distinguish protocol incentives from token-holder value capture.
- Reward emissions can attract TVL while diluting holders or subsidizing unproductive activity.
- Gross emissions should be recorded with token amount, timestamp, destination, and valuation source.
- USD conversion should retain the price timestamp and avoid treating an illiquid spot quote as reliable.
- Net incentives could be compared with fees, revenue, and retained TVL over a matched window.
- Emissions alone should never be interpreted as evidence of sustainable demand.

## 18. Emissions-adjusted design proposal

- A candidate measure is `net_incentive_yield = (fees_to_users - emission_cost) / average_TVL`.
- A positive value could support a stronger sustainability signal, while a negative value could reduce it.
- Emission cost should use circulating-market liquidity and a conservative execution haircut.
- Scheduled future emissions should remain separate from realized emissions in the data model.
- A schedule needs start time, end time, token amount, recipient class, and confidence metadata.
- Rewards directed to users, teams, liquidity providers, and treasury require separate accounting.
- The adjustment should be bounded and reported beside the raw implied value.
- It should not be introduced until field definitions and source coverage are tested across protocols.

## 19. Unlock schedules as a future risk input

- Unlock schedules are absent from the current snapshot and do not change present scores.
- A useful schedule needs token amount, unlock date, recipient, and circulating supply context.
- The same absolute unlock has different significance at different float and market depth levels.
- Team and investor unlocks should be distinguishable from ecosystem incentive releases.
- Unverified schedules should carry source links and confidence rather than a silently precise date.
- A point estimate can hide cliff dates, linear vesting, amendments, and contract-level uncertainty.
- Unlock risk is not equivalent to an automatic price decline or a guaranteed sell event.
- The dashboard should show the time horizon and data confidence with any future unlock metric.

## 20. Unlock-adjusted design proposal

- One candidate measure is scheduled unlock value divided by current circulating market value.
- Another is the fraction of current float unlocked over 30, 90, and 180 days.
- These horizons should remain separate so a distant release does not dominate near-term research.
- Market depth can moderate risk because identical supply changes have unequal execution impact.
- A conservative haircut may express uncertainty, but its assumptions must remain visible.
- Missing schedules should be marked unavailable instead of receiving a favorable zero-risk score.
- Any penalty should be bounded and should not disguise the underlying base valuation.
- Historical backtesting must test for survivorship bias and schedule revisions before adoption.

## 21. Separating present model from proposed model

- The scorer in `lib/model.ts` currently uses TVL, category, growth, listing age, and discovery signals.
- It does not read emissions, revenue, fee capture, supply, or unlock fields.
- Adding those concepts to explanatory text does not make them active scoring inputs.
- A model version change should identify the new fields and explain how nulls behave.
- Dashboard recomputation and server-side scoring must change together.
- The serialized model object should contain every numeric constant needed for browser recomputation.
- Documentation should distinguish implemented factors from roadmap candidates in each release.
- This distinction prevents a reader from attributing unsupported precision to the current board.

## 22. Pre-token eligibility

- A protocol is considered pre-token when market cap, Gecko identifier, and symbol are all null.
- This rule is a source-data convention, not proof that no token exists anywhere.
- The board begins with all protocols named by the supplied watchlist when records are found.
- It adds up to 400 eligible protocols below the configured TVL floor.
- Early candidates are selected in descending TVL order with slug as a deterministic tie-breaker.
- Several categories and name patterns are excluded from the early-radar candidate pool.
- The watchlist is retained as the coverage contract even if a record is not otherwise rankable.
- Exclusion rules deserve periodic review because naming and catalog conventions change.

## 23. Live-token comparison set

- Protocols with at least one token identifier are treated as not pre-token by the implemented predicate.
- Live records are sorted by market cap and then TVL, with null market caps treated as zero.
- The dashboard displays up to 24 live-token protocols as a separate comparison view.
- Their market cap is presented as an observed field rather than an implied value.
- Live rows are not merged into the pre-token rank order.
- This separation avoids comparing observed market caps and modeled values as if they were identical.
- The live view helps reveal familiar scale without asserting that the proxy is validated.
- A future design could show both metrics with unmistakable labels and source timestamps.

## 24. Board construction

- The protocol index is mapped by slug so watchlist membership can resolve records directly.
- Chosen watchlist records are deduplicated by slug before scoring.
- Early candidates exclude already selected slugs and use the eligibility rules.
- Each chosen protocol is scored once by the common `impliedValue` function.
- The scored rows are ordered by descending implied value and ascending slug for ties.
- Ranks are assigned only after the final ordering is complete.
- Each board row carries source fields, model factors, and generated farm steps.
- The board is thus a materialized explanation as well as a presentation structure.

## 25. Stable ordering and reproducibility

- The slug tie-breaker prevents source-array order from deciding equal-value ranks.
- Early candidate selection uses the same stable tie-break after TVL.
- Browser sorting applies a deterministic slug fallback when the chosen values tie.
- Date arithmetic uses UTC midnight to avoid local timezone shifts.
- Rounding is explicit at the score and signal stages.
- A fixed input and unchanged source should therefore produce byte-stable logical rows.
- Generated JSON formatting is stable for a given JavaScript runtime and object construction order.
- Stable output supports review diffs, reproducible builds, and meaningful dossier checks.

## 26. Farm-plan generation goals

- Farm steps turn a ranked row into a cautious checklist for further research.
- Their content is generated from category, chain, TVL size, age, and seven-day movement.
- They include verification, a possible supported action, review timing, exit checks, and logging.
- Step text is paired with illustrative cost and time estimates before serialization.
- The purpose is to make the next useful investigation legible rather than promise an airdrop.
- Campaign status is not read from the snapshot and must not be implied by the plan.
- A user should be able to skip an action when no legitimate activity exists.
- The plan must keep uncertainty visible wherever a generated action depends on protocol support.

## 27. First farm step: verification

- Every plan begins by asking the reader to verify the official app and published eligibility rules.
- It explicitly states that the snapshot does not confirm a campaign.
- It suggests using a separate wallet with limited funds.
- The verification prompt is intentionally generic because the snapshot has no official URL field.
- Independent verification should include documentation, domain ownership, and contract addresses.
- Search results and social posts alone are not sufficient to establish authenticity.
- The estimated initial gas cost is illustrative and can differ sharply by chain and congestion.
- Verification is a gate before any transaction, not a claim that the action is safe.

## 28. Category-specific action selection

- Lending, CDP, and collateral categories can produce a stable-asset supply action.
- DEX, yield, and leveraged-farm categories can suggest reviewing an eligible pool and liquidity risk.
- Bridge categories can suggest a small transfer and use of bridged assets in the destination app.
- Staking-related categories can suggest staking and retaining the receipt asset.
- Perpetual and derivative categories favor checking a testnet and a defined loss limit.
- Prediction, curator, allocator, stable-asset, RWA, and insurance labels have tailored branches.
- Unknown categories fall back to documentation review and a bounded supported action.
- These branches use category strings, so their output is a starting point for human judgment.

## 29. Action selection trade-offs

- A short branch table is easier to inspect than a protocol-by-protocol action catalog.
- Broad categories inevitably produce inaccurate suggestions for some products.
- The text uses conditional language where a feature may not exist.
- Capital is based on TVL tiers, not on a user's financial situation or protocol minimums.
- The generated step should be interpreted as a research hypothesis, not a transaction instruction.
- Missing token, market, and campaign metadata prevents personalized plan generation.
- Protocol-specific templates would improve relevance but require authoritative review and maintenance.
- Safer output depends on preferring a skipped activity over invented functionality.

## 30. Capital sizing heuristic

- The plan uses a nominal $50 amount below $100 million TVL.
- It uses $100 at or above $100 million, $150 at or above $1 billion, and $250 at or above $5 billion.
- The amount is a generated example and not a recommended allocation.
- It can exceed a user's risk budget or be too small to meet a protocol's minimum.
- The plan describes selected actions as limited and asks users to verify actual costs.
- A shrinking-TVL observation causes the review step to suggest keeping the position below half the tier amount.
- Capital sizing does not consider wallet balance, token volatility, or correlated exposure.
- A future interface should let readers set a budget or hide capital examples entirely.

## 31. Timing and review windows

- Very young listings receive a longer nominal 60-day review window.
- Protocols under one year use 45 days unless age is unknown or at least one year.
- The remaining records receive a 30-day review window.
- A sharp positive weekly TVL change prompts earlier investigation, not a launch prediction.
- Moderate growth suggests reviewing documentation within a month.
- A steep TVL decline suggests waiting for renewed inflows before increasing position size.
- These are cadence hints and do not define eligibility, persistence, or payout thresholds.
- Time language should be treated as a reminder to reassess, not a reason to rush.

## 32. Farm-step serialization

- A structured `FarmStep` contains a text action, a cost string, and a time string.
- `stepText` combines those fields into a compact sentence for the board schema.
- Serialized text is bounded between 20 and 600 characters to satisfy the output gate.
- Very long text is truncated with an ellipsis while preserving a clear size limit.
- Very short text receives a generic follow-up so that a step remains interpretable.
- The current final board carries flattened strings rather than structured cost and time objects.
- Flattening simplifies the output contract but requires the dashboard to split on a text marker.
- A versioned structured representation would be more robust for localization and accessibility.

## 33. Farm-plan safety and correctness

- The plan advises avoiding artificial volume, borrowing loops, and unnecessary gas expenditure.
- It tells the reader to inspect withdrawal conditions before committing funds.
- It frames hold duration as a review window rather than proof of eligibility.
- It recommends checking a protocol's own rewards page and using its published claim link.
- It suggests recording wallet, dates, and transactions to support later review or exit.
- No automated transaction execution or wallet connection exists in this entry.
- Cost estimates can be wrong as network fee markets change.
- The safe default is to stop when campaign terms or a legitimate use case cannot be verified.

## 34. Snapshot-to-board data pipeline

- The pipeline begins by resolving a snapshot path from command-line arguments or the default mount.
- It reads and parses the snapshot once before model work begins.
- `buildRadar` creates both the full board and the compact dashboard data from that normalized input.
- `boardIssue` checks output invariants before any artifacts are written.
- The board is serialized to JSON while a JavaScript data assignment is generated for the browser.
- Dashboard assets and screenshots are copied into the output directory.
- The dossier is written last from the finished output so it can describe the delivered artifacts.
- A successful run prints the row counts and output locations for operator inspection.

## 35. Pipeline failure boundaries

- A missing input produces an actionable message and a nonzero exit status.
- Malformed or incomplete input is rejected by the parser before scoring.
- A board that violates scoring-output invariants exits before artifact serialization.
- Missing screenshot material or invalid image names stops the packaging stage.
- The dossier is produced only after expected output components have been staged.
- A failure can leave earlier output files in place because writes are not transactional today.
- Temporary-directory staging and atomic rename would avoid partially refreshed output.
- Each failure message should retain enough context to locate the problematic input or artifact.

## 36. Output artifact roles

- `board.json` is the explicit ranked board with model details for every pre-token row.
- `data.js` assigns one serialized `RadarData` object to `window.RADAR` for local browser access.
- `dashboard/` contains a copied static page, script, and style sheet.
- `screenshots/` contains evidence images used by the submission environment.
- `dossier.json` summarizes the final package in the format expected by the surrounding gate.
- The board and browser data derive from one `buildRadar` result to reduce accidental drift.
- Rebuilding after model edits is necessary because checked-in generated output may become stale.
- Output files are build products and should be reviewed as a coherent set.

## 37. Dossier and packaging constraints

- The entry caps dossier text at 65,536 bytes.
- Screenshot packaging allows at most four images and 524,288 bytes per image.
- Image names must match a conservative ASCII filename pattern.
- The code expects at least three screenshots for board, detail, and filtered states.
- The dashboard package is constrained to 400 files and four mebibytes by the dossier builder call.
- The dossier is generated from the actual output directory rather than from an assumed file list.
- This makes packaging validation reflect what was emitted on disk.
- Resource caps are interface constraints and should be maintained when assets change.

## 38. Board invariants

- The final board must have at least 100 and no more than 4,000 rows.
- Slugs must be unique and each board row must exist in the input protocol list.
- Every watchlist slug must appear in the scored board.
- Ranks must be contiguous from one through the board length.
- Values must be in non-increasing order down the board.
- A board in which every row has the same implied value is rejected as non-informative.
- Each row must have between three and twelve farm steps with bounded text length.
- Each implied value must be a positive safe integer.

## 39. Dashboard architecture

- The page is a small static shell with one main mount point and local CSS and JavaScript.
- The generated `data.js` script defines the data before `app.js` executes.
- The application uses browser-native DOM APIs and a small element-construction helper.
- State includes search query, category, selected protocol, active token-status tab, sort key, and direction.
- Rendering rebuilds the board surface from the state and preserves search focus where appropriate.
- A native dialog presents protocol detail and the generated farm plan.
- The dashboard does not fetch network data or load a framework at runtime.
- The architecture favors portability and auditability over a component framework's abstractions.

## 40. Static data handoff

- The build serializes `RadarData` as JSON inside a single JavaScript assignment.
- This lets `file://` pages load generated data without a fetch request or local HTTP server.
- The payload carries source date, source label, floor, model constants, model version, and row counts.
- It also carries ranked rows, live comparison rows, and each plan's text.
- Serialization escapes values through `JSON.stringify` rather than concatenating protocol fields by hand.
- The page must load the data script before the application script.
- A malformed or absent data assignment would prevent the interactive renderer from starting.
- A schema version would make future data changes easier to diagnose and migrate.

## 41. Dashboard state and URL behavior

- Search, category, and selected detail state are represented in the URL hash.
- The hash makes a filtered or selected view shareable without a backend session.
- The live/pre-token tab and sort choices are local state in the current implementation.
- A hash change reloads the represented query fields and redraws the page.
- The native dialog close event clears selection and updates the hash.
- A user can open a row with a click, Enter, or Space key.
- Search focus is restored after redraw to make incremental filtering practical.
- A more explicit URL state schema could include tab and sort state in a future revision.

## 42. Search, filtering, and sorting

- Search is case-insensitive over name, slug, category, and chain labels.
- The category selector is populated from categories actually present in the board.
- Pre-token and live-token tabs keep modeled rows separate from observed token rows.
- Default order follows implied value; users can also sort by name, TVL, growth, and age.
- Null growth and unknown age receive deliberate sort placements.
- Stable slug order breaks ties regardless of the active sort column.
- Empty search results include a clear-filters action instead of a blank table.
- Counts communicate the filtered row total or the live-set size.

## 43. Detail view and explainability

- A detail view shows TVL, seven-day change, listing age, model factors, and implied value.
- It recomputes the selected estimate in the browser from the transmitted model constants.
- A mismatch message can reveal stale generated data or inconsistent scoring logic.
- The view gives a simple 0.5-times to 2-times sensitivity range around the estimate.
- It explains that signals are heuristics and that no launch date or allocation is known.
- Farm steps appear in an ordered list with cost and time text.
- The detail dialog can close through its explicit control or the Escape key.
- Accessible labels and dialog semantics should remain intact as the interface evolves.

## 44. Duplicate model logic in the browser

- The browser repeats category mapping and the score equation to independently recompute a row.
- This creates an additional consistency check without a server request.
- It also duplicates logic and can drift when one copy is updated alone.
- The model version and displayed recomputation help expose that drift to the reader.
- A shared generated module is difficult to load from a strict local-file page in some browsers.
- A build-time test can compare browser calculations with the TypeScript scorer on fixtures.
- A declarative model specification could generate both implementations from one source.
- Until then, any formula change requires coordinated edits and verification.

## 45. Offline operation and privacy

- All required dashboard assets and data are packaged locally.
- The runtime page makes no network request for fonts, scripts, styles, or protocol data.
- Search and filtering operate in the user's browser on the static snapshot.
- No wallet, identity, or browsing-event data is collected by this entry.
- Offline operation supports reproducibility and keeps a missing API from breaking the board.
- It also means prices, TVL, and campaign terms cannot update while the page is open.
- The user must rebuild the artifact to incorporate a newer snapshot.
- External official-site verification remains a deliberate human action outside the dashboard.

## 46. Visual and responsive design

- The board foregrounds rank, protocol identity, TVL, growth, age, and implied value.
- A value bar supports quick comparison but is not an additional score factor.
- The model panel gives the equation and key heuristic constants in plain language.
- The table wrapper handles wide data on narrow screens while preserving the page structure.
- Detail presentation is separated from dense ranking rows to avoid overwhelming the board.
- Semantic headings and table captions help people navigate content beyond visual styling.
- A skip link and keyboard-accessible row selection support non-pointer use.
- Any visual redesign should preserve visibility of uncertainty and model provenance.

## 47. Accessibility considerations

- Controls have labels or accessible names and use native form elements where practical.
- Sort controls are buttons inside semantic table headers.
- Selected rows expose state through a data attribute used for styling.
- The detail dialog names its title through `aria-labelledby`.
- Keyboard activation supports Enter and Space, and Escape closes the dialog.
- Focus restoration currently covers search input after a redraw.
- Automated checks should include keyboard traversal, zoom, and screen-reader smoke tests.
- Color must not be the only way to distinguish positive and negative growth.

## 48. Verification layers

- Parsing checks shape and normalizes optional fields before model functions see the data.
- Unit-level checks should cover scoring boundaries, age handling, category order, and tie behavior.
- `boardIssue` enforces the output contract on every production build.
- The development verifier checks row relationships and dossier identity against a snapshot.
- Browser automation exercises rendering, details, search, sorting, live view, and narrow layout.
- Network-request observation helps prove the page remains self-contained.
- Screenshot checks verify that expected evidence assets fit submission limits.
- No single layer proves that a source snapshot is economically accurate or safe to act on.

## 49. Model verification cases

- A neutral input should produce the baseline multiplied by its category and maturity terms.
- Growth at minus 60 and plus 120 should exercise both clamp boundaries.
- Growth beyond either boundary should equal the corresponding boundary score.
- Seven-day changes at 10, 25, and minus 20 should exercise signal thresholds.
- Listing ages at 0, 120, 240, 365, and 1,095 should test each age transition.
- Missing and invalid dates should use the declared unknown-age behavior.
- A future date should clamp to zero rather than produce a negative maturity multiplier.
- Equal implied values should resolve by slug, not input order.

## 50. Farm-plan verification cases

- Each category branch should produce a readable action that matches its intended category.
- An unknown category should use the generic verification-oriented fallback.
- Empty chains should produce a comprehensible chain phrase rather than an undefined value.
- TVL values around each capital tier should test threshold inclusivity.
- Missing age, young age, and mature age should test review-window selection.
- Growth changes around 10, 25, and minus 20 should test the why-now text branches.
- Every serialized step should respect the character limit after cost and time are appended.
- Text should never claim that a campaign, reward, or eligibility condition has been confirmed.

## 51. Pipeline and artifact verification

- A valid fixture should build board, browser data, copied assets, screenshots, and dossier.
- Missing input should fail clearly before attempting to score.
- Malformed JSON and absent required fields should produce distinct parser failures.
- A missing watchlist record should be caught by board validation.
- Duplicate slugs and invalid score ordering should fail the board invariant check.
- Rebuilding the same fixture should preserve row content and rank order.
- The dossier should match a fresh reconstruction from the final output directory.
- A future atomic writer should test cleanup and recovery after a simulated disk error.

## 52. Browser verification

- The existing development script checks that rendered row count equals board row count.
- It opens the leading row and checks that the dialog and plan steps are visible.
- It exercises search, focus retention, no-results handling, clearing, and TVL sorting.
- It switches to the live tab and verifies the expected live record count.
- It tests a mobile-width viewport and captures the page-error and network-request lists.
- Browser automation depends on an externally supplied Playwright-compatible module.
- The production entry itself remains free of that development dependency.
- Browser tests should be updated when user-visible controls or output schemas change.

## 53. Consistency between representations

- `board.json` carries the full board row and nested model detail.
- `data.js` carries a reduced dashboard projection plus model constants and live rows.
- The browser recomputes selected scores to compare the projection against its source result.
- Rows should remain traceable by slug across board, dashboard, and snapshot.
- A test should assert that projection fields match their corresponding board fields.
- Rounding and null semantics must be identical in TypeScript and JavaScript.
- Schema evolution should add an explicit version before changing field meanings.
- Generated artifacts should never be edited manually as a substitute for rebuilding.

## 54. Failure modes and mitigations

- A stale or incomplete snapshot can give a precise-looking but misleading board.
- A token missing from all three identifier fields can be falsely classified as pre-token.
- A category change can alter the score because matching is based on text.
- An index listing date can be mistaken for protocol launch age if labels are careless.
- A short-lived TVL spike can raise the score even after the underlying capital leaves.
- A generated action can be unsupported or risky for a specific protocol.
- Output checks catch structural errors but not every semantic data error.
- Provenance, plain-language caveats, bounded adjustments, and review gates reduce these risks.

## 55. Data gaps and null policy

- Null seven-day change leaves the growth term neutral and shows as unavailable in the interface.
- Null listing date uses the configured unknown-age fallback while remaining visibly unknown.
- Null category uses the default category multiple.
- Empty chains use a generic chain phrase in plan text and display.
- Missing token identifiers are interpreted through the pre-token predicate, not as verified absence.
- Future emissions and unlock inputs should preserve an unavailable state distinctly from numeric zero.
- Missing values should not be silently replaced by favorable assumptions.
- Coverage rates should be measured before adding a field to a score.

## 56. Sensitivity and uncertainty

- A 0.5-times to 2-times band communicates broad multiplicative sensitivity in the detail view.
- That interval is illustrative and is not calculated from statistical confidence bounds.
- The TVL baseline, category multiplier, and age curve can all move rankings materially.
- Short-term changes may reflect asset prices and incentives as well as new deposits.
- A point estimate hides uncertainty in source definitions and protocol classification.
- A future uncertainty model should expose input ranges and source quality separately.
- Sensitivity tests should report rank movement as well as dollar movement.
- Rankings should not be interpreted as meaningful when score differences are smaller than input uncertainty.

## 57. Design trade-off: heuristic simplicity

- A compact multiplicative model is easy to show, recompute, and challenge.
- It avoids a learned model whose data and inference process would be difficult to inspect here.
- It can encode strong subjective assumptions in constants that look more objective than they are.
- Each factor can reinforce another and compound a mistaken source observation.
- Bounded ranges reduce extreme behavior but do not provide calibration.
- A more complex model could capture revenue, market structure, and dilution more accurately.
- Complexity without reliable labels and validation would create additional false precision.
- The current choice prioritizes clarity and reproducibility over claimed predictive accuracy.

## 58. Design trade-off: static snapshot

- Static output is simple to package, inspect, archive, and open offline.
- It avoids runtime keys, API outages, cross-origin behavior, and data-provider drift during a session.
- It can become stale immediately after the snapshot date.
- Rebuilding requires access to an updated input and a controlled source process.
- A live dashboard could improve freshness while making historical reproduction harder.
- A future hybrid could preserve immutable snapshots and optionally display a separate live layer.
- The as-of label must remain visible in both board and detail contexts.
- A refresh should create a new artifact rather than silently rewrite the meaning of an old one.

## 59. Design trade-off: broad eligibility

- Preserving every watchlist row makes coverage explicit even when metadata is imperfect.
- Adding high-TVL early candidates expands discovery beyond a fixed shortlist.
- Capping early additions keeps the board bounded and limits packaging cost.
- Category and name exclusions lower obvious false positives but can hide valid protocols.
- A ranking based on a capped candidate pool is not a complete ecosystem census.
- The dashboard reports watchlist and early-radar counts to show the two coverage sources.
- Candidate policy should be reviewed independently of scoring so scope changes remain understandable.
- Users should not infer absence from a protocol's absence from this bounded board.

## 60. Design trade-off: generated farm steps

- Generated steps create practical structure without maintaining hundreds of manual plans.
- The same rules can be applied consistently to every row in one build.
- Generic actions can be wrong when category labels omit product-specific details.
- Templated capital and timing may imply recommendation despite the stated caveats.
- No live eligibility source means a plan can age faster than the valuation snapshot.
- Human verification and conditional language are essential safeguards.
- A future plan system could distinguish research-only, testnet, and funded actions explicitly.
- A high-risk action should be omitted when the source does not support a safe suggestion.

## 61. Performance and scale

- Current scoring is linear in protocol count apart from sorting.
- Candidate filtering and final ranking use standard array operations and are sufficient for thousands of rows.
- Sorting dominates asymptotic work at `O(n log n)` for the bounded board.
- Static browser rendering rebuilds the filtered table rather than virtualizing rows.
- A board capped at a few thousand rows is small enough for a straightforward DOM approach.
- Very large snapshots would motivate filtering before DOM construction and perhaps row virtualization.
- The compact generated payload can still grow with long farm text and many protocol records.
- Performance work should follow measured browser and build timings, not assumed bottlenecks.

## 62. Security and trust boundaries

- Snapshot strings are inserted through text nodes by the dashboard element helper.
- This reduces the risk of interpreting protocol names as executable markup.
- The helper exposes an HTML attribute path that should remain unused for untrusted snapshot values.
- No external scripts or network-loaded code are needed in the delivered page.
- The program copies regular files and skips dot-prefixed names from asset directories.
- Input paths and output paths are operator-controlled command-line values.
- Snapshot data remains untrusted even when it comes from a familiar index provider.
- Any future links must be validated and clearly identified before they are made clickable.

## 63. Observability and diagnostics

- Build logs report protocol, watchlist, board, early, and live row counts.
- Errors identify missing inputs, invalid board output, or screenshot packaging problems.
- The model version is carried into dashboard data and visible page metadata.
- The dossier provides an independently generated summary of the delivered package.
- Row-level factors give users an explanation path from input data to rank.
- Logs currently do not provide per-field source freshness or score-diff history.
- A future audit report could list data coverage, rejected candidates, and changed ranks.
- Diagnostics should help reproduce a result without leaking secrets or relying on hidden state.

## 64. Model versioning and change management

- The current model identifies itself as `radar-3`.
- Changes to constants, category rules, age semantics, or missing-data behavior should change that identifier.
- Dashboard formula text and browser recomputation should be changed in the same revision.
- Generated `out/` artifacts should be rebuilt to reflect the active implementation.
- Release notes should explain rank shifts caused by model changes separately from source updates.
- A fixed fixture can provide a clear before-and-after comparison for proposed changes.
- Historical snapshots allow replay when they are retained with source metadata.
- Versioning is a user-facing provenance mechanism, not merely an implementation detail.

## 65. Reproducible research workflow

- Preserve the raw input snapshot before normalization or manual correction.
- Record its retrieval time, source URL, and checksum alongside the build.
- Run the same model version against the same snapshot when comparing a code change.
- Review score components for surprising ranks rather than only checking the top row.
- Inspect ties, exclusions, null-heavy records, and large week-over-week changes.
- Verify protocol facts on official sources before using any farm-plan action.
- Keep the generated board and dashboard together with their snapshot provenance.
- This workflow makes disagreement about an assumption actionable and testable.

## 66. Suggested extension: richer economics

- Add fees, protocol revenue, token-holder revenue share, and treasury data only with defined provenance.
- Distinguish gross volume from fees and fees from retained protocol revenue.
- Attribute revenue to a consistent time window and report the window in the interface.
- Measure TVL concentration and chain composition to expose dependency risk.
- Include stablecoin and asset composition where oracle and price sources are defensible.
- Compare incentive spend with organic fee generation to avoid rewarding subsidized growth twice.
- Add confidence metadata before allowing any new economic field to move the rank.
- Keep base TVL proxy and richer economic measures separately inspectable.

## 67. Suggested extension: emissions and unlock data model

- Introduce a schedule record with token identifier, event type, amount, start, end, and recipient class.
- Store the source URL, observation time, and confidence for every schedule record.
- Represent recurring emissions and discrete unlocks as different event types.
- Keep nominal token quantity and USD estimate as separate values.
- Store price source and timestamp for every converted USD estimate.
- Track circulating supply and market depth references for interpreting relative impact.
- Permit corrections and superseding records without erasing the prior source observation.
- Leave a missing schedule as unknown until evidence supports a zero-event conclusion.

## 68. Suggested extension: scenario analysis

- A scenario view could show low, central, and high assumptions without collapsing them into one truth.
- TVL could be stressed for outflows before applying an implied-value multiple.
- Emission or unlock events could be evaluated over separate time horizons.
- Category and baseline ranges could be displayed as sensitivities rather than hidden tuning.
- Each scenario should explain which inputs differ and why.
- The interface should not label a scenario as a probability unless probabilities are calibrated.
- Side-by-side rank ranges can reveal when ordering depends on fragile assumptions.
- Scenario analysis is a research aid, not a replacement for source verification.

## 69. Suggested extension: protocol-specific evidence

- Add official documentation links only after validating the domain and its ownership.
- Keep links separate from generated text so users can inspect the target before opening it.
- Associate evidence with a specific claim, such as token status or reward eligibility.
- Record when evidence was checked and by whom or by which source process.
- Give contradictory sources explicit representation rather than silently selecting one.
- Expired campaigns should carry end dates and should not remain active recommendations.
- Evidence freshness should be visible in the detail view.
- Protocol-specific records require a maintenance path and a clear correction mechanism.

## 70. Suggested extension: data lineage

- A lineage record can identify the raw field, source endpoint, retrieval time, and transformation.
- Derived fields such as age should name their date inputs and timezone convention.
- Score explanations can then link each factor to the input values that produced it.
- A source change becomes distinguishable from a model-code change in a review diff.
- Hashing raw snapshots supports integrity checks but does not prove source truth.
- Lineage should be retained with the generated artifacts or a durable archive reference.
- Field-level lineage is especially important for emissions, unlocks, and revenue claims.
- The extra bytes are modest compared with the value of reproducible review.

## 71. Operational checklist for a build

- Confirm that the intended snapshot path exists and its as-of date is plausible.
- Confirm the snapshot source and protocol count before interpreting scores.
- Run the model and inspect any parser or board-invariant failure.
- Check that every watchlist entry appears and that the row count is within limits.
- Review model version, top ranks, score ties, and unusually large growth observations.
- Open the static dashboard and test search, detail, live view, and mobile layout.
- Confirm screenshots represent the current generated board and respect size limits.
- Rebuild the dossier last and retain the snapshot provenance with the output.

## 72. Operational checklist for a user

- Check the as-of date before relying on TVL or growth figures.
- Read the equation and factors before comparing implied values.
- Treat category, age, and growth signals as assumptions with visible limitations.
- Verify that a protocol's token status and campaign terms are current.
- Navigate to official sources independently and confirm the domain and contracts.
- Estimate gas, withdrawal fees, slippage, lockups, and loss exposure before any action.
- Skip a generated activity when it has no legitimate product use or verified eligibility.
- Record what was checked and reassess when data or protocol terms change.

## 73. Acceptance criteria for model changes

- The proposal states which inputs, constants, and null behaviors change.
- The formula remains reproducible from serialized row data and model metadata.
- Boundary tests cover every new threshold and maximum or minimum.
- The browser and server implementations agree on representative and edge-case fixtures.
- Explanatory copy distinguishes measured inputs from assumptions.
- A before-and-after replay reports rank movement and score movement on fixed snapshots.
- Data coverage and source quality are adequate for the new factor's intended population.
- The model version changes and generated artifacts are rebuilt.

## 74. Acceptance criteria for dashboard changes

- The page still works from a local file with no network access.
- Search, filters, sorting, detail view, and live view remain usable by keyboard.
- Empty, null, and malformed-display cases remain understandable.
- Uncertainty and snapshot provenance remain visible after layout changes.
- User-provided or snapshot-derived strings are rendered as text, not executable HTML.
- Mobile layout remains readable at narrow viewport widths.
- Browser checks cover the changed interaction and report console errors.
- Static assets and screenshots remain within the submission packaging limits.

## 75. Open questions

- What independent historical dataset could calibrate the baseline multiple without survivorship bias?
- Which revenue definitions are comparable across different protocol categories?
- Can emissions be sourced comprehensively enough to avoid penalizing only well-documented protocols?
- How should schedule uncertainty and amendments be represented in rank sensitivity?
- Should capital examples be user-configurable or omitted from generated farm text?
- Would explicit evidence links improve safety enough to justify ongoing curation?
- Which fields deserve confidence intervals rather than point observations?
- How should a stale snapshot be flagged when the page itself remains offline?

## 76. Summary of current behavior

- Token Radar parses a supplied snapshot and normalizes the fields used by the model.
- It builds a bounded pre-token board and a separate live-token comparison list.
- It estimates implied value with a TVL baseline, category multiple, growth, age, and discovery signals.
- It creates category-aware research steps with cost and timing caveats.
- It validates board shape before writing a self-contained set of artifacts.
- It exposes ranks, assumptions, filtering, sorting, and protocol detail in a static dashboard.
- It can verify output structure and browser behavior, but not the truth of third-party data.
- Emissions and unlock schedules remain proposed extensions until the snapshot supplies reliable fields.
