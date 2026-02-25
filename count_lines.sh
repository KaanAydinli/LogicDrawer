#!/bin/bash
# Count LogicDrawer core lines (excluding node_modules/, dist/, venv/, coverage/)
cd "$(dirname "$0")" || exit 1

echo "LogicDrawer line count"
echo "======================"
echo ""

echo "By extension:"
for ext in ts py html css; do
  count=$(find . -type f -name "*.$ext" \
    ! -path "*/node_modules/*" \
    ! -path "*/dist/*" \
    ! -path "*/venv/*" \
    ! -path "*/coverage/*" \
    ! -path "*/.git/*" \
    -exec cat {} + 2>/dev/null | wc -l)
  printf "  .%-15s %5s lines\n" "$ext" "$count"
done

echo ""
echo "By main directories:"
for dir in src server logic public; do
  if [ -d "$dir" ]; then
    count=$(find "$dir" -type f \( -name "*.ts" -o -name "*.py" -o -name "*.html" -o -name "*.css" \) \
      ! -path "*/node_modules/*" \
      ! -path "*/dist/*" \
      ! -path "*/venv/*" \
      ! -path "*/coverage/*" \
      -exec cat {} + 2>/dev/null | wc -l)
    printf "  %-16s %5s lines\n" "$dir/" "$count"
  fi
done

# Root files
root=$(find . -maxdepth 1 -type f \( -name "*.ts" -o -name "*.py" -o -name "*.html" -o -name "*.css" \) -exec cat {} + 2>/dev/null | wc -l)
if [ "$root" -gt 0 ]; then
  printf "  %-16s %5s lines\n" "(root)" "$root"
fi

echo ""
total=$(find . -type f \( -name "*.ts" -o -name "*.py" -o -name "*.html" -o -name "*.css" \) \
  ! -path "*/node_modules/*" \
  ! -path "*/dist/*" \
  ! -path "*/venv/*" \
  ! -path "*/coverage/*" \
  ! -path "*/.git/*" \
  -exec cat {} + 2>/dev/null | wc -l)
  
echo "  Core total:     $total lines"
echo ""
echo "  (excludes: node_modules/, dist/, venv/, coverage/, .git/)"
