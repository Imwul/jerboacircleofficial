# Jerboa Circle product and archive roadmap

## Product direction

Jerboa Circle should grow as one connected cultural archive with three surfaces:

1. The public publication helps a first-time visitor understand the circle, enter through a programme, and follow ideas across editions.
2. The member room helps a participant understand what is next, join a programme, and preserve a personal practice record.
3. The keeper desk lets a small editorial team publish once, reuse structured knowledge, detect broken links, and recover safely.

The archive should gain depth through relationships, not through an ever-growing set of unrelated features.

## Implementation status — relationship and publication phase

Completed in the second product pass:

- Chronology remains the default public archive view. A new Constellation view presents the same filtered records as a relationship map, centers and highlights the currently open programme, and distinguishes chronology, shared-source, and shared-theme links.
- Books, quotations, images, places, artworks, and themes now have a public catalogue index and stable detail routes. Programme records link into these nodes, and each node links back to every public programme where it appears.
- Member calendar sessions can link to a public archive record. The keeper chooses the relationship once; members can open the publication, reading materials, and archive context without duplicated descriptions.
- Public build outputs now include an Atom feed, sitemap, robots policy, and versioned structured archive export. These use the same source records as the website.
- Shared member and archive payloads now carry an explicit schema version. This is the starting point for future migrations rather than an assumption that browser data will never change shape.
- The programme editor now keeps hooks stable when opening and closing and traps focus inside the active dialog, supports Escape, and restores focus to the trigger.

Completed in the third product pass:

- Reference records now support creator, date, edition, locator, source URL, rights, language, citation note, and image alt text. Catalogue pages expose the recorded provenance without fabricating missing data.
- Every programme reading list is generated from its reusable reference relationships. Updating a source node changes every programme context that uses it instead of duplicating copy.
- Keeper and contextual record editors use the same searchable relationship picker for collections, references, and related programmes. Raw slash-separated IDs are no longer the primary editing workflow.
- Both record editors now share one form model, conversion layer, and validation function, preventing the detail editor and Keeper Desk from accepting different data.
- Archive and member backup imports are version-checked, size-limited, structurally validated, summarized, and only then applied through an accessible confirmation dialog.
- Event, member, and personal-register deletion now use the same accessible confirmation dialog instead of browser alerts; image failures remain in context as recoverable status messages.
- Catalogue records provide citation-copy and print actions generated from the same provenance metadata.
- Offline member and keeper work is explicitly marked as a local draft rather than a failed save.
- Archive routes distinguish loading, temporarily unavailable, unpublished, and not-found states without exposing private titles.
- Returning members now see their next enrolled programme and unfinished daily reflection before opening the full calendar.

Still intentionally requires a separate infrastructure phase:

- Member authentication and per-member server authorization need an identity and invitation policy. A cosmetic PIN layered over the current shared JSON blob would imply privacy without providing it.
- Record-level database storage, migrations, media storage, scheduled publishing, and cross-device saved lists require a durable backend migration. They should be implemented together rather than added as parallel browser-storage mechanisms.
- IIIF, transcripts, and edition comparison remain conditional future systems; they should only be introduced when the archive has the corresponding rights, media, and revision material.

## Page and workflow review

### Public home and archive

Purpose is clear: explain the institution, foreground the current programme, and expose the programme wall. Search already includes programme copy, themes, seasons, collections, references, and related records.

Completed now:

- Search, status, season, collection, and bookmark-only filters persist in the URL. A visitor can share a view and return from a record without rebuilding it; a long-term member can keep a repeatable research path.
- A single reset action clears all archive filters.
- Images retain the existing design but use smaller delivery formats.
- Only public, published server records are delivered to anonymous visitors.

Current-scale status:

- Every reference node already has a stable catalogue page and reciprocal programme links.
- Sitemap, Atom feed, robots policy, and structured archive export are generated from the publication data.
- The current client index remains appropriate for the catalogue size; a generated server search index is deferred until volume warrants it.

### Archive record

Purpose is strong: preserve the programme as an edition with passage, materials, metadata, references, and connections to other editions.

Completed now:

- Public records have unique build-time titles and descriptions plus richer live Open Graph and X metadata.
- The embedded editor is hidden unless an archive-editor session is already authenticated. First-time visitors see a coherent publication page; keepers retain contextual editing after authentication.
- Unlisted, preview, and missing records are marked not to be indexed.

Completed:

- References support edition, locator, source URL, rights, language, citation note, creator, date, and image alt text.
- Programme reading lists are assembled automatically from reusable reference relationships.

Editorial follow-up:

- Source URLs and edition-specific locators should only be added after a keeper verifies the exact edition; empty provenance is preferable to invented certainty.

### Member room

The calendar, programme detail, capacity, join/cancel actions, calendar export, practice record, profile, and participant-journey tools form a coherent member workflow.

Completed now:

- A rendering failure no longer offers destructive deletion as the primary recovery action. Members can reload or download an emergency backup.
- The entire member surface is excluded from indexing.

Critical remaining issue:

- Selecting a displayed name is not identity verification. Before the room holds real private reflections or media, introduce member authentication and server-side per-member authorization. A first-time invited member gets a clear, safe entrance; a long-term member can trust that personal records are not exposed to another visitor or shared-device user.

Workflow improvements to follow authentication:

- “My next programme” and the latest unfinished daily reflection now appear as direct resume actions while the full calendar remains one step away.
- Backup replacement, account deletion, member deletion, and event deletion use accessible, recoverable in-product confirmations.
- Programme, confirmation, avatar, member-editor, bulk-date, and synchronization-code dialogs trap focus, support Escape, and restore focus.

### Keeper desk and text register

The desk supports drafts, publishing stages, visibility, seasons, collections, revisions, file backup, shared sync, conflict recovery, poster preparation, and site-wide copy.

