# Active game version and GitHub workflow

The current `main` branch is the source of truth for Thirst Trail. Start new tasks from the latest `main` unless the user asks to work on another branch.

Preserve all three chapters, Village Life jug deliveries and projects, supply interactions, saved progress, cinematic graphics, audio controls, accessibility, and the charity: water links in the footer.

For new work, commit and push changes to a feature branch, test them, and create a pull request targeting `main`. Merge into `main` when the user explicitly authorizes the merge and checks permit it. If anything remains in a PR rather than `main`, say so clearly and include the PR link; never imply those changes are already on `main`.

Do not resume the old `codex/canyon-reservoir-celebration` branch after its integration unless the user specifically requests it.
