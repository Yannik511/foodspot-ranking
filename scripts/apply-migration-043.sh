#!/bin/bash

# Script to apply migration 043 - Fix for shared list description editing
# This fixes the error: "null value in column 'score' of relation 'foodspot_ratings'"

set -e  # Exit on error

echo "🔧 Applying Migration 043: Fix merge_foodspot NULL score handling"
echo ""

# Check if migration file exists
if [ ! -f "migrations/043_fix_merge_foodspot_null_score.sql" ]; then
  echo "❌ Error: Migration file not found!"
  echo "   Expected: migrations/043_fix_merge_foodspot_null_score.sql"
  exit 1
fi

# Check if we have database connection info
if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_DB_URL" ]; then
  echo "⚠️  No database URL found in environment variables."
  echo ""
  echo "Please set either:"
  echo "  export DATABASE_URL='your-postgres-connection-string'"
  echo "  export SUPABASE_DB_URL='your-supabase-db-url'"
  echo ""
  echo "Or apply the migration manually via Supabase SQL Editor:"
  echo "  1. Open https://supabase.com/dashboard"
  echo "  2. Go to SQL Editor"
  echo "  3. Copy & paste the content of migrations/043_fix_merge_foodspot_null_score.sql"
  echo "  4. Run the query"
  echo ""
  exit 1
fi

# Use DATABASE_URL or SUPABASE_DB_URL
DB_URL="${DATABASE_URL:-$SUPABASE_DB_URL}"

echo "📡 Connecting to database..."
echo ""

# Apply migration using psql
if command -v psql &> /dev/null; then
  echo "✅ Running migration with psql..."
  psql "$DB_URL" -f migrations/043_fix_merge_foodspot_null_score.sql
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration 043 applied successfully!"
    echo ""
    echo "🎉 You can now edit shared list descriptions without errors."
  else
    echo ""
    echo "❌ Migration failed. Please check the error above."
    exit 1
  fi
else
  echo "❌ psql not found. Please install PostgreSQL client or use Supabase SQL Editor."
  echo ""
  echo "Install on macOS: brew install postgresql"
  echo "Install on Ubuntu: sudo apt-get install postgresql-client"
  exit 1
fi

