# Archify upstream source

- Repository: https://github.com/tt-a1i/archify
- Integrated revision: `ed7f4d4b48d4424d36edfed8043de3de8dea6b45`
- License: MIT (see `LICENSE`)
- Runtime entry used by PCN/PGD: `archify/renderers/workflow/workflow-compiler.mjs`, `archify/renderers/shared/utils.mjs`, and `archify/assets/template.html`

The application invokes this vendored source on the server after converting authenticated PCN or PGD facts to Archify workflow schema v2. Private document bytes, access tokens, and browser-supplied topology are not passed to the reader.
