# Taskwarrior — Full Capability Reference

> Version: 3.4.2 (installed on this machine)
> Status: Reference — 2026-06-05
> Purpose: Walker decides which capabilities to leverage for brain-wiki integration.

---

## 1. Commands — What You Can Do

### 1.1 Task Lifecycle

| Command | R/W | Description | Example |
|---------|-----|-------------|---------|
| `add` | RW | Create a new pending task | `task add "Buy milk" project:Home` |
| `log` | RW | Create a task that's already done | `task log "Bought milk" project:Home` |
| `done` | RW | Mark task completed | `task 3 done` |
| `delete` | RW | Delete a task (soft-delete, can be undone) | `task 3 delete` |
| `start` | RW | Mark task as active (starts timer) | `task 3 start` |
| `stop` | RW | Stop the timer on a task | `task 3 stop` |
| `undo` | RW | Revert the most recent change | `task undo` |
| `purge` | RW | Permanently remove from data (irreversible) | `task 3 purge` |
| `duplicate` | RW | Clone a task | `task 3 duplicate` |
| `edit` | RW | Open task in `$EDITOR` | `task 3 edit` |

### 1.2 Task Modification

| Command | R/W | Description | Example |
|---------|-----|-------------|---------|
| `modify` | RW | Change any attribute | `task 3 modify priority:H due:2026-06-10` |
| `annotate` | RW | Add a note to a task | `task 3 annotate "Blocked by review"` |
| `denotate` | RW | Remove an annotation by pattern | `task 3 denotate "Blocked"` |
| `append` | RW | Add text to end of description | `task 3 append " (urgent)"` |
| `prepend` | RW | Add text to start of description | `task 3 prepend "BLOCKED: "` |

### 1.3 Reports — Built-in Views

| Report | Description | Default Sort |
|--------|-------------|-------------|
| `next` | Most urgent pending tasks (default command) | urgency- |
| `ready` | Urgent + actionable (not blocked, not waiting) | urgency- |
| `list` | Most details of pending tasks | start-, due+, project+, urgency- |
| `long` | All details of pending tasks | modified- |
| `ls` | Few details — compact view | start-, description+ |
| `minimal` | Bare minimum — ID, project, tags, description | project+/, description+ |
| `all` | Every task including completed/deleted | entry- |
| `active` | Tasks with running timer | project+, start+ |
| `completed` | Done tasks | end+ |
| `overdue` | Past due date | urgency-, due+ |
| `newest` | Recently added | entry- |
| `oldest` | Oldest pending | entry+ |
| `waiting` | Hidden until `wait` date | due+, wait+, entry+ |
| `recurring` | Recurring templates + children | due+, urgency-, entry+ |
| `blocked` | Tasks waiting on dependencies | due+, priority-, start-, project+ |
| `blocking` | Tasks blocking others | urgency-, due+, entry+ |
| `unblocked` | Tasks with no blockers | due+, priority-, start-, project+ |

### 1.4 Graphical Reports

| Report | Description |
|--------|-------------|
| `burndown.daily` | Burndown chart by day |
| `burndown.weekly` | Burndown chart by week |
| `burndown.monthly` | Burndown chart by month |
| `calendar` | Calendar with due/scheduled tasks marked |
| `ghistory.daily` | Completion history graph by day |
| `ghistory.weekly` | Completion history graph by week |
| `ghistory.monthly` | Completion history graph by month |
| `ghistory.annual` | Completion history graph by year |
| `history.daily` | Text-based history by day |
| `history.monthly` | Text-based history by month |
| `history.annual` | Text-based history by year |

### 1.5 Metadata & Inspection

| Command | Description | Example |
|---------|-------------|---------|
| `count` | Count matching tasks | `task count status:pending project:Techno` |
| `ids` | Show IDs of matching tasks | `task ids +BUG` |
| `uuids` | Show UUIDs of matching tasks | `task uuids project:Techno` |
| `information` | Full dump of one task | `task 3 information` |
| `stats` | Database statistics | `task stats` |
| `projects` | List all projects | `task projects` |
| `tags` | List all tags | `task tags` |
| `summary` | Status counts by project | `task summary` |
| `timesheet` | Completed + started tasks (last 4 weeks) | `task timesheet` |

### 1.6 Configuration & Meta

| Command | Description |
|---------|-------------|
| `show` | All config variables |
| `config` | Change a config variable |
| `reports` | List all reports |
| `columns` | List all column types |
| `udas` | List User Defined Attributes |
| `commands` | List all commands |
| `diagnostics` | Platform, build, environment |
| `version` | Version number |
| `help` | Usage help |
| `news` | Recent release notes |
| `logo` | ASCII logo |

