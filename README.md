# INKD Web Application

A comprehensive web platform for tattoo enthusiasts and artists featuring social feeds, local artist discovery, portfolio management, and AI-powered assistance.

## Features

- **Social Feed**: Browse and share tattoo posts with responsive grid layout
- **Local Discovery**: Find nearby artists with interactive map and card interface
- **Artist Profiles**: Comprehensive profiles with Info, Posts, and Portfolio tabs
- **AI Assistant**: Booking assistance, inquiry triage, and market research
- **Daily Highlights**: Curated content to drive user engagement
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices

## Tech Stack

- **Frontend**: Next.js 15 with TypeScript, Tailwind CSS v4
- **State Management**: Zustand
- **Backend**: Supabase (Auth, Database, Storage)
- **Maps**: Mapbox GL JS / React Map GL
- **UI Components**: Headless UI, Heroicons

## Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Variables:**
   Create a `.env.local` file with:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://rzubqnqqvjkwnavmzcgz.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_access_token
   ```

3. **Database Setup:**
   - Run the SQL in `supabase-schema.sql` in your Supabase SQL editor
   - This creates all necessary tables, indexes, and RLS policies

4. **Development:**
   ```bash
   npm run dev
   ```

## Database Schema

The application uses the following main tables:
- `users` - User profiles and artist information
- `posts` - Social feed posts with images and metadata
- `portfolio` - Artist portfolio items categorized by type
- `messages` - Direct messaging between users
- `appointments` - Booking requests and confirmations
- `daily_highlights` - Curated daily content
- `assistant_*` - AI assistant events, settings, and reports

## Development

- `npm run dev` - Start development server with Turbopack
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Deployment

The application is ready for deployment on Vercel, Netlify, or any other Next.js-compatible platform.

### Environment Setup
Ensure all environment variables are configured in your deployment platform.

### Database Migrations
Run the SQL schema in your Supabase project before deploying.
