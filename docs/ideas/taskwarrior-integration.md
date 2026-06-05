# Taskwarrior Integration & WEEK.md

> Status: Design discussion — 2026-06-05
> Context: Brain Wiki lacks a temporal planning view. LIST.md is a great inlet but there's no shared view of "what does this week look like." Taskwarrior becomes the shared task state; WEEK.md is the human-readable artifact.

---

## The Problem

LIST.md is the inbound queue — everything lands there. But neither human nor agent has a direct view of temporal arrangements: what's active today, what's planned this week, what's the shape of the month.

The wiki has activity scanning (`wiki_scan_activity`), project metadata (`wiki_project_sync`), and the LIST backlog — but those are all reactive. There's nothing that says "here's the shape of right now and what's ahead."

## The Solution

**Taskwarrior as the shared task database.** Both human and agent talk to the `task` CLI. No custom file format.

| Who | Does what |
|-----|-----------|
| **You** | `task add`, `task modify`, `task done` — normal Taskwarrior usage |
| **Agent** | Same CLI — creates tasks from LIST.md items, annotates with wiki links, queries for weekly view |

**WEEK.md** is a derived artifact — rendered from Taskwarrior queries every session, living at PARA root for Obsidian browsing.

---

## Architecture

```
LIST.md (everything lands here)
    │
    ▼
  Gate: Does this task have...
    • A project?
    • A schedule date?
    • A priority (IU/I/U)?
    • An estimate (0.5–3 days)?
    • Enough substance to track?
    │
    ├── Yes → task add with all required fields
    │         agent annotates with wiki links if source-related
    │
    └── No  → stays in LIST.md as a note/idea
              agent surfaces periodically: "this has been sitting
              without a schedule — want to promote it?"
```

### What stays out of Taskwarrior

- Quick ideas with no deadline ("maybe do X sometime")
- Source URLs waiting to be captured (they become wiki sources, not tasks)
- Fleeting notes that aren't actionable
- Anything with `N` priority (not important, not urgent) — stays in LIST.md

### What goes in

- Anything with a due date or schedule
- Work items tied to a project
- Things that need priority ranking and tracking
- Recurring commitments
- Tasks that have been split into controllable pieces (max 3 days each)

---

## Task Creation Rules

### 1. Project — mandatory

Every task must have a project. No orphan tasks.

**Projects represent concrete work, not broad domains.**

A project is a specific, actionable outcome — not a category like "Techno" or "AI." The project name should answer: *what am I delivering?*

| Bad (too general) | Good (concrete) |
|--------------------|------------------|
| `Techno` | `Techno.EC-568-Fix` |
| `AI` | `AI.Wiki-TypeSystems-Capture` |
| `HubSpot` | `HubSpot.Notes-Update` |
| `OKR` | `OKR.Q3-Definition` |

**Project naming convention:**

```
Domain.SpecificOutcome
```

- `Domain` — the broad area (Techno, HubSpot, AI, OKR, Wiki, etc.)
- `.` — separator
- `SpecificOutcome` — the concrete deliverable in 2–4 words, kebab-case

**Examples from real Taskwarrior work:**

| Task description | Project |
|------------------|---------|
| `BUG: Fix login timeout on EC-568` | `Techno.EC-568-Fix` |
| `FEAT: Voice recording for France & Italy` | `Techno.Voice-Recording` |
| `REVIEW: HubSpot notes update` | `HubSpot.Notes-Update` |
| `RD: Blog on type systems` | `AI.TypeSystems-Research` |
| `PLAN: Define Q3 OKR` | `OKR.Q3-Definition` |
| `MEETING: Roadmap sync with UG domain` | `HubSpot.UG-Roadmap-Sync` |

**Rules:**
- Every task must have a project in `Domain.SpecificOutcome` format
- The domain part is reusable across projects; the outcome part is unique to the deliverable
- Agent proposes project names; Walker confirms. Never auto-creates.
- If a LIST.md item doesn't fit an existing project, agent asks: *"Which project does this belong to, or should we create a new one?"*

### 2. Description — naming format

```
TYPE: Short imperative description
```