### 1.7 Import/Export

| Command | Description |
|---------|-------------|
| `export` | Export tasks as JSON (to stdout or file) |
| `import` | Import tasks from JSON |
| `sync` | Synchronize with Taskserver |

### 1.8 Internal (Autocomplete)

| Command | Purpose |
|---------|---------|
| `_aliases` | List aliases |
| `_columns` | List columns |
| `_commands` | List commands |
| `_config` | List config variables |
| `_context` | List contexts |
| `_get` | DOM accessor |
| `_ids` | List IDs |
| `_projects` | List projects |
| `_show` | Show config (machine-readable) |
| `_tags` | List tags |
| `_udas` | List UDAs |
| `_unique` | Unique values for an attribute |
| `_urgency` | Show urgency of a task |
| `_uuids` | List UUIDs |
| `_version` | Version |

---

## 2. Attributes — What a Task Has

### 2.1 Built-in Attributes

| Attribute | Type | Read/Write | Description |
|-----------|------|------------|-------------|
| `id` | number | RO | Short local ID (changes across sessions, not persistent) |
| `uuid` | string | RO | Persistent unique identifier |
| `description` | string | RW | Task text |
| `status` | enum | RW | `pending`, `completed`, `deleted`, `waiting`, `recurring` |
| `project` | string | RW | Project name (hierarchical with `.` separator) |
| `priority` | string | RW | `H`, `M`, `L`, or empty |
| `tags` | list | RW | Flat tag list (add with `+tag`, remove with `-tag`) |
| `entry` | datetime | RO | When task was created |
| `modified` | datetime | RO | Last modification timestamp |
| `start` | datetime | RW | When task was marked active (for time tracking) |
| `end` | datetime | RO | When task was completed/deleted |
| `due` | datetime | RW | Hard deadline |
| `scheduled` | datetime | RW | "Show me this starting on this date" |
| `wait` | datetime | RW | Hide task until this date |
| `until` | datetime | RW | Expiry date (auto-delete recurring children after this) |
| `recur` | string | RW | Recurrence frequency |
| `depends` | list | RW | UUIDs of tasks this depends on |
| `urgency` | number | RO | Calculated urgency score |
| `rtype` | string | RO | Recurrence type (`periodic` or `child`) |
| `mask` | string | RO | Recurrence completion mask |
| `imask` | number | RO | Recurrence instance index |
| `parent` | uuid | RO | Parent of a recurring child instance |
| `template` | string | RW | Template for recurring task generation |
| `last` | datetime | RO | Last time a recurring child was generated |

### 2.2 User Defined Attributes (UDAs)

Custom attributes can be added via `.taskrc`:

```bash
uda.<name>.type    = string | numeric | date | duration
uda.<name>.label   = <display label>
uda.<name>.default = <default value>
```

Currently defined: `priority` (string, H/M/L/empty).

### 2.3 JSON Export Fields

When using `task export`, each task includes:

```json
{
  "id": 1,
  "description": "Task text",
  "entry": "20260417T101035Z",
  "modified": "20260417T101109Z",
  "project": "Techno",
  "status": "pending",
  "uuid": "2b4d12b3-ecea-473a-9f47-3c6e4e5dfb04",
  "tags": ["BUG"],
  "urgency": 2.06301,
  "due": "20260609T160000Z",
  "scheduled": "20260604T160000Z",
  "priority": "H",
  "start": "20260605T090000Z",
  "end": "20260605T150000Z",
  "wait": "20260610T000000Z",
  "until": "20261231T000000Z",
  "recur": "weekly",
  "depends": ["uuid-1", "uuid-2"],
  "rtype": "periodic",
  "parent": "uuid-parent",
  "imask": 0,
  "mask": "++X",
  "template": "",
  "last": "20260605T000000Z"
}
```

---

## 3. Filtering — How to Query Tasks

### 3.1 Syntax

```
task <filter> <command>
task <filter> <command> <modifications>
```

Filters select tasks. Commands act on them. Modifications change attributes.

### 3.2 By Status

```
task status:pending           # Pending tasks
task status:completed         # Completed tasks
task status:deleted           # Deleted tasks
task status:waiting           # Waiting (hidden) tasks
task status:recurring         # Recurring parent templates
```

### 3.3 By Project

