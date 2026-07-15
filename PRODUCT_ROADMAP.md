# Jerboa Circle — five-year product and archive roadmap

Audit date: 2026-07-15
Product principle: grow through durable relationships and editorial memory, not through disconnected features.

## Product model

Jerboa Circle is one archive with three connected experiences:

1. **Public publication** — a first-time visitor should understand the institution, enter through the current programme, and follow ideas across earlier editions.
2. **Member room** — a participant should see what is next, join or resume a programme, and preserve a personal practice record.
3. **Keeper desk** — an editor should enter a fact once, reuse it everywhere, detect incomplete records, preview the result, and recover safely.

Chronology should remain the default archive view because it explains institutional continuity without teaching a new interface. Constellation remains the secondary research view: it reveals relationships and highlights the open programme, while using exactly the same records and filters.

## Whole-site review

### Public home, current programme, and archive

**Purpose:** clear. The page explains Jerboa Circle, makes the current programme prominent, and leads naturally into the archive.

**What works:** chronology and constellation are complementary rather than competing views; search and filters are shareable in the URL; public records exclude drafts and private material; empty searches offer recovery; responsive navigation keeps the same information order.

**Opportunity:** when programmes are created only through server sync, static titles, social cards, sitemap entries, the feed, and the structured export do not update in the same transaction. This is a publication-system issue, not a visual one.

### Programme detail

**Purpose:** strong. A programme is preserved as an edition with its passage, materials, reading list, provenance, and links to other editions.

**What works:** the reading list is generated from reusable reference records; connections are reciprocal; unpublished and missing states do not reveal private titles; keepers can edit in context after authorization.

**Opportunity:** publishing should refuse records with broken relationships, incomplete image rights, or missing share metadata, and should create an immutable edition snapshot.

### Reference catalogue

**Purpose:** clear. It shows the books, artworks, quotations, images, places, and themes that form the intellectual structure behind programmes.

**What works:** stable detail routes, provenance, citation copy, print, parent/child source relationships, reciprocal programme links, search and type filters. Search and filter state now persists in the URL.

**Implemented in this pass:** reference records are now first-class editable content in the Keeper Desk and shared sync. A keeper can add or edit a source once and every programme using it receives the update. Backup and recovery include these records.

**Media checkpoint:** every editorial and member-room manuscript plate now resolves through one reusable media registry. Each public-domain work carries an exact museum title, object number, source URL, rights URL, credit, and descriptive alt text; its catalogue record and on-page image can no longer drift into separate metadata.

### Member room

**Purpose:** coherent. The calendar, programme detail, enrolment, personal register, profile, and continuation prompts form one participant journey.

**What works:** returning members can resume the next programme or unfinished reflection; calendar records can open the corresponding public programme; destructive actions use recoverable confirmations; offline work is described as local rather than lost.

**Critical limit:** selecting a displayed name is not authentication. The current shared data model must not be treated as private storage for sensitive reflections, attendance, or images. This requires real identity and authorization, not a cosmetic PIN.

### Keeper desk and text register

**Purpose:** clear. Programme records, recurring site copy, publication state, backups, revisions, and shared sync are maintained in one operational area.

**Implemented in this pass:** books, artworks, quotations, images, places, and themes can be maintained from a dedicated reference register. Programme pickers use the current register rather than source-code constants. Integrity checks now flag duplicate IDs, broken parent links, orphan quotations, and missing source, rights, or alt text for visual material. Long-lived shared keys are no longer retained in persistent browser storage.

**Remaining friction:** seasons, collections, programme relationship notes, and people are still source-controlled taxonomies. Adding them should become schema-driven only after the durable storage layer exists; another independent browser-only editor would create more migration work.

### Error, empty, offline, and recovery states

**Purpose:** complete at the current storage layer. Missing public routes, unpublished records, temporarily unavailable sync, empty search, conflicts, imports, and offline drafts each have distinct messages and recovery paths.

**Implemented in this pass:** the profile seal is a real keyboard-operable control. Reference backup imports are structurally validated before replacement.

## Architecture assessment

