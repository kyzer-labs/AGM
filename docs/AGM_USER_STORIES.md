# AGM Website User Stories And Functional Requirements

This document describes the intended user-facing behavior for a new AGM voting website. It is written for a future coding agent or implementation team. Focus on the actual website use cases, voting rules, operational flows, and known pitfalls. Do not treat this document as an architecture mandate unless a technical constraint is explicitly listed.

## Product Context

The Computer Science Society AGM is a public annual meeting where the society presents reports and elects the next committee. The society is made up of Year 1 and Year 2 students. Year 2 members are retiring and passing leadership to Year 1 members.

The election result has two components:

- Internal evaluation: 75% of the final result.
- External public vote: 25% of the final result.

Internal evaluation is performed before AGM day by eligible Year 2 committee members. External public voting happens during the live AGM event and is open to eligible USM students who are not in the internal Year 2 whitelist.

The website must support both phases as one coherent election process.

## Lessons From Previous Projects

The older AGM project had richer election operations: voter profile completion, admin dashboard, candidate management, ballot management, admin management, live voting, and result views. Its main value was full election administration.

The current AGM2026 project is simpler and focuses on live voting: email verification, admin-controlled active position, weighted scores, and one-position-at-a-time voting. Its main value is a straightforward AGM-day flow.

The new product should keep the useful parts of both:

- Keep the full admin setup capability from the older project.
- Keep the simple live voting experience from AGM2026.
- Add proper support for the real 75% internal / 25% external election process.
- Avoid hardcoded candidate data, shared admin passwords, unclear vote weighting, and missing pre-AGM internal evaluation flows.

## Roles

### Visitor

A visitor is anyone who opens the website before signing in.

They should be able to:

- Understand that this is the official AGM election website.
- Sign in using their USM student identity.
- See basic help text and support contact information.
- Be blocked from voting until authenticated and eligible.

### External Voter

An external voter is any eligible signed-in USM student who is not in the Year 2 internal whitelist. This includes Year 1 committee members.

They should be able to:

- Complete their voter profile.
- Join the public AGM voting flow while voting is open.
- Vote for one candidate in each currently active public ballot.
- See that their vote was received.
- Be prevented from voting twice in the same ballot.
- View published results after admins publish them.

### Internal Evaluator

An internal evaluator is a Year 2 committee member whose student email is included in the internal whitelist. The whitelist should contain only eligible Year 2 internal voters, even if the full committee has 58 members.

They should be able to:

- Sign in before AGM day.
- Complete their voter profile.
- Access the internal evaluation window while it is open.
- Score every active candidate using the internal rubric.
- Edit their submitted scores until the internal window closes.
- Be locked out of further edits once the internal window closes.
- View public AGM status on AGM day, but not cast an external public vote.

### Admin

An admin is a signed-in user granted admin access through an admin allowlist. Admin access must not depend on a shared password typed into the website.

They should be able to:

- Configure election settings.
- Import the internal Year 2 whitelist.
- Manage candidates and candidate photos.
- Assign each candidate to one or more eligible positions.
- Configure position hierarchy and exact AGM-day ballot order.
- Open and close the internal evaluation window.
- Monitor internal evaluation completion.
- Open and close public AGM voting sessions.
- View live operational counts.
- Resolve required manual decisions.
- Publish final results.
- Export election data for records and audit.

### Super Admin Or Election Operator

This is the trusted person or small team responsible for initial setup and emergency recovery.

They should be able to:

- Bootstrap the first admin account.
- Manage the admin allowlist.
- Correct setup mistakes before windows open.
- Access restricted emergency audit data when necessary.
- Record reasons for manual overrides or tie resolutions.

## Authentication And Session Requirements

The preferred sign-in experience is client-only persistent authentication using Microsoft/Outlook SSO through Firebase Authentication or an equivalent managed auth provider. This is because `@student.usm.my` accounts are Outlook-backed rather than Google-backed.

Requirements:

- Users should sign in once and remain authenticated for a reasonable period.
- Users should not need to request a new code on every page refresh.
- The app should work without requiring a separate custom backend server terminal for authentication.
- The app should reject non-`@student.usm.my` users after sign-in.
- The app should identify the signed-in user by stable identity, email, and provider UID.
- The user-facing requirement is persistent USM student sign-in; the exact provider can be changed if Microsoft SSO is not viable in the final implementation.

