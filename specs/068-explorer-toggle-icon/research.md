# Research: File Explorer Toggle Icon

## R1. Draw the left-sidebar glyph with the installed PanelLeft icon

**Decision**: Replace `Squares2X2Icon` from `@heroicons/react/24/outline` with `PanelLeft` from `lucide-react`, on the existing header button in `src/renderer/App.tsx`.

**Rationale**: The installed icon (lucide-react 1.28.0, `dist/esm/icons/panel-left.mjs`) is one rounded rectangle and one vertical stroke:

- `rect` at x=3, y=3, width=18, height=18, rx=2. The outline runs from x=3 to x=21.
- `path` `M9 3v18`. A single vertical divider at x=9, from the top of the outline to the bottom.
- The window's horizontal centre is x=12. The divider at x=9 is left of centre.
- The left pane is 6 units wide and the right pane is 12 units wide.
- Both panes are unfilled because the svg `fill` is `none`.

That is FR-002. `lucide-react` is already a dependency (`package.json`), and `PanelLeft` is a named export. No package is added. Spec 010 chose Heroicons `Squares2X2` for this control. Spec 068 replaces that glyph and does not require an icon library, so the older assumption does not keep the four squares.

**Alternatives considered**:

- Heroicons `ViewColumns`: two dividers and three equal columns. It is not one left-of-centre divider.
- Heroicons `Window`: a title bar with three dots. It is not a sidebar.
- A hand-drawn SVG in a new file: the same geometry as `PanelLeft`, with an extra component to maintain.
- Keeping `Squares2X2`: the spec forbids the four-square glyph.

## R2. Match the neighbouring outline weight

**Decision**: Pass `strokeWidth={1.5}` and `className="chrome-icon"`. Do not change `src/renderer/chrome/chrome.css`.

**Rationale**: Lucide's default stroke is 2. The hamburger beside this button is Heroicons outline, whose stroke width is 1.5. A heavier stroke would make the new glyph look unlike its neighbour at the 20px size `.chrome-icon` already applies. The class sets width and height to 20px, which overrides Lucide's default 24px attributes, so the rendered box matches the hamburger glyph. Colour stays `currentColor`, so the button's existing `color` rules (normal, hover, focus, disabled) paint the stroke. The button element, its classes, and its handlers stay as they are (FR-003, FR-004).

**Alternatives considered**: Lucide's default stroke of 2 (rejected: heavier than the hamburger). A new CSS rule for this svg (rejected: the shared `.chrome-icon` rule already sets the size, and a special rule would be a second way to size one header icon).

## R3. Leave behaviour, labels, and persistence alone

**Decision**: Do not edit `useSidebarLayout`, the button's `aria-label`, `title`, `disabled={!hasWorkspace}`, or `onClick`. The glyph does not change when the explorer collapses.

**Rationale**: FR-004 requires the same symbol when the explorer is visible, hidden, or unavailable. FR-005 requires the tooltip and accessible name "Toggle file explorer" and the current mouse and keyboard activation. FR-006 requires the current visibility behaviour, the disabled state without a workspace, layout persistence, and shortcuts, and it forbids document or dirty-state changes. Those rules already live on the button and in `useSidebarLayout`. A static child SVG cannot affect them. Spec 010's keyboard contract (focus and Enter) stays in `tests/e2e/chrome.spec.ts`. The disabled-without-a-workspace case stays in `tests/e2e/window-state.spec.ts`.

**Alternatives considered**: Swapping to `PanelLeftClose` while the explorer is hidden (rejected: FR-004 requires one symbol in every state).

## R4. Assert the geometry from the SVG, not from a screenshot

**Decision**: The e2e suite reads the `rect` and `path` attributes, compares rendered bounds with the hamburger, and checks computed stroke colour against the neighbouring button and the header background in light and dark.

**Rationale**: SC-001 and SC-002 are about shape, bounds, and alignment. Attribute checks lock the divider to the left of centre and the panes to unfilled, and they fail on the old four-square path. Bounds checks lock the button and the glyph to the hamburger. Colour checks lock the theme treatment to the existing button colour without a new token. `window.emulateMedia({ colorScheme })` is how the current suites switch themes.

**Alternatives considered**: A pixel screenshot (rejected: brittle across DPI and theme, and it does not state the divider position). A renderer unit test of `App` (rejected: the acceptance checks are the built header, which the e2e suite already launches).
