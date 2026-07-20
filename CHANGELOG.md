# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and the project uses Semantic Versioning.

## [Unreleased]

### Added
- **Edges as first-class learning objects.** Summary pages record knowledge-boundary questions in frontmatter `edges:` (`id`, `text`, `state: open|exploring|resolved`, `targets`, `created`, `resolved_at`, `pkb_ref`). The rebuild pipeline generates `meta/edges.json` and `meta/edges.md` (the learning frontier: open, exploring, recently resolved).
- **Bridge section.** The summary template now includes a `## Bridge` section persisting the workshop platform (what you already know / what is genuinely new / where the edge is).
- **Integration enforcement.** `wiki_integrate_source` refuses to integrate a summary page that lacks `edges:` frontmatter, a `## Bridge` section, or concrete `## Integration targets` — filing without understanding is a tool-level error.
- **Lint mode `edges`.** New `edges` lint checks: integrated summaries missing `edges:` (warning), invalid edge states (error), resolved edges without `resolved_at` (info), missing `## Bridge` (info). Also runs under mode `all`.
- **Graduation mode in wiki-workshop.** The recall skill is merged into `wiki-workshop` as graduation mode (`instructions/graduation.md`): compares wiki vs PKB against the page's open edges, closes resolved edges in frontmatter, surfaces drift as a learning event, and marks pages consumed.
- **Lifecycle backlog: open edges.** `wiki_scan_activity` now returns `lifecycle.openEdges` (open/exploring edges with age), and the activity summary prints the learning frontier.

### Changed
- **`recall` skill removed.** Its protocol lives on as graduation mode in `wiki-workshop`; the gap list is framed as a learning signal keyed to edges rather than bookkeeping.
- **wiki-intel reviews include the frontier.** Plans and reviews read `meta/edges.md` and surface aging open edges as graduation candidates.
- Forked from pi-llm-wiki v0.1.0
- Renamed to pi-brain-wiki
- Adapted page model: summary, topic, plan, review
- Three agent skills: map, workshop, intelligence
- New wiki_scan_activity tool
- Wiki conformance lint: page-type required fields, allowed statuses, relational rules (topic source_ids resolve to summaries, integrated summaries require integrated_at), and inbox-link prohibition

### Changed
- Summary pages now require a `summary` frontmatter field. After upgrading, run `wiki_lint` against existing vaults and address any conformance errors surfaced by the new rules, including status allowlists, required fields, relational rules (topic `source_ids` resolving to summaries and integrated summaries requiring `integrated_at`), `consumed` pages requiring `consumed_at` and `pkb_refs`, and the prohibition on wiki links into `inbox/` paths.

## [0.1.0] - 2026-04-04

### Added
- Initial release of `pi-llm-wiki`
- README now explicitly credits Andrej Karpathy's LLM Wiki gist as the inspiration for this implementation
- Pi extension with wiki bootstrap, source capture, search, page resolution, lint, status, event logging, and metadata rebuild tools
- Bundled `llm-wiki` skill
- Immutable raw-source capture packets
- Generated registry, backlinks, index, log, and lint report workflows
- Guardrails that protect raw and generated metadata paths
