# INKD Web Application - Deployment Guide

## Prerequisites

1. **Supabase Project Setup**
   - Create a new Supabase project at https://supabase.com
   - Note your project URL and anon key
   - Run the SQL schema from `supabase-schema.sql` in the SQL editor
   - Set up Storage buckets: `profile-images`, `posts`, `portfolio`

2. **Mapbox Account**
   - Create a Mapbox account at https://mapbox.com
   - Get your access token from the dashboard

## Environment Variables

Set the following environment variables in your deployment platform:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

## Deployment Options

### Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Set environment variables in the Vercel dashboard
3. Deploy automatically on push to main branch

### Netlify

1. Connect your GitHub repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `.next`
4. Add environment variables in Netlify dashboard

### Self-hosted

1. Build the application: `npm run build`
2. Start the production server: `npm run start`
3. Ensure environment variables are set in your hosting environment

## Database Setup

After deployment, run the following SQL in your Supabase SQL editor:

```sql
-- Run the entire contents of supabase-schema.sql
```

This will create:
- All necessary tables with proper relationships
- Row Level Security (RLS) policies
- Storage buckets and policies
- Performance indexes

## Post-Deployment Checklist

- [ ] Verify Supabase connection
- [ ] Test user registration and authentication
- [ ] Upload test images to verify Storage setup
- [ ] Test map functionality with Mapbox
- [ ] Verify all routes are accessible
- [ ] Test responsive design on mobile devices

## Monitoring

- Monitor Supabase usage in the dashboard
- Check Vercel/Netlify analytics for performance
- Monitor error logs for any runtime issues

## Known Issues

- Map functionality requires a valid Mapbox token
- AI assistant features are stubs and require n8n integration
- Some TypeScript warnings are disabled for MVP speed