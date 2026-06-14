# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog and the project uses Semantic Versioning.

## [Unreleased]

### Added
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
