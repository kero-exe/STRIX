# Live Agent Card Preview

Start the development-only preview with:

```powershell
npm run preview-agent-card
```

Open `http://localhost:4173` in a browser. The page uses the existing `renderAgentCard()` function with a fixed development sample agent and refreshes the PNG whenever `src/functions/renderAgentCard.js` changes. It does not use or modify player data and is not registered as a Discord command.

Edit `ID_CARD_CONFIG` at the top of `src/functions/renderAgentCard.js`. Save the file and the preview reloads automatically. There is no drag-and-drop editor yet; configuration edits are applied by saving the renderer file.