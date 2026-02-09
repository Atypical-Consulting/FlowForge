#!/bin/bash
# Check that no blade imports from another blade's internal files.
# This enforces isolation between blade modules — blades should only
# depend on shared code (hooks, stores, components, _shared), never
# on each other's internals.

EXIT=0
for blade_dir in src/blades/*/; do
  blade_name=$(basename "$blade_dir")
  [[ "$blade_name" == _* ]] && continue
  for other_dir in src/blades/*/; do
    other_name=$(basename "$other_dir")
    [[ "$other_name" == _* ]] && continue
    [[ "$other_name" == "$blade_name" ]] && continue
    if grep -r "from.*blades/$other_name/" "$blade_dir" --include="*.ts" --include="*.tsx" -l 2>/dev/null; then
      echo "ERROR: $blade_name imports from blades/$other_name/"
      EXIT=1
    fi
  done
done
if [ $EXIT -eq 0 ]; then
  echo "OK: No cross-blade imports found"
fi
exit $EXIT