| Prefix | Meaning | Example |
|--------|---------|---------|
| `BUG:` | Bug fix | `BUG: Fix login timeout on EC-568` |
| `FEAT:` | New feature | `FEAT: Voice recording for France & Italy` |
| `RD:` | Research/reading | `RD: Blog on type systems` |
| `REVIEW:` | Review or feedback | `REVIEW: Design feedback from Sarah` |
| `SETUP:` | Infrastructure/config | `SETUP: Configure wiki linting hook` |
| `PLAN:` | Planning/strategy | `PLAN: Define Q3 OKR` |
| `MEETING:` | Meeting prep or follow-up | `MEETING: Roadmap sync with UG domain` |

**Rules:**
- Max 8 words after the prefix
- No URLs in description — use `task <id> annotate "https://..."` instead
- No markdown in description — plain text only
- Imperative mood: "Fix X" not "Fixing X" or "Fixed X"

### 3. Priority — Eisenhower matrix, mandatory for promotion

| Label | Meaning | TW priority | Agent default |
|-------|---------|-------------|---------------|
| `IU` | Important + Urgent | `H` | Never — Walker decides |
| `I` | Important, not urgent | `M` | Suggested when importance is clear |
| `U` | Urgent, not important | `L` | Suggested when deadline is tight |
| `N` | Neither | (none) | Rarely promotes — stays in LIST.md |

**Rules:**
- Every promoted task gets a priority. Agent suggests, Walker confirms.
- If unsure → default `M`, Walker can adjust.
- No `N` (none) allowed on promoted tasks. If it has no priority, it's not ready for Taskwarrior.
- `N` tasks stay in LIST.md. Taskwarrior is for things you've committed to.

### 4. Estimate — mandatory for promotion

Unit: 0.5 days (half-day blocks). Added as a User Defined Attribute (UDA):

```bash
uda.estimate.type=numeric
uda.estimate.label=Estimate
uda.estimate.default=1
```

| Value | Meaning |
|-------|---------|
| `0.5` | Half a day — smallest task |
| `1` | One full day — default |
| `1.5` | Day and a half |
| `2` | Two days |
| `3` | Three days — maximum |

**The split rule:**
- Maximum estimate is 3 days
- Anything larger must be split into multiple controllable tasks
- Agent proposes the split, Walker confirms
- Each sub-task independently gets its own project, priority, estimate, dates

**Example split with dependencies:**
```
LIST.md:  "Redesign the wiki capture flow"

Agent:    "This looks like 4+ days. I'd split it into:

  1. RD: Audit current capture flow        estimate:1    I
  2. CONCEPT: Draft new capture spec        estimate:1    I
  3. FEAT: Implement capture refactor       estimate:2    I
  4. REVIEW: Test capture with real sources  estimate:0.5  U

  With dependencies: 2 blocks on 1, 3 blocks on 2, 4 blocks on 3.
  So the chain is: 1 → 2 → 3 → 4. Each unblocks when the previous completes.

  Want me to promote these?"
```

### 5. Dates — mandatory for promotion

| Field | Meaning | Required? |
|-------|---------|-----------|
| `scheduled` | "Show this to me starting on this date" | ✅ Always |
| `due` | "Must be done by this date" | If there's a deadline |

**Rules:**
- `scheduled` is always required. No unscheduled tasks in Taskwarrior.
- `due` is required if there's a real deadline. Otherwise omit — the task floats after its scheduled date.
- If Walker says "do this sometime this week" → `scheduled:today due:eow`
- If Walker says "get to this eventually" → agent proposes `scheduled:next monday`, Walker confirms

### 6. Tags — categorize the work type

| Tag | Meaning |
|-----|---------|
| `+BUG` | Bug fix |
| `+FEAT` | Feature development |
| `+RD` | Research / reading |
| `+CONCEPT` | Design / thinking / ideation |
| `+REVIEW` | Reviewing something |
| `+SOURCE` | Wiki source capture (links to wiki) |
| `+INFRA` | Tooling / setup / config |

**Rules:**
- At least one tag per task.
- `+SOURCE` is special — agent adds it when the task relates to wiki source capture. Links the task to the wiki workflow.
- Tags describe *what kind of work*, not the domain. Domain = project.

### 7. Dependencies — chain related tasks

