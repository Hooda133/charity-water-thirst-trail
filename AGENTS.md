# Active game version and GitHub workflow

These instructions apply to every coding task in `Hooda133/charity-water-thirst-trail`, including changes to this file. The user's priorities are to never lose completed work, preserve all existing chapters and features, and keep `main` as the official version of Thirst Trail.

Preserve all three chapters, Village Life jug deliveries and projects, supply interactions, saved progress, cinematic graphics, audio controls, accessibility, and the charity: water links in the footer.

## Required workflow for every coding task

1. **Start from the latest `origin/main`.** Before editing, inspect the working tree, current branch, and unpushed commits, then fetch `origin`. Create each new feature branch from the freshly fetched `origin/main`. If continuing an existing feature branch, preserve its work and merge the latest `origin/main` into it before proceeding. Use a separate worktree or checkout when needed to leave unrelated existing changes intact.
2. **Commit progress incrementally.** Save meaningful improvements in Git commits as they are completed. Keep unrelated work intact and review each commit's changes.
3. **Push completed commits before ending the session.** Push all completed commits to GitHub. If a push is blocked, retain the local commits and clearly report the blocker; never describe local-only work as saved on GitHub.
4. **Maintain a pull request targeting `main`.** Create or update a pull request for every feature branch, with an accurate description of the changes and validation.
5. **Test and resolve conflicts without regressions.** Run the relevant tests and checks for the change. Resolve merge conflicts carefully without losing existing chapters, features, or completed work, then rerun affected checks. Report any checks that could not run.
6. **Never overwrite, discard, or force-push existing work.** Do not use destructive resets, cleanup commands, file replacement, branch deletion, or history rewriting that would lose existing work. Never force-push, including with `--force-with-lease`. Integrate changes with ordinary commits and merges that preserve history.
7. **Merge when the user authorizes it and required checks pass.** Do not merge without explicit user authorization for that pull request. Once authorized, merge into `main` after all required checks pass and conflicts are resolved. Recheck authorization and check results against the pull request's current contents before merging.
8. **Verify completed changes directly on GitHub.** Before reporting completion, confirm the remote branch and commit SHA, the expected changed files and contents, and the pull request's target and status. A successful local commit or push command alone is not sufficient verification.
9. **End every task with an explicit status report.** Include the branch name, commit and push status, pull request link, relevant test/check results, and whether the changes are merged into `main`. State any incomplete or blocked steps clearly.
10. **Never claim changes are fully saved to `main` without verifying the merge.** Confirm on GitHub that the pull request is merged and the expected changes are present on `main`. Until then, clearly say that the changes remain on the feature branch and link the pull request.

Do not resume the old `codex/canyon-reservoir-celebration` branch after its integration unless the user specifically requests it.
