A production import treated `  # retired account` as data. During the session,
the parser was changed from `line.startsWith("#")` to
`line.trimStart().startsWith("#")`, which fixed the reported file. Review found
no durable coverage for the corrected case. The user confirmed that comments
begin with `#` after optional leading whitespace.
