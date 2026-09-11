---
name: create-github-issue
description: Create high-quality, implementation-ready GitHub issues from a feature idea, bug report, refactor, chore, documentation task, or research decision. Use when the user asks to create, draft, plan, split, or improve GitHub issues. Inspect the repository and existing issues first; produce a reviewed draft with evidence, concrete scope, testable acceptance criteria, technical notes, labels, priority, dependencies, and project placement before creating anything.
---

# Create GitHub Issue

Create issues that another developer can implement without reconstructing the conversation. Follow the Conexory issue pattern: evidence-based context, concrete scope, verifiable acceptance criteria, and technical notes. Do not create an issue until the user explicitly approves the draft, unless the user has already approved that exact title and body.

## Workflow

### 1. Resolve repository and tracking context

- Run `git remote get-url origin` and normalize the repository to `owner/name`.
- Verify with `gh repo view --json nameWithOwner --jq .nameWithOwner` before writing.
- Inspect repository guidance (`AGENTS.md`, `CLAUDE.md`, README, relevant local docs) and the files named by the request.
- Search open issues before drafting to avoid duplicates: `gh issue list --state open --limit 100` and targeted `gh issue list --search "keywords"`.
- If the repository has a linked GitHub Project, identify it and its priority field/options. If no project is linked, do not silently create one; report that placement is unavailable unless the user asked for it.

### 2. Gather evidence before writing

Build the issue from facts available in the repository and conversation:

- Current behavior and the exact files, routes, actions, models, APIs, or tests involved.
- The user or business problem and why it matters now.
- Existing constraints, provider limitations, prior decisions, and rejected alternatives.
- Dependencies and risks, including migrations, backwards compatibility, permissions, external services, and rollout concerns.

If the motivation or scope is materially unknown, ask one concise question instead of inventing it. If enough context exists, make the smallest defensible assumption and state it in the draft.

### 3. Decide whether this is one issue or an initiative

Split the request when it contains independent deliverables, different owners, multiple deployable changes, or more than one user-visible outcome. Create an umbrella issue only when it is useful for tracking, and list the child issues or explicit follow-up work.

Each implementation issue should be small enough to review and test as one coherent change. Do not turn a generic goal such as “implement payments” into one oversized issue; separate provider decision, data model, checkout, webhooks, entitlements, UI, tests, and launch operations when they can move independently.

### 4. Classify type and priority

Use the repository's existing labels when available. Preferred type mapping:

| Work                                                            | Label           |
| --------------------------------------------------------------- | --------------- |
| New behavior or product capability                              | `enhancement`   |
| Broken behavior                                                 | `bug`           |
| Behavior-preserving restructuring                               | `refactor`      |
| Dependencies, infrastructure, provider migration, configuration | `chore`         |
| Documentation or decision record                                | `documentation` |

Use one priority label if the repository has the convention `priority: alta`, `priority: media`, `priority: baja`. If the linked Project has a structured priority field, set it too using the repository's project convention.

- Alta / P0: blocks launch, revenue, security, data integrity, or a committed user flow.
- Media / P1: important for the current milestone but has a safe workaround.
- Baja / P2: improvement, cleanup, optimization, or follow-up.

Do not choose priority from implementation effort alone. If priority is genuinely ambiguous, ask before creating the issue.

### 5. Draft using this exact structure

The title must be short, specific, and written as an imperative or clear noun phrase. Avoid vague titles (`Mejorar pagos`) and avoid adding a type prefix unless the repository explicitly requires one.

```md
## Contexto

<why this is needed, current behavior, evidence, and impact>

## Qué hay que hacer

- <concrete deliverable>
- <concrete deliverable>
- <explicit non-goal or boundary when useful>

## Criterios de aceptación

- [ ] <observable, testable outcome>
- [ ] <observable, testable outcome>
- [ ] <edge case, authorization, migration, or rollout check>

## Notas técnicas

- Archivos o módulos relevantes: `<path>`
- Data/API/provider considerations
- Dependencies, alternatives considered, and rollout notes
```

Writing rules:

- Context must describe the current state, not repeat the title.
- Scope must name what changes and what does not change.
- Acceptance criteria must be checkable by a reviewer or test; avoid “works well” or “is improved”.
- Technical notes should preserve decisions that would otherwise be lost from chat.
- Mention exact paths and symbols when known; do not fabricate paths.
- Include security, authorization, error handling, migrations, localization, accessibility, or observability criteria when relevant.
- Keep the issue focused. Prefer 4–8 strong acceptance criteria over a long checklist.

### 6. Checkpoint before creation

Show the user:

1. Title.
2. Full issue body.
3. Labels and priority.
4. Project and project priority, if applicable.
5. Dependencies or assumptions.

Wait for explicit approval. If the user requests changes, revise the full draft and show it again. Never create a guessed issue silently.

### 7. Create and place the approved issue

Use the authenticated GitHub CLI as the fallback when the GitHub connector cannot write:

```bash
gh issue create \
  --repo <owner/name> \
  --title "<approved title>" \
  --label "<type>" \
  --label "priority: <priority>" \
  --body "$(cat <<'EOF'
<approved body>
EOF
)"
```

After creation:

- Report the issue number and URL.
- Add it to the approved linked Project when requested or when project placement was part of the draft.
- Set the structured project priority, if one exists.
- Verify the final issue title, body, labels, project, and priority with read-only commands.

Never modify or close an existing issue to make it fit. If a duplicate exists, link to it and explain whether to update, split, or leave it unchanged.

## Quality bar

Before presenting the draft, confirm:

- A developer can identify the relevant code and data without searching the whole repository.
- The issue has a reason, scope, acceptance criteria, and technical notes.
- The issue is neither a vague wish nor an unreviewable mega-task.
- Labels and priority reflect the nature and urgency of the work.
- No unsupported business motivation, deadline, metric, provider capability, or implementation detail was invented.