Known pitfall to avoid:

- Do not implement custom email OTP entirely on the client. Secure OTP generation, email sending, and verification require a trusted server or managed service.
- Do not use a shared admin password stored in frontend environment variables.

## Voter Profile Requirements

After first sign-in, every voter must complete a profile before participating in any voting or evaluation flow.

Required fields:

- Student email, read from authentication and not editable by the user.
- Full name.
- Matric number.
- Year of study.

Acceptance criteria:

- A signed-in user without a completed profile sees a clear prompt to complete it.
- The user cannot vote or submit internal evaluations until the profile is complete.
- The user can update their profile before voting windows close.
- The system keeps profile data separate from public result display.

## Election Setup

Admins must be able to prepare an election before internal evaluation or public voting begins.

Admin setup stories:

- As an admin, I can create a new AGM election cycle so that this year’s setup does not mix with old election data.
- As an admin, I can import the Year 2 internal whitelist from CSV so that only eligible Year 2 committee members can submit internal evaluations.
- As an admin, I can manually review and edit the whitelist before opening internal evaluation.
- As an admin, I can add candidates with name, matric number, photo, and eligible positions.
- As an admin, I can edit candidate details before voting begins.
- As an admin, I can remove a candidate before voting begins if they are not part of any locked evaluation or active ballot.
- As an admin, I can optionally import candidate data from CSV, then review and fix it in the admin UI.
- As an admin, I can define the broad position hierarchy: President, Vice Presidents, then Directors.
- As an admin, I can configure the exact order of ballots within the same tier before AGM day.

Default known position set from prior internal selection:

- President.
- Vice President of Internal Affairs.
- Vice President of External Affairs.
- Director of Secretarial Department.
- Director of Financial Department.
- Director of Creative Department.
- Director of Growth Marketing Department.
- Director of Community Engagement Department.
- Director of Technical Department.

The system should not hardcode this list as the only possible election configuration. Admins should be able to adjust positions for future AGM cycles.

## Candidate Eligibility And Hierarchy

Some candidates may compete for multiple positions. For example, a candidate may run for President and also be eligible for Vice President of Internal Affairs if they do not win President.

Requirements:

- Each candidate can be assigned to one or more eligible positions.
- The public AGM voting order follows position hierarchy from highest to lowest.
- Once a candidate wins a higher position, they are automatically removed from all lower-position ballots.
- If a candidate loses a higher position, they remain eligible for their next configured lower position.
- The exact order of same-tier ballots must be configurable by admins.
- A candidate must not be able to win multiple positions in the same election cycle.

Acceptance criteria:

- If Candidate A is eligible for President and VPIA, and wins President, Candidate A does not appear in the VPIA voting session.
- If Candidate A loses President, Candidate A remains available for VPIA if configured.
- Admins can preview the effective ballot order and candidate cascade before AGM day.

## Internal Evaluation Window

Internal evaluation happens before AGM day, typically about one week before the public AGM vote.

Only Year 2 internal whitelist members can submit internal evaluations. Year 1 members, even if they are committee members, are treated as external voters and do not receive internal evaluator access.

Internal evaluation is rubric-based, not a simple one-candidate-per-position vote.

Internal rubric scores are candidate-level evaluations. If a candidate is eligible for multiple positions, the same internal rubric result is reused when calculating that candidate's internal component for each eligible position. The public AGM ballot remains position-specific.

Rubric categories:

- Leadership.
- Teamwork and Communication Skills.
- Professionalism and Ethics.
- Commitment.
- Personality.

Score scale:

- Integer scores from 1 to 5.
- 1 means Unsatisfactory.
- 2 means Satisfactory.
- 3 means Average.
- 4 means Competent.
- 5 means Excellent.

Internal evaluator stories:

- As a Year 2 internal evaluator, I can see all active candidates and their eligible positions.
- As a Year 2 internal evaluator, I can score each candidate against every rubric category.
- As a Year 2 internal evaluator, I must complete scores for every active candidate before submitting.
- As a Year 2 internal evaluator, I can save progress if the form is long.
- As a Year 2 internal evaluator, I can edit my submitted evaluation until the internal window closes.
- As a Year 2 internal evaluator, I cannot edit scores after the internal window closes.