The current normalized IDs and reusable relationships are a sound content model. The storage model is not a five-year model: a mutable JSON blob plus browser storage creates whole-dataset conflicts, weak privacy boundaries, limited auditability, and expensive media payloads. Do not patch around this with more local-storage systems.

Target entities should be versioned records: `Programme`, `ProgrammeEdition`, `Reference`, `Person`, `TaxonomyTerm`, `ProgrammeRelation`, `MediaAsset`, `Member`, `Enrollment`, `PracticeEntry`, and `PublicationRevision`. Media binaries should live in object storage; records should contain rights, source, credit, alt text, dimensions, focal point, and derivatives. Public pages, feeds, maps, reading lists, and exports should all be projections of those records.

## Prioritized roadmap

### Critical

1. **Real member identity, invitation, and row-level authorization.** First-time invited members get an understandable and trustworthy entrance; long-term members can safely keep reflections, attendance, and profile media across devices. Use expiring invitations or passwordless sign-in, server sessions, authorization on every read/write, consent, retention, export, and deletion controls.

2. **Durable normalized database, object storage, and migrations.** First-time visitors receive faster, stable public pages even as the archive grows; long-term members and keepers avoid whole-file conflicts and silent data loss. Migrate programmes, references, relations, members, enrollments, practice entries, and revisions into transactional records with schema migrations and backups.

3. **Transactional publication pipeline.** First-time visitors never encounter an edition whose page, social card, sitemap, feed, and search index disagree; long-term members can rely on stable edition history and links. One publish action should validate, snapshot, generate/revalidate all public projections, and record who published what and when.

4. **Media provenance and rights migration.** First-time visitors receive meaningful alt text and verifiable credit; long-term members and the institution can reuse material without losing origin or permission context. Audit every current visual asset, then require source URL, credit, rights status, alt text, and derivative metadata before publication.

### High Value

1. **Schema-driven taxonomy and people management.** First-time visitors can follow a person, theme, season, or collection consistently; long-term members can retrieve related programmes years later. Add keeper editors for people, seasons, collections, and theme aliases once they share the durable database and revision model.

2. **Unify programme publication and member scheduling.** First-time visitors see one authoritative description and date; long-term members do not encounter calendar details that diverge from the archive. Treat member sessions as scheduled occurrences of a programme edition, with member-only operational fields layered on top.

3. **Preview, validation diff, scheduled release, and rollback.** First-time visitors receive complete records; members see accurate enrolment and reading material at release time. Keepers should preview desktop/mobile output, see changed fields and integrity failures, schedule publication, and restore the previous published revision.

4. **Generated search index when volume requires it.** First-time visitors can browse without knowing exact terminology; long-term members and researchers can retrieve a remembered quotation, person, place, or image across hundreds of records. Keep current client search until the dataset materially grows, then generate a faceted index from the same normalized records.

5. **Privacy-aware operational observability.** First-time visitors face fewer broken links and failed joins; long-term members get more reliable scheduling and sync. Measure publication failures, asset errors, empty searches, and enrolment failures without collecting reflection content or unnecessary identity data.

### Nice to Have

1. **Optional saved reading lists after authentication.** First-time visitors can continue using local bookmarks without an account; long-term members can keep selected programmes and sources across devices. Build this only on the identity layer, not as another anonymous server profile.

2. **Curator export bundles.** First-time visitors and researchers can download a concise citation or reading packet; long-term members can preserve the materials of a completed programme. Generate PDF/CSV/JSON from existing programme and reference records rather than maintaining separate documents.

3. **Lightweight editorial analytics.** First-time visitors benefit when failed searches reveal missing terminology; long-term members benefit when confusing enrolment paths are corrected. Collect aggregate, privacy-preserving signals only, with no personal practice text.

4. **Component-level CSS consolidation during functional work.** First-time visitors and members see fewer regressions across browsers and screen sizes; maintainers can change behaviour without fighting layered overrides. Preserve the current visual language and consolidate only the component being touched.

### Future Ideas

