# Orin — Agent Working Rules

Apply these rules to all changes in this repository. More specific `AGENTS.md`
files in subdirectories may add to these rules.

## Implementation principles

1. Make the smallest change that fully solves the requested problem.
2. Prefer straightforward, readable code over clever abstractions or broad
   refactors.
3. Change only files that are necessary for the task. Preserve existing
   patterns unless they directly prevent the requested fix.
4. Do not make speculative cleanup, renames, dependency changes, or unrelated
   formatting edits.
5. Before adding a new abstraction, dependency, or service, first use an
   existing project pattern when it keeps the solution simple.

## Improvement suggestions

- Point out small, high-value performance, reliability, or maintainability
  improvements when you notice them.
- Keep suggestions separate from the requested implementation and do not apply
  optional changes without clear approval.
- Prefer incremental improvements that are easy to verify and revert.

