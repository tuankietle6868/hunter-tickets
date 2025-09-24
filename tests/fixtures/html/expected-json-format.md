# `expected.json` format

Each HTML fixture has a companion file named `<fixture-name>.expected.json`.
It describes the expected result after scan and autofill; it does not contain
real personal data.

```json
{
  "fixture": "example.html",
  "fields": [
    {
      "field": "#full-name",
      "expectedType": "FULL_NAME",
      "shouldFill": true
    },
    {
      "field": "#terms",
      "expectedType": "UNKNOWN",
      "shouldFill": false,
      "expectedReason": "policy_blocked"
    }
  ]
}
```

| Property | Required | Meaning |
|---|---:|---|
| `fixture` | Yes | File name of the paired HTML fixture. |
| `fields` | Yes | One entry for each logical control or control group being asserted. |
| `field` | Yes | Stable CSS selector for that control or group. |
| `expectedType` | Yes | Expected `FieldType` (`FULL_NAME`, `PHONE`, `DATE_OF_BIRTH`, etc.). Use `UNKNOWN` if the control must not be classified as personal data. |
| `shouldFill` | Yes | Whether the extension may autofill the control. |
| `expectedReason` | Only when `shouldFill` is `false` | Expected skip/status reason, such as `policy_blocked`, `duplicate_manual`, `low_confidence`, `ambiguous`, or `format_mismatch`. |

`expectedReason` is omitted for fields that should fill. A radio or checkbox
group uses one selector matching the complete group, rather than one entry per
option.
