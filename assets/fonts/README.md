The renderer uses the supplied Borda font at `resources/borda-webfont/Borda.ttf`.

If that asset is not available in another deployment, place a properly licensed Borda TTF file at that path or update `fontPath` in `src/functions/renderAgentCard.js`.

The ID-card renderer uses Borda exclusively and intentionally does not silently substitute another font. Verify that your font license permits server-side rendering.
