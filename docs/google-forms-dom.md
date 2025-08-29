# Google Forms DOM survey

Survey baseline: 24 August 2026. This note describes the **respondent view**
of a published Google Form (`/forms/d/e/.../viewform`), not the Forms editor.
The markup is intentionally structural: Google-generated class names and
`js*` attributes are implementation details and must not be selectors.

## Captured structure

`tests/fixtures/google-form-sample.html` is a sanitised, minimal DOM snapshot
of the relevant structure. It contains a short-answer question, a paragraph
question, and a radio question to make the supported boundary explicit.

```html
<div role="list">
  <div role="listitem">
    <div id="question-name" role="heading" aria-level="3">Họ và tên *</div>
    <input type="text" aria-labelledby="question-name" aria-describedby="help-name" />
  </div>
</div>
```

The question wrapper is a `div[role="listitem"]`; the visible question title
is exposed as `div[role="heading"]`, and the editable native input references
that title with `aria-labelledby`. Optional help text is normally referenced
by `aria-describedby`. The precise nested `div` count and every CSS class are
not stable and are deliberately omitted from the contract.

## Selector contract for `GoogleFormsAdapter`

| Purpose | Preferred selector / algorithm | Fallback | Do not rely on |
| --- | --- | --- | --- |
| Identify a respondent form | `location.hostname === "docs.google.com"` and pathname matching `/forms/` | presence of `div[role="list"] > div[role="listitem"]` | a `form` element or an editor-only URL |
| Find question blocks | `div[role="list"] > div[role="listitem"]` | `div[role="listitem"]` filtered to blocks containing a supported control | generated classes / `jscontroller` |
| Question title | first `[role="heading"]` inside the block | resolve the first supported control's `aria-labelledby` IDs, then its accessible label | fixed `id` values or heading depth |
| Help text | resolve IDs in the control's `aria-describedby` | visible non-control text in the block, only if title is unavailable | placeholder `Your answer` |
| Short answer | `input[type="text"], input[type="email"], input[type="tel"], input[type="number"]` | `input:not([type])` | hidden inputs |
| Paragraph | `textarea` | none | contenteditable wrappers |

Selectors are scoped to a question block before controls are searched. This
prevents accidentally associating a question title with an input in a later
question. A question with zero or multiple supported controls is skipped in
the first adapter version; multi-input date/time questions and choice controls
need dedicated handling.

## Runtime rules

- Treat the role and accessibility relationships as the public compatibility
  surface. Google Forms may rerender or rename classes without notice.
- Do not use broad `input` queries at document level; the page contains
  browser/Google UI inputs in addition to respondent fields.
- For an input whose `aria-labelledby` names several IDs, concatenate their
  text in listed order and normalise whitespace.
- Ignore `input[type="hidden"]`, submit/navigation buttons, and radio,
  checkbox, and combobox controls in the initial free-text implementation.
- After a value write, dispatch bubbling `input` and `change` events, then
  verify after the next animation frame because Forms can rerender its React
  tree.

## Manual re-survey checklist

Before implementing or updating the adapter, open a published test form in a
signed-out/Incognito window and use DevTools **Elements** to verify all of the
following against a text and paragraph question:

1. One nearest `div[role="listitem"]` encloses exactly that question.
2. The question title is still exposed through `[role="heading"]` or the
   input's `aria-labelledby` target.
3. The editable element is a native `input` or `textarea`, not only a visual
   wrapper.
4. The help text IDs in `aria-describedby` resolve inside the same block.
5. Setting a value and dispatching `input`/`change` survives one animation
   frame and Next/Back navigation.

If any check fails, save a new sanitised fixture alongside the current one and
update this document before changing production selectors. Never commit form
answers, respondent names, e-mail addresses, IDs, or a live form URL.