When a task can't start until another finishes, use Taskwarrior's dependency system. This creates a blocked/unblocked chain.

**When to use dependencies:**

| Pattern | Example chain |
|---------|---------------|
| Split tasks (the estimate rule) | `RD` → `CONCEPT` → `FEAT` → `REVIEW` |
| Research before implementation | `RD: Research X` blocks `FEAT: Build X` |
| Design before coding | `CONCEPT: Design Y` blocks `FEAT: Implement Y` |
| Implementation before review | `FEAT: Build Z` blocks `REVIEW: Test Z` |
| External dependency | `MEETING: Get approval` blocks `FEAT: Deploy` |

**How it works:**

```bash
# Create tasks
# task 10: RD: Audit capture flow         (estimate:1)
# task 11: CONCEPT: Draft capture spec     (estimate:1)
# task 12: FEAT: Implement refactor        (estimate:2)
# task 13: REVIEW: Test with real sources  (estimate:0.5)

# Chain them: 11 depends on 10, 12 depends on 11, 13 depends on 12
task 11 modify depends:<uuid-of-10>
task 12 modify depends:<uuid-of-11>
task 13 modify depends:<uuid-of-12>
```

**Result:**
- Task 11 shows as `BLOCKED` until task 10 is done
- When task 10 completes, task 11 auto-unblocks and becomes `READY`
- The chain flows: 10 → 11 → 12 → 13

**Agent rules for dependencies:**

- When splitting a task, **always chain them** with dependencies unless Walker says otherwise
- Agent creates all split tasks first, then links dependencies by UUID
- Agent presents the chain to Walker: "Here's the dependency chain: RD → CONCEPT → FEAT → REVIEW"
- Walker can break or rearrange the chain
- A task can depend on multiple tasks (merge point): `FEAT: Integrate A and B` depends on both `FEAT: Build A` and `FEAT: Build B`
- A task can block multiple tasks (fork point): `RD: Research` blocks both `FEAT: Build A` and `FEAT: Build B`

**When NOT to use dependencies:**

- Tasks that are related but can be done in any order → use same project, no dependency
- Tasks that are just "do this after that" by preference → use `scheduled` dates instead
- Dependencies are for true blockers, not just sequencing

**Filtering with dependencies:**

```bash
task +BLOCKED         # What's waiting on something?
task +BLOCKING         # What's holding things up?
task +UNBLOCKED        # What can I work on right now?
task +READY            # Not blocked, not waiting, actionable
```

### 8. Recurrence — repeating commitments

Recurring tasks generate child instances on a schedule. Use for regular commitments that repeat.

**When to use recurrence:**

| Recurring commitment | Pattern | Scheduled | Due |
|---------------------|---------|-----------|-----|
| Weekly wiki lint | `recur:weekly` | Monday | Friday |
| Weekly review | `recur:weekly` | Monday | Monday |
| Monthly area check-in | `recur:monthly` | 1st of month | 7th |
| Quarterly OKR review | `recur:quarterly` | start of quarter | end of quarter |
| Weekly source backlog drain | `recur:weekly` | Wednesday | Wednesday |

**How it works:**

```bash
task add "INFRA: Weekly wiki lint" \
  project:Wiki.Wiki-Maintenance \
  recur:weekly \
  scheduled:monday \
  due:friday \
  priority:L \
  estimate:0.5 \
  +INFRA
```

This creates a parent template. Every Monday, a new child task appears. When you complete the child, the next one is generated automatically.

**Parent vs. child:**
- **Parent** — the template. Never completed. Shows in `task recurring`.
- **Child** — the instance. Can be completed, modified, annotated. Shows in `task list`.

**Agent rules for recurrence:**

- Agent proposes recurring tasks, Walker confirms. Never auto-creates.
- Recurring tasks must still follow all rules: project, TYPE:, estimate, priority, scheduled, tag.
- Agent can suggest recurrence when it notices repeated patterns:
  "You've done 3 wiki lints in the last month. Want me to create a weekly recurring task?"
- Agent does NOT modify recurrence rules without Walker's explicit instruction.
- Agent can annotate recurring children: `task 15 annotate "Linted: 3 broken links fixed"`
- Agent can complete recurring children: `task 15 done`

