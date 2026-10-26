---
name: Foundry Portfolio
description: A calm light page with a dark console where eight AI agents do the work.
colors:
  cool-paper: "#eef0f0"
  ink: "#161a1e"
  slate-muted: "#4b555e"
  hairline: "#c8ced2"
  ghost-outline: "#6b767f"
  console-iron: "#1e252b"
  console-iron-raised: "#272f37"
  console-divider: "#3a444e"
  console-outline: "#707c88"
  console-text: "#e6ebee"
  console-text-muted: "#9aa6b0"
  forge-amber: "#f0a23a"
  forge-amber-hover: "#f6b55e"
  on-amber: "#1b1405"
  verdigris: "#1f6f63"
  verdigris-lit: "#5bbfb0"
  brick: "#8f3a2b"
  brick-lit: "#e0806a"
typography:
  display:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "clamp(3.4rem, 10vw, 7rem)"
    fontWeight: 600
    lineHeight: 0.95
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.55rem, 3.4vw, 2.4rem)"
    fontWeight: 550
    lineHeight: 1.12
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 3vw, 2rem)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  body:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Schibsted Grotesk, system-ui, sans-serif"
    fontSize: "0.9rem"
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.55
rounded:
  sm: "8px"
  md: "10px"
  lg: "12px"
  xl: "18px"
  full: "999px"
spacing:
  xs: "8px"
  sm: "12px"
  md: "16px"
  lg: "28px"
  section: "56px"
components:
  button-primary:
    backgroundColor: "{colors.forge-amber}"
    textColor: "{colors.on-amber}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "46px"
  button-primary-hover:
    backgroundColor: "{colors.forge-amber-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "46px"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.console-text}"
    rounded: "{rounded.full}"
    padding: "9px 16px"
  field:
    backgroundColor: "{colors.console-iron-raised}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "46px"
  stage:
    backgroundColor: "{colors.console-iron}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.xl}"
    padding: "28px"
  panel:
    backgroundColor: "{colors.console-iron-raised}"
    textColor: "{colors.console-text}"
    rounded: "{rounded.lg}"
    padding: "16px"
---

# Design System: Foundry Portfolio

## Overview

**Creative North Star: "The Control Room"**

A calm, cool-grey page with one dark console set into it. The page explains; the console is where the eight agents work, and everything that needs attention happens there. The look is precise, calm, confident and a little warm: type is exact and readable, color is rare, and the one warm note, Forge Amber, marks what a visitor can act on. It reads like good instrumentation, not marketing.

The system is flat and tonal. Depth comes from the contrast between the paper page and the iron console, and from lighter fills inside the console, not from shadows. Motion answers an action or marks one finished moment; it never decorates.

**Key Characteristics:**
- Light page, one dark stage; the stage is the artifact and the page recedes.
- One accent, used for actions and focus only.
- Flat surfaces, thin outlines, tonal layering.
- Large confident display type, quiet body text, monospace only for machine output and numbers.
- Every outline and text pair meets WCAG AA.

## Colors

A cool neutral pair, one amber accent, and two status colors that each come in a dark version for the page and a lit version for the console.