Admin stories:

- As an admin, I can open and close the internal evaluation window.
- As an admin, I can see which internal evaluators have submitted.
- As an admin, I can see aggregate internal scores by candidate and understand which positions each candidate is eligible for.
- As an admin, I can export internal evaluation data.
- As an admin, I cannot accidentally reopen or modify a closed internal window without a clear warning and audit record.

Known pitfalls to avoid:

- Do not allow partial internal submissions to affect results.
- Do not count Year 1 committee members as internal voters.
- Do not let an internal voter switch to external voting if they miss the internal window.
- Do not reveal internal evaluator choices publicly.

## Public AGM Voting Window

Public voting happens during the live AGM event. Public voting is simpler than internal evaluation: eligible external voters choose one candidate for the currently active position.

Eligibility:

- Any signed-in `@student.usm.my` user who is not in the Year 2 internal whitelist can vote as an external voter.
- Year 2 internal whitelist members cannot cast external votes on AGM day.
- Physical attendance is not enforced by the website. Any eligible signed-in USM student may vote while the public voting window is open.

Public voter stories:

- As an external voter, I can see when no public voting session is active.
- As an external voter, I can stay on the page and wait for the next live ballot.
- As an external voter, I can see the currently active position.
- As an external voter, I can see eligible candidates for that position.
- As an external voter, I can choose exactly one candidate.
- As an external voter, I must confirm before my vote is submitted.
- As an external voter, I receive clear confirmation after voting.
- As an external voter, I cannot vote again for the same position.
- As an external voter, I do not see live results while voting is ongoing.

Admin stories:

- As an admin, I can start the next public voting session according to the configured ballot order.
- As an admin, I can stop the current public voting session.
- As an admin, I can see live vote counts for operational monitoring.
- As an admin, I can prevent two public voting sessions from being active at the same time.
- As an admin, I can see which positions are completed, active, or pending.
- As an admin, I can preview the next ballot after hierarchy cascade rules are applied.

Known pitfalls to avoid:

- Do not show candidates who already won higher positions.
- Do not allow multiple active public sessions unless the product explicitly supports parallel voting later.
- Do not expose live public vote results to voters.
- Do not reset vote records accidentally while a session is active.

## Ballot Choice Rules

For public voting:

- Each ballot represents one position.
- A voter can choose exactly one listed candidate.
- There is no built-in abstain option.
- If the committee wants abstain to be available, admins must add it intentionally as a candidate-like option for that ballot.

For internal evaluation:

- Internal evaluators do not select one winner per position.
- Internal evaluators score candidates using the rubric.
- Every active candidate must be scored before final submission.

## Result Calculation

The final result is calculated per position.

The system must normalize internal and external components separately, then combine them:

- Internal component contributes 75% of the final result.
- External public vote component contributes 25% of the final result.

Recommended calculation model:

1. For a given position, determine candidates eligible for that position after hierarchy rules.
2. Calculate each eligible candidate's internal rubric average using their candidate-level internal evaluation scores.
3. Normalize internal scores across candidates in that position to produce each candidate’s internal share.
4. Count public votes for that position.
5. Normalize public votes across candidates in that position to produce each candidate’s public share.
6. Final score = internal share * 75% + public share * 25%.
7. Highest final score wins, subject to tie rules.

Important clarification:

- Do not treat each internal vote as adding `0.75` and each external vote as adding `0.25`.
- The 75/25 split should not be distorted by turnout differences between internal and external voters.
- Internal and external groups are normalized separately before combining.

## Tie Rules

Tie handling must be deterministic and visible to admins.

Tie order:

1. Highest final combined score wins.
2. If final combined score is tied, the candidate with the higher internal score wins.
3. If internal score is also tied, the system flags the tie for manual committee/admin resolution.
4. Manual resolution must record the selected winner and the reason.

Acceptance criteria:

- The system clearly marks a tie instead of silently choosing a winner.
- Manual tie resolution is audited.
- Published results should indicate when a manual tie resolution affected the winner.

## Result Visibility And Publishing

Live voting results must not be visible to voters during active voting.

Admin visibility:

