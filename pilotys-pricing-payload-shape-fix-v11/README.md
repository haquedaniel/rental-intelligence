# Pilotys pricing payload-shape fix v11

Fixes `_is_current()` when `pricing_publication_actions.payload` is the normal Beds24 request array rather than a metadata object.

This allows an already-written action to reach calendar reconciliation instead of failing with:

```
'list' object has no attribute 'get'
```

No migration or frontend change is required.
