The renderer uses the existing Borda font at `resources/borda-webfont/Borda.woff`.

If that asset is not available in another deployment, place a properly licensed Borda WOFF file at that path or update `fontPath` in `src/functions/renderAgentCard.js`.

The ID-card renderer uses Borda exclusively and intentionally does not silently substitute another font. Verify that your font license permits server-side rendering.
