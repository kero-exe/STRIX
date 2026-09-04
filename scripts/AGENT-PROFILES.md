# Agent Profile Spreadsheet

The editable workbook is `src/data/agent-profiles.xlsx`.

## Workflow

1. Run `npm run generate-agent-profiles` to refresh the workbook from the database.
2. Edit the fictional agent fields in the `Agent Profiles` sheet.
3. Run `npm run import-agent-profiles` to apply the changes.

You can provide a different workbook path to either script:

```powershell
node scripts/generate-agent-profiles.js path\to\agent-profiles.xlsx
node scripts/import-agent-profiles.js path\to\agent-profiles.xlsx
```

`Agent ID`, `Discord ID`, and `SHD ID` are identity columns. Do not change them. The importer rejects changed SHD IDs, changed deployment waves, unknown agents, duplicate Agent IDs, invalid wave values, and invalid SHD formats.

Optional fields can be cleared by deleting their cell contents. The importer updates only the `agent_profiles` table and does not change Discord users, balances, inventory, equipment, or registration dates.