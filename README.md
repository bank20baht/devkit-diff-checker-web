# Devkit Diff Checker

A fast, client-side text diff tool built with Angular. Compare two blocks of text instantly with line-level and word-level highlighting.

**Live:** https://diff-checker.20baht.com

## Features

- **Split & unified views** — side-by-side or stacked diff layout
- **Word-level diffing** — highlights character-level changes within modified lines
- **Comparison options** — ignore whitespace, ignore case, toggle word diff
- **Stats** — additions, deletions, similarity percentage, hunk count, and computation time
- **Keyboard shortcuts** — `Cmd+Enter` to compare, `Cmd+Shift+S` to swap sides

## Tech Stack

| | |
|---|---|
| Framework | Angular 21 (standalone components, Signals) |
| Styling | Tailwind CSS 4 |
| Testing | Vitest |
| Package manager | Bun |
| Module federation | Angular Architects Native Federation |

## Getting Started

```bash
bun install
bun run start       # dev server at http://localhost:4201
bun run build       # production build
bun run test        # run tests
```

## Deployment

```bash
./deploy.sh         # build + sync to S3 (diff-checker.20baht.com)
```

## Architecture

All diffing runs entirely client-side using an LCS (Longest Common Subsequence) algorithm with an 80ms debounce on input. The app is exposed as a micro-frontend via Native Federation (`./dk-diff-checker-routes`).
