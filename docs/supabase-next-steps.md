# Supabase setup

This app is moving from local JSON storage to Supabase.

## Project choice

Create or select a Supabase project for the app, then apply the migrations in `supabase/migrations/`.

Do not commit project secrets. Keep `SUPABASE_SERVICE_ROLE_KEY` only in local/server environment variables.

## What is ready locally

- Initial database migration:
  - `supabase/migrations/202605050001_rebus_platform_schema.sql`
- Environment template:
  - `.env.example`

Applied Supabase migrations are tracked in your Supabase project history after you run them.

## Recommended Supabase Auth setup

Use Supabase Auth as the app's shared Google login.

Teachers/admins authenticate with Google. The app creates a `profiles` row from `auth.users`, then teachers create or join `organizations`.

Do not ask every teacher to configure their own Google OAuth Client ID. Keep OAuth at the app level.

## Recommended Maps setup

Google Maps keys should belong to an `organization`/project, not an individual admin user.

The key is stored in `project_settings.google_maps_api_key` and is shared by all rebuses in that organization. The key must be restricted in Google Cloud by HTTP referrer and API scope.

## Tables

- `profiles`
- `organizations`
- `organization_members`
- `project_settings`
- `rebuses`
- `tasks`
- `students`
- `participant_sessions`
- `progress`
- `locations`
- `submissions`

## Storage

The migration creates a private `submissions` bucket for image/video uploads.

The app should eventually use signed URLs for teachers/admins viewing submitted media.
