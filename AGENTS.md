# Worktree Navigator Agent Guide

This workspace is a small VS Code extension written in TypeScript.
The job here is to make targeted, reviewable changes to the extension without drifting into generic orchestration behavior that does not help this repository.

Role prompts and workflow skills may still be used through oh-my-codex, but this file is the project-specific operating contract for everything under this directory.

<guidance_schema_contract>
Required sections for this workspace:
- **Role & Intent**: opening paragraphs plus project map.
- **Operating Principles**: `<operating_principles>`.
- **Execution Protocol**: delegation, command routing, and task flow.
- **Constraints & Safety**: repository boundaries, artifact rules, and change controls.
- **Verification & Completion**: `<verification>` and completion checks.
- **Recovery & Lifecycle Overlays**: preserve OMX runtime markers verbatim.

Keep runtime markers stable:
- `<!-- OMX:RUNTIME:START --> ... <!-- OMX:RUNTIME:END -->`
- `<!-- OMX:TEAM:WORKER:START --> ... <!-- OMX:TEAM:WORKER:END -->`
</guidance_schema_contract>

## Project Map
- `src/extension.ts`: activation entrypoint and command registration.
- `src/view/worktreeProvider.ts`: tree view behavior and most user-facing workflows.
- `src/git/worktreeService.ts`: Git worktree discovery, parsing, cache, and shell interaction.
- `src/shared/sharedFilesService.ts`: shared-file sync behavior across worktrees.
- `src/state/projectRegistry.ts`: persisted registered roots under VS Code global storage.
- `src/view/items.ts`: tree item classes and labels/icons.
- `src/types.ts`: shared domain types.
- `package.json`: extension contributions, command ids, scripts, and metadata.
- `out/`: generated JavaScript output from TypeScript. Do not hand-edit.
- `worktree-navigator-*.vsix`: packaged artifact. Regenerate when needed; do not patch manually.
- Command and config namespace: preserve the existing `worktreeNavigator.*` contract unless the task explicitly changes it.

<operating_principles>
- Work directly by default. Keep solutions simple and local to the touched behavior.
- Read the relevant source files before editing; do not infer architecture from names alone.
- Preserve existing command ids, config keys, storage schema, and worktree semantics unless the task explicitly changes them.
- Prefer small diffs over framework-like abstractions.
- Reuse current patterns in `src/` before adding helpers or layers.
- No new dependencies without explicit user approval.
- Avoid unrelated formatting churn. If formatting is required, keep it scoped to touched files unless the user asks otherwise.
- Do not edit generated artifacts in `out/` or packaged `.vsix` files.
- Verify every claim with commands or direct code evidence before reporting completion.
</operating_principles>

## Working Agreements
- Default package manager: `pnpm`.
- Primary verification commands:
  - `pnpm lint`
  - `pnpm compile`
  - `pnpm format:check`
- There is currently no automated test suite in the repository. Do not claim tests passed unless you added and ran them.
- For cleanup/refactor work, write a short cleanup plan first and preserve behavior before simplifying.
- Keep README / publishing docs aligned when user-visible behavior, commands, or settings change.
- Treat `.omx/`, `.vscode/`, and local packaging artifacts as non-source unless the task explicitly targets them.

<delegation_rules>
Default posture: stay direct.

Delegate only when it materially improves quality for:
- broad cross-file analysis
- documentation review or editorial tightening
- dedicated verification after substantial edits

When delegating:
1. Bound the task to a module or outcome.
2. Assign ownership by file or concern.
3. Prefer one reviewer/verifier over many overlapping helpers.
4. Keep child work read-only unless the task clearly benefits from parallel implementation.

Avoid delegation for small edits, straightforward bug fixes, or simple repository inspection.
</delegation_rules>

<invocation_conventions>
- `/prompts:name` invokes a narrower role prompt if available.
- `$name` invokes a workflow skill.
- `/skills` lists available skills.

Use skills only when explicitly requested, clearly implied by the user, or when workspace-level routing already requires them.
</invocation_conventions>

<execution_protocols>
Broad requests:
- Explore first when the request spans multiple modules or is ambiguous.
- Build a short local plan before editing when the task affects commands, config, and storage together.

Repository-specific guardrails:
- Keep `package.json` command registrations consistent with runtime command handlers in `src/extension.ts` and `src/view/worktreeProvider.ts`.
- Preserve the registry file shape in `src/state/projectRegistry.ts` unless migration work is explicitly requested.
- Preserve shared-file behavior centered on the main worktree and `.vscode/settings.json` unless the user asks to redesign it.
- Keep Git integration grounded in stable CLI behavior. Prefer extending current `git` shell usage rather than replacing it wholesale.
- If a change affects command titles, settings, or feature behavior, update docs in `README.md` and `PUBLISH.md` in the same pass when appropriate.

Command routing:
- Prefer `rg` and direct file reads for repository lookup.
- Use OMX read-only helpers only when they are clearly faster than the normal path.
- Use raw shell when exact command output matters for verification or debugging.

Continuation:
- Before concluding, confirm there is no pending implementation work, verification has run, and no known errors remain in the touched path.
</execution_protocols>

<constraints_and_safety>
- Never hand-edit `out/**`.
- Never silently change extension ids, command ids, configuration keys, or persisted storage names.
- Never commit unrelated local files such as temporary artifacts, `.vsix` outputs, or editor-local settings unless the user asks for them.
- Do not introduce new background services, watchers, or dependencies for a small extension without a clear need.
- Prefer deleting dead code over adding compatibility layers when behavior can remain unchanged.
</constraints_and_safety>

<verification>
Minimum bar for code changes:
1. Run `pnpm lint`.
2. Run `pnpm compile`.
3. Run `pnpm format:check` if formatting or config files changed.

Higher bar for behavior changes:
- Inspect affected command registrations and call sites.
- Verify docs if commands, settings, or user-facing behavior changed.
- If manual runtime validation is feasible, note the expected Extension Development Host flow instead of pretending it was run.

Report completion with:
- changed files
- what was simplified or clarified
- remaining risks, if any
- verification evidence actually collected
</verification>

<cancellation>
Stop when the user says stop, when the requested work is complete and verified, or when a hard blocker prevents meaningful progress.
Do not keep iterating once the repository-specific goal is met.
</cancellation>

<state_management>
OMX state may exist under `.omx/`, but repository source of truth is the tracked project code and documentation.
Do not rely on `.omx/` artifacts as implementation state unless the task explicitly targets OMX workflows.
</state_management>

<!-- OMX:RUNTIME:START -->
<!-- OMX:RUNTIME:END -->

<!-- OMX:TEAM:WORKER:START -->
<!-- OMX:TEAM:WORKER:END -->
