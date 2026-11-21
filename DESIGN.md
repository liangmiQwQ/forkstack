# Design

## Color

Use the `neutral` scale as the starting palette for the contributor dashboard and PR navigation buttons. The landing page has room for a wider palette.

## Emphasis

- **Soft fill** is the default. Use a subtle neutral background for the selected PR in the dashboard and give both `Previous PR` and `Next PR` the same fill in a PR description.
- **Outline** defines the edge of a control, such as a branch input. A separate focus ring keeps keyboard focus visible with any treatment.
- **Solid fill** gives the main action in a workflow the strongest contrast. Use a dark surface with light text in light mode and reverse the pairing in dark mode.

## Corners

Use moderately rounded rectangles by default.

## Typography

| Typeface        | Use                                                                                                       | Web fallback              |
| --------------- | --------------------------------------------------------------------------------------------------------- | ------------------------- |
| Instrument Sans | Dashboard headings, PR titles, body text, and button labels, including the lettering in PR button artwork | `system-ui, sans-serif`   |
| IBM Plex Mono   | Repository and branch names, PR numbers such as `#184`, and commit hashes                                 | `ui-monospace, monospace` |

Both families use the SIL Open Font License 1.1. When bundling or self-hosting the font files, include each family's copyright notice and license text. [Instrument Sans license](https://github.com/Instrument/instrument-sans/blob/master/OFL.txt) · [IBM Plex license](https://github.com/IBM/plex/blob/master/LICENSE.txt)

The application code and PR button artwork rendered with these fonts can use forkstack's MIT license. [OFL FAQ](https://openfontlicense.org/ofl-faq/)
