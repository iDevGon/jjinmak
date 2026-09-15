---
name: 찐막
description: A dark gaming console for one deliberate last-game decision.
colors:
  bg: "#121819"
  surface: "#1c2426"
  line: "#344143"
  text: "#f0f5f3"
  muted: "#a1b1af"
  mint: "#8be5bc"
  orange: "#ffb080"
  toggle-off: "#283335"
  toggle-off-text: "#c4d1ce"
  toggle-off-hover: "#334345"
  toggle-on-text: "#133b2a"
  toggle-on-hover: "#a3efcd"
  power-text: "#4b2b17"
  switch-off: "#4a5859"
  switch-knob: "#e1e8e6"
  switch-on-knob: "#17432f"
  countdown-bg: "#34271f"
  button-border: "#667471"
  warning-text: "#412715"
  warning-hover: "#ffc29e"
  error-text: "#ffc6b5"
  error-bg: "#382522"
  dialog-text: "#c0ceca"
typography:
  display:
    fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif'
    fontSize: "64px"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-.04em"
  headline:
    fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif'
    fontSize: "26px"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "-.035em"
  title:
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.5
  body:
    fontFamily: '"Malgun Gothic", "Apple SD Gothic Neo", "Segoe UI", sans-serif'
    fontSize: "14px"
  label:
    fontSize: "12px"
  detail:
    fontSize: "11px"
rounded:
  small: "6px"
  button: "8px"
  countdown: "12px"
  dialog: "14px"
  switch: "20px"
  circle: "50%"
spacing:
  tight: "6px"
  small: "8px"
  medium: "12px"
  section: "16px"
  large: "22px"
  inset: "25px"
components:
  main-toggle:
    backgroundColor: "{colors.toggle-off}"
    textColor: "{colors.toggle-off-text}"
    rounded: "{rounded.circle}"
    width: "228px"
    height: "228px"
  main-toggle-active:
    backgroundColor: "{colors.mint}"
    textColor: "{colors.toggle-on-text}"
    rounded: "{rounded.circle}"
    width: "228px"
    height: "228px"
  main-toggle-power:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.power-text}"
    rounded: "{rounded.circle}"
    width: "228px"
    height: "228px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.button}"
    padding: "11px 14px"
  button-warning:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.warning-text}"
    rounded: "{rounded.button}"
    padding: "11px 14px"
  countdown:
    backgroundColor: "{colors.countdown-bg}"
    textColor: "{colors.orange}"
    rounded: "{rounded.countdown}"
    padding: "16px"
  dialog:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.dialog}"
    padding: "25px"
---

# Design System: 찐막

## Overview

**Creative North Star: "Dark gaming console"**

The user's selected dark gaming style is expressed through graphite surfaces, a large tactile circular switch, mint activation, and orange PC shutdown. The Korean wordmark and round central toggle are durable brand commitments. This is an operational desktop utility with direct Korean copy and compact controls.

The built HTML direction contract takes precedence over random seed `5ffa925d`. This document records the shared interface in `packages/desktop/src/ui/index.html`, `style.css`, and `renderer.js`. The dark gaming visual direction is unchanged by the monorepo split. Both macOS and Windows require real-game verification. The macOS shutdown dialog additionally explains administrator authorization.

**Key Characteristics:**

- One dominant circular action.
- Graphite surfaces with functional mint and orange states.
- Korean system typography and inline line icons.
- Short status explanations beside explicit cancellation controls.

## Colors

Graphite neutrals provide the quiet field; mint indicates activation and orange identifies PC shutdown.

### Primary

- **Mint:** active main toggle, checked Discord switch, connected indicator, keyboard focus, and text selection.

### Secondary

- **Power orange:** armed PC-shutdown toggle, checked power option, countdown, and confirmation button.
- **Error peach:** alert text on a muted red-brown surface.

### Neutral

- **Background and surface:** canvas and modal/demo-control surfaces.
- **Line:** option dividers, inactive ring, and low-emphasis boundaries.
- **Text and muted:** primary labels versus status detail, explanations, and footer.
- **Toggle and switch neutrals:** inactive control surfaces remain clearly visible on graphite.

