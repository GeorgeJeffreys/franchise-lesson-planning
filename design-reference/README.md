# Design reference

The approved Claude Design output (claude.ai/design), vendored as the visual
**source of truth** for the build. These are HTML/CSS prototypes — recreate their
visual output in the app; don't copy their internal structure.

| File | Used by |
| --- | --- |
| `Login.dc.html` | The `/login` screen (this slice). |
| `Weekly Overview.dc.html` | The shared chrome / app shell (this slice); the overview content (next slice). |
| `Curriculum Browser.dc.html` | The curriculum browser (later slice). |
| `Lesson Plan Editor - Final.dc.html` | The lesson editor (later slice). |
| `support.js` | The prototype runtime (`<x-dc>` shim). Reference only — not used by the app. |

Brand anchors: fonts **Sora** (UI) and **Sacramento** (the wordmark only);
palette pink `#B62A5C`, cream `#F5EDE5`, teal `#1F7A6C`, plus the warm neutral
ramp and status colours. These are encoded as design tokens in
`src/app/globals.css`.
