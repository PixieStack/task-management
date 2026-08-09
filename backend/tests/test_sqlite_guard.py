"""SQLite is intentionally CI/test-only.

The CI workflow sets ALLOW_SQLITE_FOR_TESTS=true alongside its explicit SQLite DATABASE_URL.
Normal local/deployed startup must use Supabase Postgres and database.py fails fast otherwise.
"""