```
task project:Techno           # Exact match
task project.not:Techno       # Exclude project
task project:Techno.not       # Same (suffix form)
task project.any:             # Has a project (not empty)
task project.none:            # No project assigned
task project.startswith:Tec   # Starts with
task project:Techno.EC        # Hierarchical match (prefix)
```

### 3.4 By Priority

```
task priority:H               # High only
task priority:M               # Medium only
task priority:L               # Low only
task priority.not:L           # Not low
task priority.any:            # Has a priority set
task priority.none:           # No priority set
```

### 3.5 By Tags

```
task +BUG                     # Has tag BUG
task -BUG                     # Does NOT have tag BUG
task +BUG +RD                 # Has BOTH tags
task +BUG -RD                 # Has BUG but not RD
```

### 3.6 By Date Attributes

| Attribute | Modifiers | Example |
|-----------|-----------|---------|
| `due` | `.before:`, `.after:`, `.by:`, `.none:`, `.any:` | `task due.before:eow` |
| `scheduled` | same | `task scheduled.before:today` |
| `entry` | same | `task entry.after:2026-06-01` |
| `end` | same | `task end.after:sow` |
| `modified` | same | `task modified.before:2026-05-01` |
| `wait` | same | `task wait.before:today` |
| `until` | same | `task until.after:eom` |
| `start` | same | `task start.any:` (active tasks) |

### 3.7 By Text

```
task description.has:fix           # Contains "fix" (case sensitive)
task description.hasnt:fix         # Does not contain
task description.startswith:BUG    # Starts with
task description.endswith:review   # Ends with
task description.word:timeout      # Whole word match
```

### 3.8 By Virtual Tags

```
task +ACTIVE          # Currently started (timer running)
task +ANNOTATED       # Has annotations
task +BLOCKED         # Has unresolved dependencies
task +BLOCKING        # Is blocking another task
task +CHILD           # Is a recurring child instance
task +COMPLETED       # Is done
task +DELETED         # Was deleted
task +DUE             # Has a due date
task +DUETODAY        # Due today
task +INSTANCE        # Is a recurring instance
task +LATEST          # Most recently modified
task +MONTH           # Due this month
task +ORPHAN          # Recurring child with no parent
task +OVERDUE         # Past due date
task +PARENT          # Is a recurring parent template
task +PENDING         # Is pending
task +PRIORITY        # Has a priority set
task +PROJECT         # Has a project
task +QUARTER         # Due this quarter
task +READY           # Not blocked, not waiting, actionable
task +SCHEDULED       # Has a scheduled date
task +TAGGED          # Has at least one user tag
task +TEMPLATE        # Is a template
task +TODAY           # Due today
task +TOMORROW        # Due tomorrow
task +UDA             # Has a UDA value set
task +UNBLOCKED       # Has no unresolved dependencies
task +UNTIL           # Has an expiry date
task +WAITING         # Is in waiting state
task +WEEK            # Due this week
task +YEAR            # Due this year
task +YESTERDAY       # Due yesterday
```

### 3.9 Special Tags

| Tag | Effect |
|-----|--------|
| `+next` | Urgency boost of 15.0 (highest single factor) |
| `+nocal` | Excludes task from calendar report |
| `+nocolor` | Disables color for task |
| `+nonag` | Suppresses nag message |

### 3.10 Combining Filters

```
# AND (implicit)
task status:pending project:Techno +BUG priority:H

# OR (explicit)
task '(project:Techno or project:HubSpot)'

# Complex
task status:pending '(due.before:eow or scheduled.before:eow)' priority.not:L

# Algebraic
task '(due < eom and priority != L)'
task '(project = Techno and tags has BUG)'
```

### 3.11 Limiting Results

```
task limit:10 next              # Top 10 by urgency
task limit:page next            # One page (terminal height)
task status:pending count       # Just the count
```

---

## 4. Attribute Modifiers — Precision Filtering

| Modifier | Example | Meaning |
|----------|---------|---------|
| `is`, `equals` | `project.is:Techno` | Exact match (`==`) |
| `isnt` | `project.isnt:Techno` | Exact non-match (`!=`) |
| `has`, `contains` | `desc.has:fix` | Pattern match (`~`) |
| `hasnt` | `desc.hasnt:fix` | Pattern non-match (`!~`) |
| `startswith`, `left` | `desc.left:BUG` | Beginning match (`^`) |
| `endswith`, `right` | `desc.right:review` | End match (`$`) |
| `word` | `desc.word:timeout` | Boundaried word match (`\b`) |
| `noword` | `desc.noword:timeout` | Boundaried non-match |
| `before` | `due.before:eom` | Date comparison (`<`) |
| `after` | `due.after:today` | Date comparison (`>`) |
| `by` | `due.by:eow` | Date comparison (`<=`) |
| `none` | `priority.none:` | Attribute is empty |
| `any` | `priority.any:` | Attribute is not empty |
| `not` | `priority.not:H` | Negation (`!=`) |