Completed now:

- The desk detects missing seasons, collections, reference nodes, programme links, relation targets, and parent references.
- Invalid collection, reference, and related-programme IDs are blocked before saving.
- Keepers can see the valid reference and programme IDs next to the relevant fields.
- Static routes are generated from the actual public event data rather than a text pattern that also mistook seasons and themes for routes.

Completed:

- Collections, references, and related programmes use searchable relationship pickers in both editor surfaces.
- The detail editor and Keeper Desk share one record form model, conversion layer, and validator.

Remaining before catalogue growth:

- Reference nodes, programme relations, seasons, collections, people, and media still live in source files. Move them to first-class keeper editors as part of the durable backend migration so a second browser-only draft system is not introduced.

### Missing and error states

The public missing route has a clear return path and is excluded from indexing. Search and calendar empty states suggest a recovery action. Sync conflicts preserve local recovery files.

Completed:

- Public records distinguish loading, not found, not yet published, and temporarily unavailable without revealing private titles.
- Member and keeper surfaces announce offline work as locally preserved and pending a later shared seal.

## Prioritized roadmap

### Critical

1. **Member identity and per-record authorization — infrastructure decision required.** First-time invited members need a safe, understandable entrance; long-term members need durable privacy for reflections, attendance, images, and profiles. Use expiring invitations or passwordless links, server sessions, and authorization on every member read/write—not only on admin sync.
2. **Durable, versioned storage — infrastructure decision required.** The current shared JSON blob and browser storage are useful for a small circle but will become a contention and payload bottleneck. Move programmes, members, attendance, habits, archive records, references, and revisions into versioned server-side records with migrations. Visitors receive faster public reads; members and keepers avoid whole-dataset conflicts and silent schema drift.
3. **Public/private publication boundary — implemented and regression checked.** Draft and private archive records are excluded from anonymous responses and static publication routes.
4. **Safe recovery — implemented at the current storage layer.** Destructive error reset is removed; member and archive imports are validated before an accessible confirmation, conflicts preserve recovery files, and keeper revision restore remains explicit.

### High Value

1. **Unified cultural catalogue — public layer implemented; editing layer awaits durable storage.** Programme, reference, book, artwork, quotation, place, image, season, and collection records use stable IDs and reciprocal links. Person records remain a future schema addition when named contributors are ready for publication.
2. **Connect public programmes to member sessions — implemented.** Calendar sessions carry a stable archive record relationship and open the publication context without duplicate descriptions.
3. **Schema-driven keeper workflow — core implemented.** Both record editors share conversion and validation, while searchable relationship pickers replace raw IDs. First-class editors for reference and taxonomy records belong with the backend migration.
4. **Reference and media management — metadata foundation implemented.** Provenance, creator, date, rights, language, citation, and alt text are reusable. Crop/focal point and derivative generation belong with durable media storage.
5. **Scalable archive search.** Keep the current client search while the catalogue is small, then move to a generated search index with facets for content type, person, reference, year, season, and theme. Newcomers can browse without knowing exact terms; researchers and members can retrieve a remembered fragment years later.
6. **Publication previews and scheduled releases.** Add a true preview URL, validation summary, and optional publish time. First-time visitors encounter complete editions; keepers can review links, metadata, rights, and mobile copy before release.
7. **Operational observability.** Track sync failure rates, publication validation failures, empty searches, join failures, and asset errors without collecting reflection text. Visitors face fewer broken paths; members get more reliable programme operations.

### Nice to Have

1. **Public reference pages and generated reading lists — implemented.** Visitors get an approachable route into the intellectual context; members can revisit a programme’s sources after it ends.
2. **Cross-device saved archive lists.** Anonymous bookmarks can stay local; authenticated members may opt into syncing them. First-time visitors can save without an account; long-term members can maintain research lists across devices.
3. **RSS/Atom release feed — implemented.** Email delivery can consume the same feed later rather than becoming another content source.
4. **Citation and print export — implemented.** A clean citation or print record helps visitors reference Jerboa Circle and helps members preserve a reading packet.
5. **Better accessible dialogs and status announcements — implemented for current workflows.** This benefits keyboard, screen-reader, and mobile users across both first and repeat visits.
6. **CSS consolidation.** The layered repair styles work but are costly to reason about. Consolidate by component when touching functionality, without redesigning the visual language.

### Future Ideas

1. **Institutional data export and read-only API.** A documented JSON or CSV export lets libraries, researchers, and future Jerboa projects reuse the archive without scraping it.
2. **IIIF-compatible image records.** Consider only when artworks and manuscript images require scholarly zoom, manifests, and rights-aware reuse.
3. **Oral-history and transcript records.** Add only when programmes begin producing recordings with consent, transcript, rights, and preservation workflows.
4. **Edition comparison.** Once a work has meaningful revisions, show what changed between published editions. Visitors understand the publication history; members can trace how collective inquiry evolved.
5. **Institutional continuity package.** Scheduled full exports, documented recovery, role handover, and retention policy protect the archive beyond any one maintainer.

## Performance, accessibility, and SEO baseline

- The production check passes TypeScript, build, static-route smoke tests, and asset budgets.
- Delivered assets are 4.66 MB; the largest remaining asset is the Korean font at 1.75 MB. Further font subsetting should happen only with a tested Korean character strategy.
- Public archive records receive build-time unique titles and descriptions. Private/member/editor routes and missing pages are noindex.
- Existing reduced-motion and focus-visible support should be retained. The next accessibility work is dialog focus management, status consistency, and testing at 200% zoom.
- Static route metadata currently covers source-controlled public records. When server-created records become common, publishing must generate or revalidate their static metadata, sitemap entry, and social image as part of the same transaction.
