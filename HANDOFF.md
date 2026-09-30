# Compact tab terminals

Goal: shared compact terminal framing inside tab panels, requested during heartKIT #44 review. Tracked under existing shared tab-layout issue AmbiqAI/helia-ui#140. Worktree helia-ui-tab-terminals, branch codex/compact-tab-terminals, base alpha.21 (6cdbea0).

Implementation: extend shared untitled terminal styling to terminal frames within tab panels. Hide redundant title bars, restore top corners and copy-button spacing. Standalone terminal frames and nonterminal file titles retain existing rendering. Gallery covers fenced terminal, CodeBlock terminal and file example. Browser tests cover light/dark at390/1280px. Package validation passed (271 unit tests); 215 existing gallery tests passed; all four added light/dark and phone/desktop cases passed after fixing Markdown fence layout in the gallery fixture. Gallery build passes. heartKIT candidate build and all eight browser tests pass. Screenshot inspected and saved at /tmp/heartkit-compact-tab-terminal.png.

PR publication approved. Merge/release remain pending. Preview heartKIT through a temporary candidate package after validation; keep released alpha.21 pin intact until release. heartKIT #44 remains unmerged.