---

## 5. Dates — Named Dates and Expressions

### 5.1 Named Dates

| Name | Resolves to | Example |
|------|-------------|---------|
| `today` | Current date | `task due:today` |
| `tomorrow` | Next day | `task due:tomorrow` |
| `yesterday` | Previous day | — |
| `sow` | Start of week (Sunday) | `task end.after:sow` |
| `eow` | End of week (Saturday 23:59:59) | `task due.before:eow` |
| `socm` | Start of current month | — |
| `eocm` | End of current month | — |
| `sonw` | Start of next week | `task scheduled:sonw` |
| `eonw` | End of next week | — |
| `soy` | Start of year | — |
| `eoy` | End of year | — |
| `monday` | Next Monday | `task scheduled:monday` |
| `tuesday` | Next Tuesday | — |
| `wednesday` | Next Wednesday | — |
| `thursday` | Next Thursday | — |
| `friday` | Next Friday | — |
| `saturday` | Next Saturday | — |
| `sunday` | Next Sunday | — |
| `january`–`december` | First of that month (next occurrence) | — |
| `1st`–`31st` | That day of current/next month | `task due:15th` |
| `later` | Far future (9999-12-30) | — |
| `someday` | Far future (9999-12-30) | — |

### 5.2 Date Arithmetic

```
now+2w              # 2 weeks from now
now-3d              # 3 days ago
eow+1d              # day after end of week
today+14d           # 14 days from today
```

### 5.3 ISO Dates

```
2026-06-05              # Date only
2026-06-05T14:30:00Z    # Full datetime (UTC)
20260605                # Compact form
```

### 5.4 Duration Values

| Value | Meaning |
|-------|---------|
| `1d` | 1 day |
| `2w` | 2 weeks |
| `3m` | 3 months |
| `1y` | 1 year |
| `P14D` | ISO 8601 duration (14 days) |
| `P7D` | ISO 8601 duration (1 week) |

---

## 6. Urgency — Automatic Scoring

### 6.1 Formula

```
urgency = Σ (coefficient × factor)
```

Each factor is 0 or 1 (present/absent), scaled by its coefficient. Some factors use counts (annotations, tags).

### 6.2 Coefficients (Default)

| Factor | Coefficient | Effect |
|--------|-------------|--------|
| `+next` tag | 15.0 | Highest single boost |
| Due date proximity | 12.0 | Closer due date = higher score |
| Blocking other tasks | 8.0 | Tasks that hold up others surface fast |
| Priority H | 6.0 | High priority |
| Scheduled (ready to start) | 5.0 | Scheduled tasks get a boost |
| Active (timer running) | 4.0 | Currently working on it |
| Priority M | 3.9 | Medium priority |
| Age | 2.0 | Older tasks get more urgent (max 365 days) |
| Priority L | 1.8 | Low priority |
| Has annotations | 1.0 | Slight boost per annotation |
| Has tags | 1.0 | Slight boost |
| Has project | 1.0 | Slight boost |
| Waiting | -3.0 | Reduces urgency |
| Blocked by dependencies | -5.0 | Reduces urgency |

### 6.3 Custom Project Coefficients

```bash
# Make a specific project more urgent
urgency.user.project.MyProject.coefficient 5.0
```

### 6.4 Customization Guidance

- Adjustments should be small (+/- 1.0)
- No single term should dominate
- Test with `next` report before tweaking

---

## 7. Dependencies — Task Chains

### 7.1 Creating Dependencies

```bash
# By UUID (persistent, recommended)
task 5 modify depends:<uuid-of-task-3>

# Remove a dependency
task 5 modify depends:-<uuid-of-task-3>

# Multiple dependencies
task 5 modify depends:<uuid-1>,<uuid-2>
```

### 7.2 Effects

- Blocked task shows `D` indicator and is marked `+BLOCKED`
- When dependency completes, blocker auto-removes
- Blocked tasks have reduced urgency (-5.0)
- Blocking tasks have increased urgency (+8.0)

### 7.3 Virtual Tags for Dependencies

