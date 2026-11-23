# Home hero decoration

Customize the new-conversation home page (the “探索未至之境” headline and the composer card).

## What it does

| Setting | Effect |
| --- | --- |
| Headline text | Replaces the headline text on the home hero only (other pages keep the locale text). Empty = default. |
| Headline color | Swatch presets + native color wheel for the headline text; the "·" swatch = theme default. |
| Headline size | Font size in px (16–72, default 26). |
| Card color | Background color of the new-conversation composer card (overrides the `--dsw-specific-input-major` token inside the hero scope only). Curated translucent tint presets + color wheel + opacity slider; "·" = default. |
| Card width | Max width of the hero stack (headline + card) in px (320–2000, "默认宽" = shipped default). |
| Horizontal offset | Moves the hero group (headline + composer together) left/right in px (-300–300). One transform on the hero scroll body; no scrollbars. |
| Vertical offset | Moves the hero group up (negative) or down (positive) in px (-400–400), same technique. |
| Vertical alignment | 居中 (shipped default) / 靠上 / 靠下(贴底) — switches the hero's flex containers to `flex-start`/`flex-end` so the group can reach the screen edges. |
| Headline ↔ composer gap | Extra spacing between the headline stack and the composer card (-40–120 px, default = shipped). |
| Composer height | Composer editor height in px (44–160, default = shipped) — makes the card slimmer. Overrides `--dsh-composer-height` and pins the editor root height. |
| Hide logo | Hides the fish brand mark before the headline (scoped CSS; the `conversation.hero.brand.mark` slot stays untouched). |
| Named presets | Save the current configuration under a name and re-apply it later (stored in `localStorage` under `dsh-hero-decor:presets:v1`). |

The layout stage in the settings page renders a draggable rounded rectangle representing the headline + composer group; dragging it live-previews (and sets) both offsets within the visible stage bounds. All edits preview live on the real home page and persist only on 保存; closing the settings panel discards an unsaved draft (a `dsh-hero-decor:preview-end` event clears the in-memory draft).

Open **Settings → 主页美化** to edit. Changes apply immediately; values are stored in the browser's `localStorage` under `dsh-hero-decor:v1`.

## How it works

- The client half registers an outermost `conversation.hero.frame` layer (`id: hero-decor-frame`, `order: 100`) that wraps the scroll body in a `display: contents` element carrying the `data-dshd-hero` attribute; all scoped CSS hangs off it.
- Colors and width are applied by overriding the shipped CSS custom properties inside that scope, so both the headline stack and the composer card follow one width knob.
- The headline text is kept in place by a MutationObserver scoped to the hero layer, because the text span has no stable class of its own and React re-renders it on locale changes.
- A settings page is contributed through the `settings.section` slot.

## Limitations

- If a future DSH release renames the conversation package's CSS-module keys (`_headline`, `_titleGroup`), the headline text override and headline styling fall back to the shipped look; the card color, width, and offset keep working (they use official variables).
- Preferences are per browser profile; clearing site data resets them.
- The host half is intentionally minimal: the customization is pure browser UI, so it stores nothing in the profile config.
