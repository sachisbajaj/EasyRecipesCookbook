Implement weekly grocery lists from PLAN.md and issue #20, using the meal planner.

As a cook, I want an editable grocery checklist generated from my week's planned meals so I can shop once.

Add the planned grocery_items table in a versioned migration with owner-only RLS, immutable ownership/week, finite positive optional quantity, required nonblank name/unit, Monday week_start, checked state and position. Account deletion cascades; recipe deletion must not change saved grocery snapshots.

Generate a selected week's list atomically from owned planned meals and ingredients, scaling each known quantity by planned/base servings. Normalize names and units by trimming, collapsing whitespace and case. Combine only matching normalized name/unit pairs; do not convert units, infer equivalent products, or drop unknown amounts. If a matching ingredient has both known and unknown amounts, keep the known sum and a separate “as needed” entry. Handle repeated meals. Replace only the user's selected-week list in a transaction, with serialized concurrent generation.

Add Grocery List navigation with Monday-based week selection, generation, manual additions, item editing/deletion, and persistent bought/already-owned checkmarks. Explain snapshot behavior and confirm replacement of existing edits/checkmarks before regeneration, including when no meals remain. Preserve inputs/state on errors and provide recovery, loading/empty states, and protection against duplicate pending operations and stale results after week/account changes. Use the existing responsive design.

Document schema, setup, normalization and test limitations. Test arithmetic (scaling, repeated meals, same units, different units/products and unknown amounts), database isolation, constraints, replacement rollback, snapshot independence and cascades. Test editing/checking/deleting, failed requests, confirmation/cancellation, refresh and mobile use; run regression checks and build.

Do not change the original PLAN.md or set up production infrastructure. Show the implementation and results for review before committing/pushing implementation, opening/merging its PR, applying hosted migrations or publishing.