```
task +BLOCKED         # Waiting on something
task +BLOCKING        # Holding up something
task +UNBLOCKED       # No unresolved dependencies
task +READY           # Not blocked + not waiting + pending
```

### 7.4 Reports

| Report | Shows |
|--------|-------|
| `blocked` | Tasks that are blocked |
| `blocking` | Tasks that are blocking others |
| `unblocked` | Tasks with no blockers |

---

## 8. Recurrence — Repeating Tasks

### 8.1 Creating Recurring Tasks

```bash
task add "Weekly review" \
  project:Wiki.Maintenance \
  recur:weekly \
  scheduled:monday \
  due:friday \
  priority:L
```

### 8.2 Recurrence Patterns

| Pattern | Meaning |
|---------|---------|
| `daily` | Every day |
| `weekdays` | Monday–Friday |
| `weekly` | Every 7 days |
| `biweekly` | Every 14 days |
| `monthly` | Every ~30 days |
| `quarterly` | Every ~91 days |
| `annual` | Every ~365 days |
| `15d` | Every 15 days |
| `3m` | Every 3 months |

### 8.3 Parent vs. Child

- **Parent** — the template. Has `status:recurring`. Never completed. Shows in `task recurring`.
- **Child** — an instance. Has `status:pending`. Can be completed, modified, annotated. Shows in `task list`.

When a child is completed, the next child is generated automatically based on the `due` date cycle.

### 8.4 Controlling Recurrence

```bash
# Stop recurrence (keeps parent as regular task)
task <parent-uuid> modify recur:

# Delete parent and all future children
task <parent-uuid> delete

# Limit number of future children generated
# (configured via recurrence.limit in .taskrc, default: 1)
```

### 8.5 Recurrence with Until

```bash
task add "Daily standup" recur:daily until:2026-12-31
```

Children auto-delete after `until` date passes.

### 8.6 Config

```bash
recurrence                       1          # Enable recurrence
recurrence.confirmation          prompt     # Ask before generating
recurrence.limit                 1          # Children generated ahead
recurrence.indicator             R          # Display indicator
```

---

## 9. Waiting — Hide Until Later

```bash
# Task disappears from all reports until the wait date
task add "Follow up on roadmap" project:HubSpot wait:2026-06-15

# Park an existing task
task 3 modify wait:2026-06-10
```

- Waiting tasks are invisible in all reports except `waiting`
- They reappear automatically when the wait date passes
- `+WAITING` virtual tag tracks them
- Urgency is reduced by 3.0 while waiting

---

## 10. Contexts — Named Default Filters

### 10.1 Usage

```bash
# Define a context
task context define work "project:Techno or project:HubSpot"

# Activate
task context work

# All commands now filtered to Techno + HubSpot
task list    # only shows Techno and HubSpot tasks

# Deactivate
task context none

# List all contexts
task context
```

### 10.2 Effects

When a context is active:
- All reports are automatically filtered
- `task add` automatically applies the context filter
- Modifications only affect matching tasks

---

## 11. Hooks — Script Automation

### 11.1 Events

| Event | When | Input | Output |
|-------|------|-------|--------|
| `on-launch` | Taskwarrior starts | None | Optional feedback |
| `on-exit` | Taskwarrior exits | JSON of changed tasks | Optional feedback |
| `on-add` | Before a new task is saved | JSON of new task | Modified JSON + feedback |
| `on-modify` | Before a modified task is saved | JSON of original + modified | Modified JSON + feedback |

### 11.2 Setup

```bash
# Hooks directory
~/.task/hooks/

# Naming: <event>[.<identifier>]
on-add.require-project
on-modify.enforce-naming
on-launch.sync-check

# Must be executable
chmod +x ~/.task/hooks/on-add.require-project
```

### 11.3 Input Format

One JSON object per line (stdin):
```json
{"description":"Buy milk","status":"pending","project":"Home","uuid":"..."}
```

### 11.4 Output Format

One JSON object (modified task) + optional feedback text:
```json
{"description":"Buy milk","status":"pending","project":"Home","uuid":"..."}
```
```
Hook: project validated.
```

### 11.5 Exit Status

| Exit | Meaning |
|------|---------|
| `0` | Success — task is saved, feedback shown as footnote |
| Non-zero | Failure — task rejected, feedback shown as error |

### 11.6 Command Line Arguments (v2)

Hooks receive these arguments:
```
api:2                           # Hooks API version
args:'task rc:~/mytaskrc list'  # Original command line
command:add|done|modify|...     # Command being executed
rc:/path/to/.taskrc             # RC file path
data:/path/to/task/folder       # Data directory
version:x.y.z                   # Taskwarrior version
```