**The State Color Rule.** Keep mint and orange tied to the implemented activation and shutdown meanings; accompany both with text.

## Typography

Use the installed Korean UI font stack from the frontmatter. Malgun Gothic leads on Windows; Apple SD Gothic Neo supports Mac simulation. No downloaded fonts or image assets are used.

The display role belongs to the central “찐막” label. Headline sets the two-line introduction; title sets live status. Option titles use the body size with weight 650, while explanation and footer text use detail. The wordmark is 23px at weight 900 with tight tracking. Dialog headings are 21px; dialog prose is 13px with line height 1.8. Countdown numerals use tabular figures.

## Layout

The Electron window opens at 480 × 820 with a minimum of 420 × 740. Content forms one centered column with a 560px maximum width and 27px / 32px / 22px top / horizontal / bottom padding. The native window frame remains outside the HTML layout.

The masthead pairs wordmark and connection status. A centered hero holds the headline, 244px ring around the 228px toggle, and a status region with 60px minimum height. Two divider-separated options follow; countdown and alerts enter normal document flow when present. Additional content can scroll vertically.

At widths of 440px or less, horizontal padding becomes 25px, countdown padding becomes 12px, and its title becomes 15px. This is compact desktop adaptation, not a separate mobile navigation design. The dialog is capped at 380px with 20px viewport clearance per side.

## Elevation & Depth

Depth comes mainly from tonal surfaces and thin borders. The main toggle alone receives a soft shadow (`0 12px 28px #00000030`); the outer ring establishes its physical boundary. The native modal darkens the background with `#000000b3`. Avoid adding floating cards around the existing option rows.

## Shapes

The dominant circle is echoed by the wordmark dot, connection dot, and switch knobs. Small demo surfaces use the small radius; secondary and warning buttons use the button radius. Countdown and dialog have progressively softer corners. Inline SVG icons use restrained rounded strokes rather than image assets.

## Components

### Main toggle

A tactile circular button with power icon, large Korean label, and state caption. Off is graphite; armed is mint; armed with PC shutdown is orange. The ring changes to muted mint or brown-orange with these armed states. Hover lightens the off and mint surfaces; press scales to .97. The current orange override remains orange on hover.

`aria-pressed` represents armed state. It starts disabled before initial state loads, then stays operable for cancellation while arming or armed. Execution, countdown, and applicable pending requests disable it. Disabled controls retain readable color; cursor and state text indicate the lock instead of reducing opacity.

### Option rows and switches

Full label rows combine a 24px icon, two lines of copy, and a 38 × 22px switch with a 16px knob. The checkbox has a 44 × 44px interaction area. Checked Discord uses mint; checked PC shutdown uses orange. Arming, armed, execution, countdown, and requests lock options, with explanatory text below the rows. No separate generic text field or navigation component exists.

### Countdown and secondary button

An orange-brown inline surface presents remaining seconds and a bordered “종료 취소” action. When the countdown first appears, focus moves to cancellation and the region scrolls into view. Status text explains that cancellation remains available. Seconds are visual tabular numerals; the adjacent status region provides polite live announcements.

### Confirmation dialog and warning button

Selecting PC shutdown opens a native modal with explanatory Korean copy, neutral “아니요,” and orange “진짜 찐막 켜기.” The neutral action receives initial focus. The warning action confirms the option; it does not itself begin immediate shutdown.

### Status, alerts, and simulation controls

Connection uses a dot plus text. Main status is polite and atomic; errors use `role="alert"`. Simulation has a dashed banner and expandable test buttons and appears only in demo state. These controls document the simulator, not production game verification.

All interactive components use the shared mint 3px focus outline with a 5px offset. Toggle transitions use .22s ease-out; switches use .2s. Reduced-motion preference removes transitions.

## Do's and Don'ts

- Do preserve the Korean name and dominant round toggle.
- Do show state and disabled explanations in readable Korean text.
- Do retain keyboard focus and accessible switch/button semantics.
- Do keep cancellation visible and focusable during the countdown.
- Don't replace the user-selected dark gaming direction with the random seed.
- Don't use orange for ordinary activation without PC shutdown context.
- Don't treat simulation screenshots as Windows functional verification.
