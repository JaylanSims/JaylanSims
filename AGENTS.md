# AGENTS.md

## Cursor Cloud specific instructions

This is a zero-dependency, single-file static HTML/CSS/JS browser game ("BitBalance: ROI vs. Passion"). The entire application lives in `index.html` — there is no build step, no package manager, no backend, and no external service dependencies.

### Running the application

Serve the project root with any static file server:

```
python3 -m http.server 8080
```

Then open `http://localhost:8080/index.html` in a browser.

### Lint / Test / Build

- **Lint**: No linter is configured. If needed, run a generic HTML/JS linter (e.g., `npx eslint index.html` or an HTML validator).
- **Tests**: No automated test suite exists. Manual browser testing is the only verification method.
- **Build**: There is no build step — the file is served as-is.

### Notes

- The entire game state is in-memory vanilla JS; there is no persistence layer or save mechanism.
- All CSS and JS are inline within `index.html`. Changes to styling, logic, or markup are all in that single file.