### 11.7 Safety

- Malformed JSON is rejected
- Correct JSON that isn't a task is ignored
- No infinite loop protection — be careful with on-modify hooks that trigger other modifications
- Debug: `rc.debug.hooks=1` shows which hooks run; `rc.debug.hooks=2` shows input/output

---

## 12. Sync — Multi-Device

### 12.1 How It Works

```bash
# On device A
task sync    # sends local changes to server

# On device B
task sync    # receives changes from server
```

Two `task sync` calls needed for a change to propagate (one push, one pull).

### 12.2 Server Options

| Option | Description |
|--------|-------------|
| TaskChampion Sync Server | Self-hosted, easy to deploy |
| AWS S3 / Google Cloud Storage | Cloud storage (small cost) |
| S3-compatible services | MinIO, etc. |

### 12.3 Config

```bash
# Server type
sync.server.url=https://...

# Or cloud storage
sync.cloud.provider=s3
sync.cloud.bucket=my-tasks
sync.cloud.region=us-east-1
sync.cloud.credentials=...
```

### 12.4 Important

- Taskwarrior 3 stores tasks in SQLite (`taskchampion.sqlite3`)
- External sync tools (rsync, Syncthing) **not supported** — will corrupt data
- Must use `task sync` command

---

## 13. Urgency — Current State

Current urgency scores for pending tasks:

| Urgency | Task | Project |
|---------|------|---------|
| 14.05 | Updates the notes based on Gemini | HubSpot |
| 13.21 | Define the OKR | OKR |
| 2.06 | BugFix / [568] | Techno |
| 2.04 | [Blog] | AI |
| 2.01 | REQ-ID | Techno |
| 2.01 | [Voice Recoding] | Techno |
| 2.00 | To confirm the roadmap of UG domain | HubSpot |
| 1.21 | FEAT / Voice Recording | Techno |

**Why this order:** Tasks #2 and #4 have due dates (due coefficient = 12.0), which dominates. All others have no due date, no priority, no scheduled date — so they score near baseline.

---

## 14. Config — Current `.taskrc` State

Key settings:

```
default.command       next
dateformat            Y-M-D
hooks                 1 (enabled, no hooks dir)
recurrence            1 (enabled)
recurrence.limit      1
regex                 1
search.case.sensitive 1
confirmation          1
data.location         ~/.task
```

### Current UDAs

```
uda.priority.type    string
uda.priority.label   Priority
uda.priority.values  H,M,L,
```

### Urgency Coefficients (Default)

```
urgency.user.tag.next.coefficient   15.0
urgency.due.coefficient             12.0
urgency.blocking.coefficient         8.0
urgency.uda.priority.H.coefficient   6.0
urgency.scheduled.coefficient        5.0
urgency.active.coefficient           4.0
urgency.uda.priority.M.coefficient   3.9
urgency.age.coefficient              2.0
urgency.uda.priority.L.coefficient   1.8
urgency.annotations.coefficient      1.0
urgency.tags.coefficient             1.0
urgency.project.coefficient          1.0
urgency.waiting.coefficient         -3.0
urgency.blocked.coefficient         -5.0
```

---

## 15. Data Storage

### Location

```
~/.task/
├── taskchampion.sqlite3       # Main database (Taskwarrior 3)
├── taskchampion.sqlite3-shm   # Shared memory (WAL)
├── taskchampion.sqlite3-wal   # Write-ahead log
└── hooks/                     # Hook scripts (not yet created)
```

### Backup

```bash
# Simple file copy
cp -r ~/.task ~/.task-backup

# Or just the database
cp ~/.task/taskchampion.sqlite3 ~/task-backup.db
```

---

## 16. Abbreviations

Taskwarrior allows abbreviations as long as they're unique:

```bash
task list project:Home     # Full
task li pro:Home           # Abbreviated
task ad "New task" pro:AI  # add → ad
task don 3                 # done → don
task mod 3 pri:H           # modify → mod, priority → pri
```

---

## 17. Special Syntax

### `--` Separator

Force everything after `--` to be description:

```bash
task add -- project:Home needs scheduling
# Creates task with description "project:Home needs scheduling"
# (project:Home is NOT interpreted as an attribute)
```

### `rc:` Override

```bash
task list rc:~/.alt_taskrc       # Use alternate config
task list rc.color=off           # Override single config value
```

### Quoting

```bash
task add "quoted ' quote"
task add escaped \' quote
```