1. **IIIF-compatible image records.** First-time visitors gain scholarly zoom and clear reuse terms; long-term members and researchers can compare details across programmes. Introduce only when the archive owns or can lawfully expose suitable high-resolution media.

2. **Authority identifiers and linked cultural data.** First-time visitors get clearer context for unfamiliar people and works; long-term researchers can connect Jerboa records to library and museum systems. Add optional VIAF, Wikidata, ORCID, ISBN, or museum object identifiers without making external services a runtime dependency.

3. **Moderated member annotations.** First-time visitors could eventually encounter selected collective insight; long-term members could preserve connections across editions. Build only with explicit consent, moderation, provenance, withdrawal, and public/private boundaries.

4. **Edition comparison and institutional continuity export.** First-time visitors can understand how a programme evolved; long-term members and future keepers can trace editorial decisions. Provide diffs, signed exports, recovery drills, and role-handover documentation once immutable publication revisions exist.

## First implementation checkpoint

This pass deliberately implements only improvements that strengthen the existing archive model without pretending the current storage layer is the final infrastructure:

- first-class reference editing and shared synchronization;
- reference-aware programme validation and integrity reporting;
- source, rights, and alt-text completeness checks for visual records;
- reference-inclusive validated backup and recovery;
- shareable catalogue search/type state;
- session-only handling of shared operational keys;
- keyboard-operable profile seal;
- current member-layout consistency;
- a shared media-asset registry and seven verified Metropolitan Museum of Art public-domain manuscript records;
- generated catalogue provenance, institutional source links, rights links, credits, and alt text for every current editorial plate.

The next implementation phase should begin with the Critical infrastructure decisions above, not with additional public-facing features.

## Second implementation checkpoint

The publication workflow now separates routine draft synchronization from an intentional public release:

- a programme must pass required-field, relationship, visibility, reference, image-source, rights, and alt-text checks before release;
- warnings remain visible but only blocking errors disable publication;
- publication requires an authenticated archive role or shared ledger key and a final confirmation;
- each successful release records an append-only manifest with the exact programme metadata, connected reference metadata, poster checksum, timestamp, and content fingerprint;
- the server rejects synchronization that removes or mutates an existing publication manifest;
- backups, recovery files, and shared synchronization now carry publication history under schema version 3 while retaining compatibility with versions 1 and 2.

This is a safe bridge to the future transactional database: it establishes publication semantics and immutable edition identity now, without pretending browser storage is the final institutional repository.

## Third implementation checkpoint

Public programme editions and private-room schedule occurrences now share one editorial source without collapsing their different responsibilities:

- a member schedule occurrence can inherit its title, summary, full description, and themes from a published programme record;
- date, duration, capacity, participation cost/reward, recurrence, and enrolment remain occurrence-level operational fields;
- existing workshops with a distinct session title remain in “session copy” mode and keep their wording intentionally;
- editors can switch a linked occurrence to automatic programme copy with one control instead of re-entering four text fields;
- the private room reads the current public archive projection without overwriting keeper drafts in browser storage;
- schedule integrity checks surface missing programme links, duplicate occurrence IDs, invalid time ranges, and intentional copy overrides;
- member backup schema version 2 preserves the inheritance choice while continuing to accept version 1 files.

This reduces editorial drift for first-time visitors moving from a member invitation to the public record, while long-term members receive consistent programme context even when a curator improves the canonical description later.

## Fourth implementation checkpoint

Published editions can now be compared and recovered without weakening the append-only archive:

- the keeper sees whether a record is being published for the first time or how many fields changed from the latest edition;
- changed metadata, poster fingerprints, and added or removed reference records are summarized before the final publication action;
- a previous published edition can be copied into a new recovery draft without deleting or rewriting any publication manifest;
- recovery drafts deliberately begin as `preview` and `unlisted`, preventing an old edition from silently replacing the current public record;
- embedded poster binaries are never reconstructed from a checksum; when no durable source URL exists, recovery preserves the current poster and requires visual review.

For first-time visitors this reduces accidental incomplete or contradictory releases. For long-term members and future keepers it preserves a legible editorial chain while making recovery practical instead of destructive.
