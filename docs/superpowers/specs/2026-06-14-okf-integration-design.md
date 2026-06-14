# OKF Integration Proposal Review — Design Specification

> Scope: Evaluate the necessity and feasibility of the proposed OKF-inspired wiki changes for `pi-brain-wiki`.
> Status: **approved** for scoped adoption.
> Date: 2026-06-14

## Goal

Reduce day-to-day friction in maintaining the wiki by tightening page conformance where it already matters, while avoiding new navigation surfaces or metadata fields that do not pay for themselves.

## Decision Summary

The original proposal should not be implemented as-is.

- **Adopt:** conformance specification and lint enforcement
- **Defer:** `resource` frontmatter until there is repeated evidence it improves authoring or review
- **Reject for now:** directory-level `index.md` pages

This keeps the change aligned with the current system: deterministic tools, generated metadata, Obsidian CLI integration, and specialized workflows for capture, review, and task promotion.

## Current System Reality

The repository already has:

- Obsidian CLI-backed page/property IO
- generated metadata under `meta/`
- registry/search/lint flows
- specialized page types (`summary`, `topic`, `plan`, `review`, `workflow`)
- agent-facing skills and tool handlers for structured operations

That means this proposal should be judged by whether it removes actual operational drag, not by whether it makes the vault look more formally standardized.

## Section 1: Necessity Assessment

### 1.1 Conformance Spec + Lint

**Necessity:** High

This is the only part of the proposal that directly addresses a likely ongoing problem: page drift across different tools, templates, and editing paths.

Why it matters here:

- the repo already depends on typed page classes and generated metadata
- deterministic tooling only stays reliable if page contracts stay predictable
- lint is already an accepted control point in this system

This is not speculative infrastructure. It strengthens a pattern the codebase already uses.

### 1.2 `resource` Frontmatter

**Necessity:** Conditional

`resource` is only useful if pages frequently stand in for an external canonical object such as:

- a repository
- a primary document
- a dashboard/table
- a project home page

If that pattern is common, `resource` can improve traceability during review and maintenance. If not, it becomes mostly-empty schema surface that weakens signal quality and increases template clutter.

The field should therefore not be added universally by default.

### 1.3 Directory `index.md` Pages

**Necessity:** Low

This repo already has working navigation through:

- Obsidian CLI access
- generated metadata
- registry/search
- direct page links
- page-type-specific tools and workflows

Per-directory generated indexes would add a second navigation system without a demonstrated failure in the first one. That introduces maintenance surface and cognitive duplication without a strong friction case.

## Section 2: Feasibility Assessment

### 2.1 Conformance Work

**Feasibility:** High

This fits the existing architecture cleanly:

- templates already define page shapes
- lint already validates structure
- page types already carry semantic meaning

Likely implementation shape:

- add a small written conformance spec
- extend `wiki_lint` with page-type-specific required fields and relational checks
- fix current violations once and keep the repo inside the contract afterward

The technical risk is low. The only meaningful risk is overspecifying fields that current workflows do not consistently populate.

### 2.2 `resource` Field

**Feasibility:** Trivial

Adding the field to templates and schema docs is easy. The real issue is not implementation complexity but product discipline: once a field exists, users and agents will assume it matters.

So the gating question is usefulness, not effort.

### 2.3 Directory Indexes

**Feasibility:** Moderate

They are easy enough to generate, but they create extra artifact classes, rebuild rules, and documentation responsibilities. That is feasible, but likely negative ROI under the current operating model.

## Section 3: Recommended Scope

### Option A — Minimal Discipline Pass

Implement only conformance spec + lint.

**Pros**

- directly addresses the highest-value problem
- small change surface
- matches existing architecture
- low maintenance overhead

**Cons**

- does not add outbound provenance fields

### Option B — Discipline + Selective Provenance

Implement conformance spec + lint, and add `resource` only to page types where external canonical references are common.

Recommended first candidates:

- `topic` pages that represent an external project, repo, or document
- possibly `plan` or `review` pages if they repeatedly anchor to one primary external object

Do not add `resource` to every template automatically.

**Pros**

- keeps the high-value discipline changes
- captures external anchors where they are genuinely useful

**Cons**

- needs a clear rule for when the field should be present
- adds some schema complexity

### Option C — Full Proposal

Implement all three original items.

**Recommendation:** Do not do this.

The directory index portion is not justified by current workflow needs.

## Section 4: Recommended Design

Proceed with **Option A** as the default path.

If, during conformance work, there are repeated cases where reviewers or agents need a canonical external pointer on pages, upgrade to **Option B** with a narrow rule:

- `resource` is optional
- only page types with real external referents get it
- lint should not require it globally

Do not implement directory-level `index.md` pages unless an actual navigation failure appears in current usage.

## Section 5: Success Criteria

This proposal is successful if:

1. page-type requirements become explicit and testable
2. `wiki_lint` catches structural drift early
3. current page templates and generated metadata remain the primary navigation model
4. no new generated artifact class is added without demonstrated workflow value

## Section 6: Non-Goals

- adopting OKF conventions wholesale
- making the vault interoperable with arbitrary external agents
- replacing search, registry, or Obsidian CLI flows with folder indexes
- broad schema expansion for theoretical future use

## Final Recommendation

Treat this as a **discipline proposal**, not a **navigation proposal**.

Build the conformance layer first. Add `resource` only if current authoring and review repeatedly benefit from it. Leave directory index generation out of scope.
