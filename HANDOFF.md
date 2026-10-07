# alpha.24 release and KIT rollout

Goal: publish the approved shared-header change from #193 and pin the four KIT documentation PRs to its immutable release.

State: #193 merged as e949b9c after final CI, local review and Copilot re-review. Product PRs are heartkit#55, sleepkit#56, compressionkit#80 and physiokit#26; their final 404 fixes are pushed and dependency pins remain alpha.23.

Decision: use the repository's notes, Prepare release, and Publish release stages. Never move a tag or use a branch pin.

Next: merge alpha.24 notes with green CI, dispatch Prepare release, inspect and merge its reviewed version bump after CI, then publish from the exact green main commit. Update product pins and lockfiles, prove clean installs and rendered behavior, address final reviews and merge only green heads. Verify deployments separately.