**Stopping recurrence:**

```bash
task <parent-uuid> modify recur:   # Remove recurrence (keeps parent as regular task)
task <parent-uuid> delete           # Delete parent and all future children
```

**Combined with dependencies:**

Recurring tasks can be part of dependency chains:

```bash
# Weekly review generates a child every Monday
task add "REVIEW: Weekly wiki review" project:Wiki.Weekly-Review \
  recur:weekly scheduled:monday due:monday estimate:1 +REVIEW

# One-off improvement task depends on this week's review being done
task add "FEAT: Improve capture flow" project:Wiki.Capture-Improve \
  scheduled:monday due:friday estimate:2 +FEAT
task <improve-uuid> depends:<review-child-uuid>
```

---

## Agent Write Rules (Strict)

| Action | Allowed? | Condition |
|--------|----------|-----------|
| `task add` | ✅ | Only when draining from LIST.md or creating split tasks. Must include: description, project, scheduled, priority, estimate. No orphan tasks. |
| `task ... modify depends:` | ✅ | Only when creating split tasks (chaining sub-tasks). Must present the chain to Walker. |
| `task ... annotate` | ✅ | Always — adding wiki links, source references, context notes |
| `task ... done` | ✅ | If agent performed the work (e.g. captured a source) or completing a recurring child instance. |
| `task ... modify` | ❌ | Never core fields (due, scheduled, priority, estimate, project) without Walker's explicit instruction |
| `task delete` | ❌ | Never. Agent never deletes tasks. |
| `task ... modify status:pending` | ❌ | Never un-complete a task |

---

## Agent Checklist Before `task add`

```
✅ Has project?           → must exist in Domain.SpecificOutcome format, ask if unsure
✅ Has TYPE: prefix?       → BUG/FEAT/RD/REVIEW/SETUP/PLAN/MEETING
✅ Description ≤ 8 words?  → after prefix
✅ No URLs in description? → move to annotation
✅ Has priority?           → IU→H / I→M / U→L
✅ Has estimate?           → 0.5–3, split if >3
✅ Has scheduled?          → always required
✅ Has due?                → if deadline exists
✅ Has ≥1 tag?
✅ URL moved to annotation?
✅ Is part of a split?     → chain with depends: if multiple sub-tasks
✅ Is recurring?           → add recur: pattern, Walker confirms
```

If any check fails → ask Walker, don't guess.

---

## Automatic Task Analysis — Pi Extension Capability

The pi-brain-wiki extension should provide a tool that **analyzes the current vault state and proposes Taskwarrior tasks automatically**. This is not just LIST.md draining — it's proactive scanning across the entire vault to surface work that needs attention.

### What it scans

| Source | What it finds | Example task proposal |
|--------|---------------|----------------------|
| `Wiki/meta/` | Stale topics, pages needing enrichment | `RD: Enrich [[topics/type-systems]] — last touched 3w ago` |
| `Wiki/pages/summaries/` | Unprocessed source packets in inbox | `RD: Integrate captured source SRC-2026-05-20-001` |
| `Project/` frontmatter | Overdue `next_action`, stale `last_action` | `PLAN: Update Project/Sales-Tool-DC — stuck since May 15` |
| `LIST.md` | Unprocessed items older than 7 days | `RD: Process LIST.md item from May 28 — blog link` |
| Wiki topic `## Open questions` | Unresolved questions | `CONCEPT: Resolve open question in [[topics/voice-recording]]` |
| `wiki_scan_activity` | Neglected areas, activity gaps | `REVIEW: Area/CS has no activity in 2+ weeks` |

### How it works