- Admins can see live operational counts during voting.
- Admins can see internal evaluation completion and aggregate scores.
- Admins can preview combined results before publishing.
- Admins can publish final results when ready.

Public visibility after publishing:

- Published results should show the winner for each position.
- Published results should show each candidate’s internal share.
- Published results should show each candidate’s public vote share.
- Published results should show each candidate’s final combined percentage.
- Published results should make the 75/25 rule understandable.

Known pitfalls to avoid:

- Do not let voters see live vote counts during voting.
- Do not publish partial or unconfirmed results by accident.
- Do not hide the 75/25 breakdown after results are published.

## Privacy And Audit Requirements

The normal product experience should protect voter privacy while still supporting audit needs.

Requirements:

- Public pages must never expose individual voter choices.
- Normal admin views should focus on participation status, aggregate scores, counts, and results.
- Voter-to-choice mappings should not appear in regular admin screens.
- Restricted emergency audit/export access may exist for trusted operators.
- Any emergency access to voter-to-choice data should be clearly marked and logged.
- Participation records are allowed so the system can prevent duplicate voting.

Exports:

- Admins can export internal scores.
- Admins can export public vote counts.
- Admins can export combined results.
- Admins can export voter participation status.
- Admins can export an audit log of admin actions.
- Public exports must not disclose voter-to-choice mappings.

## Admin Management

Admin access must be identity-based.

Requirements:

- Admins sign in with the same persistent auth system as other users.
- Admin authorization is based on a protected admin allowlist.
- The first super admin may be bootstrapped manually.
- Existing admins or super admins can add/remove other admins if permitted.
- Admin management actions must be logged.
- A removed admin should lose access after their session refreshes or immediately if supported.

Known pitfalls to avoid:

- Do not use a shared admin password.
- Do not store admin credentials in frontend environment variables.
- Do not allow frontend-only checks to be the only protection for admin data.

## Support And Error States

The website should guide users during stressful live-event conditions.

Required states:

- Signed out.
- Signed in but profile incomplete.
- Signed in but not eligible.
- Internal evaluator before internal window opens.
- Internal evaluator while internal window is open.
- Internal evaluator after submission.
- Internal evaluator after window closes.
- External voter waiting for public session.
- External voter during active public session.
- External voter after voting.
- External voter trying to vote twice.
- Admin with no election configured.
- Admin with setup incomplete.
- Admin during active internal window.
- Admin during active public voting session.
- Admin reviewing and publishing results.

Error messages should be plain and actionable:

- Tell users whether they are signed in.
- Tell users whether they are eligible.
- Tell users whether voting is currently open.
- Tell users who to contact for support.
- Avoid exposing internal technical errors to voters.

## Operational Safeguards

The system must prevent common election mistakes.

Required safeguards:

- Confirm before opening or closing voting windows.
- Confirm before publishing results.
- Block candidate edits after relevant voting/evaluation has started unless an emergency override is used.
- Block deletion of candidates attached to locked evaluations or completed ballots.
- Block reset actions during active voting.
- Keep audit logs for admin actions.
- Show setup readiness before internal or public windows can open.
- Warn if the internal whitelist is empty.
- Warn if no candidates are configured for a position.
- Warn if a candidate is assigned to conflicting or unexpected positions.
- Warn if final results cannot be calculated because a required phase has no data.

## Non-Goals For This Document

This document does not decide:

- The frontend framework.
- The database product.
- The hosting provider.
- The exact security rules syntax.
- The final folder structure.
- The visual design system.

The only technical preference captured here is the user-facing requirement for client-only persistent sign-in, preferably through Microsoft/Outlook SSO because USM student accounts are Outlook-backed.

## Definition Of Done

The new AGM website assignment is complete when:

- Admins can configure a complete AGM election cycle.
- Year 2 internal whitelist members can complete rubric-based internal evaluation before AGM day.
- External voters can vote during live AGM sessions.
- Candidate hierarchy prevents one person from winning multiple positions.
- Results combine normalized internal scores and normalized public votes using the 75/25 rule.
- Ties are handled according to the defined rules.
- Results can be reviewed, published, and exported.
- Voter privacy is protected in public and normal admin views.
- Admin actions are auditable.
- The website can be operated without a custom local backend server terminal during normal development and event operation.
