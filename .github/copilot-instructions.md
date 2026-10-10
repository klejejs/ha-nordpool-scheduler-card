# Nordpool Scheduler Card

The ⓘ button on the card opens an explanation of every feature and how the features work together. Its content lives in `src/info.ts`.

- Any change that adds or alters a user-facing feature, option or behaviour updates `src/info.ts` in the same change. That includes card options, auto mode settings, what the grid shows, and behaviour that comes from the integration.
- Explain how the new feature interacts with the existing ones, not only what it does on its own. Extend the worked example under "How the auto settings combine" when a new auto mode setting changes which slots run.
- If the snapshot gains a new setting, show its current value under "This scheduler", hidden when an older integration doesn't send it.
- Keep `README.md` in step with the dialog.
- Run `yarn lint` and `yarn build` before committing.

This file and `AGENTS.md` carry the same rules; change both together.