```
wiki_task_scan (new tool)
    │
    ▼
  Scans: wiki meta, Project/ frontmatter, LIST.md age,
         wiki activity, topic open questions
    │
    ▼
  Produces: list of proposed tasks with all required fields
            (project, type prefix, priority suggestion, estimate,
             scheduled date suggestion, tag)
    │
    ▼
  Presents to Walker:
    "I found 4 items that could become tasks:

      1. RD: Enrich [[topics/type-systems]]
         project:Wiki.TypeSystems-Enrich  estimate:1  I  scheduled:Jun 6
         Reason: topic page is thin, 3 source summaries not integrated

      2. RD: Integrate SRC-2026-05-20-001
         project:Wiki.Capture-Backlog  estimate:0.5  U  scheduled:today
         Reason: source packet sitting in inbox for 16 days

      3. PLAN: Update Sales Tool DC project
         project:Techno.Sales-Tool-DC-Update  estimate:1  I  scheduled:Jun 7
         Reason: next_action stale since May 15

      4. REVIEW: Area/CS check-in
         project:Wiki.Area-Maintenance  estimate:0.5  L  scheduled:Jun 9
         Reason: no activity in 2+ weeks

      Promote all? Pick specific ones? Adjust fields?"
```

### Rules for automatic analysis

- Agent proposes, Walker decides. Never auto-creates tasks from scan.
- Every proposed task must pass the same checklist (project, TYPE:, estimate, priority, scheduled, tag).
- Scan runs at session start (lightweight) and can be triggered manually.
- Results include the **reason** — why this item surfaced. No mystery tasks.
- If Walker dismisses a proposal, agent remembers and doesn't re-propose the same item next session (tracked via annotation or LIST.md agent line).

---

## Complete Example

**From LIST.md:**
```markdown
- [ ] https://example.com/blog-post about type systems
```

**Agent proposes:**
```
Walker, I'd like to promote this to Taskwarrior:

  task add "RD: Blog post on type systems" \
    project:AI.TypeSystems-Research \
    scheduled:2026-06-05 \
    priority:M \
    estimate:1 \
    +RD +SOURCE

  Then annotate with the URL.

  OK?
```

**Result:**
```
ID  Project                  Pri  Estimate  Tag       Sch       Due  Description
--  ------------------------  ---  --------  --------  --------  ---  -----------
20  AI.TypeSystems-Research   M    1         RD,SOURCE 2026-06-05  —   RD: Blog post on type systems
    Annotation: https://example.com/blog-post about type systems
```

---

## WEEK.md — The Temporal Artifact

Lives at PARA root. Refreshed every session by querying Taskwarrior. Never the source of truth — always derived.

### Rendered structure

```markdown
# Week 23 — Jun 2–8
_Refreshed: 2026-06-05 10:00_

## 🔴 Overdue
| # | Task | Project | Estimate | Due |
|---|------|---------|----------|-----|
| 4 | PLAN: Define Q3 OKR | OKR.Q3-Definition | 2 | May 5 |

## 🟡 Active (started)
| # | Task | Project | Estimate | Scheduled | Due |
|---|------|---------|----------|-----------|-----|
| 14 | BUG: Fix EC-568 login timeout | Techno.EC-568-Fix | 2 | Jun 2 | Jun 6 |

## 🔵 This Week (scheduled ≤ Sun)
| # | Task | Project | Est | Pri | Sch | Due | Deps |
|---|------|---------|-----|-----|-----|-----|------|
| 2 | REVIEW: HubSpot notes update | HubSpot.Notes-Update | 1 | I | Jun 3 | Jun 7 | — |
| 8 | FEAT: Voice Recording docs | Techno.Voice-Recording | 1.5 | I | Jun 5 | — | — |
| 10 | RD: Audit capture flow | Wiki.Capture-Redesign | 1 | I | Jun 5 | — | — |
| 11 | CONCEPT: Draft capture spec | Wiki.Capture-Redesign | 1 | I | — | — | ←10 |
| 12 | FEAT: Implement refactor | Wiki.Capture-Redesign | 2 | I | — | — | ←11 |
| 13 | REVIEW: Test with sources | Wiki.Capture-Redesign | 0.5 | U | — | — | ←12 |

## 🔁 Recurring
| # | Task | Project | Recur | Schedule | Next |
|---|------|---------|-------|----------|------|
| 20 | INFRA: Weekly wiki lint | Wiki.Wiki-Maintenance | weekly | Mon→Fri | Jun 9 |
| 21 | REVIEW: Weekly wiki review | Wiki.Weekly-Review | weekly | Mon→Mon | Jun 9 |
| 22 | REVIEW: Monthly area check-in | Wiki.Area-Maintenance | monthly | 1st→7th | Jul 1 |

## ⚪ Backlog (unscheduled, top 10 by urgency)
| # | Task | Project | Urgency |
|---|------|---------|---------|
| 5 | FEAT: Voice Recording | Techno.Voice-Recording | 1.2 |
| 6 | RD: REQ-ID research | Techno.REQ-ID | 2.0 |

## ✅ Done This Week
| # | Task | Project | Completed |
|---|------|---------|-----------|
| 19 | RD: Capture Karpathy transcript | AI.Karpathy-Capture | Jun 3 |

---

## Linked Wiki Topics
- [[topics/type-systems]] → task #3
- [[topics/voice-recording]] → tasks #5, #7, #8
```