### Primary
- **Forge Amber** (#f0a23a): the only accent. Primary buttons (Watch it run, Run, See the draft pull request), focus rings on the console, the logo dot, the active agent ring. Text on it is On Amber (#1b1405), 8.7:1. Hover lightens to #f6b55e.

### Neutral
- **Cool Paper** (#eef0f0): the page background.
- **Ink** (#161a1e): text on the page, 15:1.
- **Slate Muted** (#4b555e): secondary text on the page, 6.7:1.
- **Hairline** (#c8ced2): dividers on the page. Decoration only.
- **Ghost Outline** (#6b767f): the outline of the secondary button on the page, 4:1.
- **Console Iron** (#1e252b): the stage background.
- **Console Iron Raised** (#272f37): fields, panels and agent nodes inside the stage.
- **Console Divider** (#3a444e): quiet dividers inside the stage. Decoration only.
- **Console Outline** (#707c88): outlines of controls inside the stage, 3.2:1 against their fill.
- **Console Text** (#e6ebee) and **Console Text Muted** (#9aa6b0): text on the stage, 12.9:1 and 6.2:1.

### Status
- **Verdigris** (#1f6f63 on the page, #5bbfb0 on the console): passed, working, real.
- **Brick** (#8f3a2b on the page, #e0806a on the console): errors and limitations.

### Named Rules
**The One Warm Note Rule.** Forge Amber marks only what can be acted on or what is working right now. It is never body text, never a background wash, never decoration.
**The Two Greens, Two Reds Rule.** Status colors have a page version and a console version. Using the page version on the console, or the reverse, fails contrast.

## Typography

**Display and Body Font:** Schibsted Grotesk (with system sans fallback)
**Mono Font:** JetBrains Mono

**Character:** a humanist grotesque with a sharp, slightly editorial edge, set tight at large sizes and open at body size. The mono face appears only where something is machine output.

### Hierarchy
- **Display** (600, clamp 3.4 to 7rem, 0.95, -0.045em): the single word Foundry, once, beside the logo mark.
- **Headline** (550, clamp 1.55 to 2.4rem, 1.12, -0.025em): the one-line tagline under it. Max 24 characters wide, balanced wrapping.
- **Title** (600, clamp 1.5 to 2rem, 1.2): section headings. The stage title is slightly smaller.
- **Body** (400, 1.0625rem, 1.6): paragraphs, max about 62 characters wide; the hero lede is muted and capped near 40rem.
- **Label** (400, 0.9rem): form labels and captions.
- **Mono** (400, 0.8125rem, 1.55): agent output, the player clock and dashboard numbers, with tabular figures.

### Named Rules
**The One Display Rule.** Display size appears once. Everything else steps down at least a third.
**The Machine Voice Rule.** Mono type means a machine produced it. Never use it for decoration or for headings.

## Layout

A single column up to 1120px with 16px side gutters, left aligned. Sections sit 56px apart. The dark stage is a full-width block inside that column, with 28px of padding (18px on phones). Inside it the request form is one row on wide screens and a stack on narrow ones; the pipeline drawing is wide above 900px and tall and centered below it, so its labels stay near 17px. Panels flow into an auto-fit grid, 320px minimum. Text blocks stay under about 62 characters. The sticky nav is a thin bar with a blur behind it.

## Elevation & Depth

Flat and tonal. There are no shadows. The one blur is the translucent sticky nav. Depth is made by the contrast between Cool Paper and Console Iron, and inside the console by a lighter Console Iron Raised for fields, panels and nodes. The only exception in the codebase is a faint 2px shadow on a small admin element; do not extend it.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest and at hover. Use a color, outline or scale change to show state, never a shadow.

## Shapes

Rounded rectangles in a short scale: 8px for small controls, 10px for buttons and fields, 12px for panels and the result card, 18px for the stage, and a full pill for chips and the mode badge. Borders are 1px outlines. The logo mark is a rounded square with an F and an amber dot. No sharp-cornered boxes, no pill buttons, and no one-sided accent borders.

## Components

### Buttons
- **Shape:** 10px radius, 46px tall, 20px horizontal padding, weight 600.
- **Primary:** Forge Amber with On Amber text. Hover lightens slightly; pressed scales to 0.97 over 160ms.
- **Ghost:** transparent with a 1px Ghost Outline and Ink text, for the secondary choice on the page.
- **Busy:** while a run is in progress the button becomes an outline with muted text and a progress cursor, so it reads as working, never as broken.

### Chips
- **Style:** transparent, 1px Console Outline, Console Text, full pill, 9px 16px padding.
- **State:** the chip whose replay is showing gets an amber outline.

### Fields
- **Style:** Console Iron Raised fill, 1px Console Outline, 10px radius, 46px tall, 14px padding. Placeholder text is muted.
- **Focus:** a 2px Forge Amber ring with 2px offset.
- **Error:** a Brick Lit message under the form and a Brick Lit outline on the field; the cursor moves to the field.

### Stage and Panels
- **Stage:** Console Iron, 18px radius, 28px padding, holds the whole demo.
- **Panels:** Console Iron Raised, 1px Console Divider, 12px radius, 16px padding. The active panel has an amber outline. Agent output sits in a darker mono block inside.

### Agent nodes (signature component)
Rounded rectangles in the pipeline drawing, each with a name and a status line. Waiting nodes are quiet; the working node has a pulsing amber ring; finished nodes turn Verdigris Lit and gain a checkmark that pops in over 280ms; failed nodes turn Brick Lit. Keyboard focus draws a near-white 3px outline.

### Result card
A 12px-radius card with a faint verdigris tint, a plain result sentence and, after a live run, an amber button to the draft pull request. It rises into place once when the run finishes.

### Navigation
A sticky bar over Cool Paper with the logo and name on the left and five text links on the right, Slate Muted by default and Ink on hover. Links have at least a 40px tap height. On phones the links drop to a full-width second row.

## Do's and Don'ts

### Do:
- **Do** keep every text pair at 4.5:1 or better and every control outline at 3:1 or better against what it sits on.
- **Do** use Forge Amber only for primary actions, focus rings, the logo dot and the working state.
- **Do** animate only `transform` and `opacity`, keep UI motion under 300ms with an ease-out curve (cubic-bezier(0.23, 1, 0.32, 1)), and switch every animation off under reduced motion.
- **Do** show state with color, outline or a small scale change, and give every pressable thing a 0.97 press response.
- **Do** keep the hero's one orchestrated entrance, and give any new motion a reason: an action answered or a task finished.
- **Do** label every simulated or made-up thing as such, in the interface and in plain words.

### Don't:
- **Don't** add shadows, gradients, glassmorphism or gradient text.
- **Don't** use a thick colored border on one side of a card; the detector flags it as a tell of generated pages.
- **Don't** put amber text on Cool Paper or use amber as a background wash.
- **Don't** use the page versions of the status colors on the console or the lit versions on the page.
- **Don't** use all-caps eyebrow labels, numbered markers on content that is not a sequence, or monospace for headings.
- **Don't** add icons, emoji or decorative imagery; the screenshots from the real browser are the only pictures.
- **Don't** claim anything the product does not do; follow the wording rules in CLAUDE.md.
