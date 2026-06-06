# Workshop Protocol

## Phase 0: Surface LIST.md Candidates

Before Walker provides a source, check LIST.md for unprocessed items:

```
1. Scan LIST.md for URLs that haven't been captured (no agent line linking to a source)
2. Scan for ideas or notes that could become wiki content
3. Present to Walker: "I see these items in LIST.md that look like source candidates: [list].
   Want me to capture any of them first? Or are you bringing something new?"
4. If Walker says yes, mark the item as [>] and proceed to Phase 1
5. If Walker says no, proceed with whatever they bring
```

## Phase 1: Receive Source

Walker provides a source (URL, file, or text). Can come directly or from LIST.md.

```
1. wiki_capture_source → creates inbox packet + summary stub
2. Read the extracted content → understand the source
3. Tell Walker: "Here's what I got from this source."
4. Append agent line to LIST.md under the item: "  A YYYY-MM-DDTHH:MM → Captured as SRC-ID"
5. If Walker initiated this session for a LIST.md item, toggle [ ] → [>] first, then [ ] → [x] on completion
```

## Phase 2: Orient to Existing Knowledge

Before synthesizing, orient to what the wiki already knows.

```
1. Use wiki_search to find related topics
2. Read matching topic summaries → understand current state
3. Use wiki_search to find related summaries → understand what sources informed those topics
4. Report to Walker: "Here's what we already know about [related areas]."
5. Identify: does this source add new information, contradict existing knowledge, or reinforce it?
```

## Phase 3: Discuss Key Takeaways

This is the supervised part. Before writing anything:

```
1. Present Walker with: "Here are the key takeaways I see from this source."
2. Present Integration Targets: "This source should affect these topic pages: [list]"
3. Ask Walker: "Does this match your understanding? Anything I'm missing?"
4. Wait for confirmation before writing.
```

**Never skip Phase 3.** The whole point of the workshop is supervised distillation. You're not filing — you're understanding together.

## Phase 4: Write

Only after Walker confirms the takeaways and targets:

```
1. Write or update the summary page (full content, including Integration Targets)
2. Use wiki_ensure_page before creating any new topic
3. Update each Integration Target topic page
   - Re-read the topic first (absorption loop!)
   - Add new information with source citations
   - Apply anti-cramming: if a sub-topic is growing, propose a new page
   - Apply anti-thinning: every edit adds real substance
4. Set summary status to "integrated"
5. wiki_log_event kind=integrate
6. Append agent line to LIST.md: "  A YYYY-MM-DDTHH:MM → Integrated into [[topics/...]]"
7. Toggle the LIST.md item [ ] → [x] if this session was prompted by a LIST.md source
```

---

## Topic Refinement (Without New Source)

Walker may also start a workshop session to refine an existing topic without a new source:

1. Re-read the topic page
2. Re-read the summary pages that informed it (check `source_ids` in frontmatter)
3. Identify: what's missing, what's thin, what contradicts
4. Propose improvements with specific edits
5. Get Walker confirmation
6. Apply edits
7. `wiki_log_event kind=refactor`

This is the same protocol minus the capture step. The absorption loop and supervision requirements still apply.