### Refresh behavior

Every session start, agent:
1. Reads LIST.md, project metadata, wiki activity, Taskwarrior state
2. Regenerates WEEK.md from `task` queries:
   - `task status:pending '(due.before:eow or scheduled.before:eow)' export`
   - `task status:active export`
   - `task status:completed end.after:sow export`
   - `task +BLOCKED export` — tasks waiting on dependencies
   - `task +BLOCKING export` — tasks holding things up
   - `task recurring export` — recurring templates
   - `task status:pending +CHILD export` — upcoming recurring children
3. Proposes additions to "This Week" but doesn't auto-add — surfaces them
4. Leaves human annotations untouched if present

---

## Wiki ↔ Task Linking (Bidirectional)

When the agent promotes a LIST.md item or creates a task related to a wiki topic:

**Taskwarrior side:**
```bash
task 3 annotate "Wiki: [[topics/type-systems]]"
```

**Wiki topic side (in the topic page):**
```markdown
## Tasks
- [ ] #3 RD: Blog on type systems (scheduled: Jun 5, estimate: 1)
```

Agent maintains both sides. When a task completes, agent can update the topic page if the task produced knowledge.

---

## LIST.md Draining Protocol

LIST.md remains the lightweight inbox. Agent drains it into Taskwarrior when items qualify:

1. Agent reads LIST.md at session start
2. Identifies unprocessed items (`[ ]` and `[>]`)
3. For each item, checks: does it have enough substance to promote?
   - If yes, proposes promotion with all required fields
   - If no, surfaces it: "This item has been sitting without a schedule — want to promote it?"
4. On promotion, appends agent line to LIST.md:
   ```
     A 2026-06-05T10:00 → Promoted to TW #20 [AI] estimate:1
   ```
5. Toggles `[ ]` → `[x]` in LIST.md

---

## Taskwarrior UDA Setup

Required configuration in `~/.taskrc`:

```bash
uda.estimate.type=numeric
uda.estimate.label=Estimate
uda.estimate.default=1
uda.estimate.values=0.5,1,1.5,2,2.5,3
```

---

## Open Questions

1. **`N` priority tasks** — agreed they stay in LIST.md. Taskwarrior is for committed work only.

2. **Scheduled date default** — agent proposes "next Monday" for eventually-items, Walker confirms. Not auto-assigned.

3. ~~**Recurring tasks**~~ — integrated. See section 8. Agent proposes, Walker confirms. Used for weekly reviews, wiki linting, monthly check-ins.

4. **Taskwarrior sync** — Taskwarrior 3 has built-in sync (`task sync`). If Walker uses multiple machines, this could keep the agent in sync across devices. Not yet discussed.

5. **WEEK.md vs direct `task` queries** — WEEK.md is generated for Obsidian browsing. But the agent can also query `task` directly. Need to decide: does the agent always read WEEK.md, or always query Taskwarrior? (Suggest: always query TW for accuracy, WEEK.md is a human convenience.)

6. **Recurring task cadence** — which recurring tasks to create? Candidates:
   - Weekly wiki lint (Mon→Fri)
   - Weekly wiki review (Mon→Mon)
   - Monthly area check-in (1st→7th)
   - Weekly source backlog drain (Wed→Wed)
   - Quarterly OKR review (start→end of quarter)
   Walker decides which ones to create.

7. **Dependency depth** — how deep should chains go? Current design: always chain split tasks. But should we cap at 4 steps? Or let Walker specify the chain length?
