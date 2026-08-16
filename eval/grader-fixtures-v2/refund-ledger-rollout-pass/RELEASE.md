# Release operations

If the new release fails, make the preceding known-good release current:

```bash
gh release edit v1.4.2 --latest
```
