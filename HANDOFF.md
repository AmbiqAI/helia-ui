# C++ reference extraction

Goal: preserve C++ templates and stable overload anchors for heliaRT API reference. Existing issue: AmbiqAI/helia-ui#59. Owner approved issue and draft PR publication. Specific issue: AmbiqAI/helia-ui#112. Merge/release remains pending final review.

Worktree: /Users/adam.page/.codex/worktrees/helia-ui-cpp-reference
Branch: codex/cpp-reference-contracts
Base: 6dd46f2 main. Original checkout left unchanged.

Implemented locally: template declarations for class and function signatures; C++ overloads identified from distinct Doxygen member IDs, with every overload using its Doxygen identity rather than source-order collision repair. Ordinary C identities unchanged.

Tests: real Doxygen1.17.0 C++ fixture includes two constructors, three Find overloads, class/defaulted templates, member/free templates, ownership prose and private-member exclusion. All 31 extractor tests pass. Local shared extractor consumes existing RT trial XML with no warnings; class and typed accessor templates retained. RT dependency pin/node_modules untouched. Ordinary // ownership comments remain an input-documentation concern, not solved here.

Verified: full package validation (184 unit tests), gallery build (42 pages), and 148 browser tests passed. Browser suite used a temporary config on port 4391 because RT uses the default port; temporary file removed. Packed package installed into isolated scratch consumer and CLI generated four RT trial pages plus seven artifacts without warnings.

Next: inspect diff and tests independently. Draft PR preparation in progress; no release or consumer dependency change.

Independent review corrections: pointer template parameter names are placed inside declarators; incomplete array/reference declarators omitted by Doxygen emit a warning. Shared visibility filtering keeps private/package overloads out of anchor identity decisions. Real fixture covers private overload extraction and an array-bound omission diagnostic. Targeted31 tests and full186 tests pass after these corrections. Prior gallery/browser run preceded these extractor-only changes.
