# KQTN footer-only grouping

## Objective

Make combined KQTN PDF grouping read only the footer band of each page. Use the
footer's encoded number/report family (`Số mã hóa`, `ITD`, `EMC`, or `ITDC`) as
the grouping key, then compare the actual segment length with the footer's
`current/total` page counter. A mismatch is a review warning and must not block
split or save.

## Implementation steps

1. Update `design.md` to make footer-only OCR and warning-only page-count
   validation the authoritative behavior.
2. Add failing contract/unit tests for footer cropping, identifier extraction,
   footer-only combined mapping, and non-blocking mismatch warnings.
3. Change the DDT job to create a footer-only PDF and use the bounded
   footer-candidate OCR path, normalize only the requested identifier families,
   and derive stable ranges from footer counters instead of full-page identity
   OCR. Keep the shared service endpoint compatible for later internal crop and
   predictor-batch improvements.
4. Remove the combined-flow first-page full OCR pass; preserve manual target
   mapping/search and expose footer/page-count warnings in review.
5. Run focused tests, the full test suite, and the real 116-page Desktop PDF
   through the native DDT endpoint to verify the expected six groups.

## Verification targets

- `ITD 1132-26-M02` → pages 1–20
- `ITD 1132-26-M03` → pages 21–39
- `ITD 1132-26-M04` → pages 40–59
- `ITD 1132-26-M05` → pages 60–78
- `ITD 1132-26-M06` → pages 79–96
- `ITD 1132-26-M07` → pages 97–116
- Any footer total that differs from a segment's actual length remains a
  visible warning while split/save remain enabled.
