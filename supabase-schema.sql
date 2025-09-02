-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT auth.uid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  handle TEXT UNIQUE,
  profile_img TEXT,
  styles TEXT[],
  locations TEXT[],
  bio TEXT,
  links JSONB,
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  is_artist BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  description TEXT,
  location TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portfolio table
CREATE TABLE IF NOT EXISTS portfolio (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  category TEXT NOT NULL, -- 'tattoo', 'flash', 'design'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  date_time TIMESTAMPTZ NOT NULL,
  status TEXT DEFAULT 'requested' -- 'requested', 'confirmed', 'cancelled', 'completed'
);

-- Comments table (optional for MVP)
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily highlights table
CREATE TABLE IF NOT EXISTS daily_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  artwork_post_id UUID REFERENCES posts(id),
  artist_user_id UUID REFERENCES users(id),
  suggestions JSONB, -- Array of post IDs
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Assistant events table
CREATE TABLE IF NOT EXISTS assistant_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'inquiry_triage', 'booking_assist', 'daily_summary'
  payload JSONB,
  status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'completed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assistant settings table
CREATE TABLE IF NOT EXISTS assistant_settings (
  artist_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT TRUE,
  preferences JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assistant reports table
CREATE TABLE IF NOT EXISTS assistant_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  artist_id UUID REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  region TEXT,
  time_start DATE,
  time_end DATE,
  methodology TEXT,
  summary TEXT,
  sources JSONB,
  confidence TEXT, -- 'low', 'medium', 'high'
  status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_user_id ON portfolio(user_id);
CREATE INDEX IF NOT EXISTS idx_portfolio_category ON portfolio(category);
CREATE INDEX IF NOT EXISTS idx_portfolio_created_at ON portfolio(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_handle ON users(handle);
CREATE INDEX IF NOT EXISTS idx_users_location ON users(lat, lng);
CREATE INDEX IF NOT EXISTS idx_users_is_artist ON users(is_artist);
CREATE INDEX IF NOT EXISTS idx_daily_highlights_date ON daily_highlights(date);
CREATE INDEX IF NOT EXISTS idx_assistant_events_artist_id ON assistant_events(artist_id);
CREATE INDEX IF NOT EXISTS idx_assistant_events_created_at ON assistant_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_assistant_reports_artist_id ON assistant_reports(artist_id);
CREATE INDEX IF NOT EXISTS idx_assistant_reports_created_at ON assistant_reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp DESC);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_reports ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all profiles" ON users FOR SELECT USING (TRUE);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT WITH CHECK (auth.uid() = id);

-- Posts policies
CREATE POLICY "Posts are viewable by everyone" ON posts FOR SELECT USING (TRUE);
CREATE POLICY "Users can insert own posts" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posts" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posts" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Portfolio policies
CREATE POLICY "Portfolio is viewable by everyone" ON portfolio FOR SELECT USING (TRUE);
CREATE POLICY "Users can insert own portfolio items" ON portfolio FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own portfolio items" ON portfolio FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own portfolio items" ON portfolio FOR DELETE USING (auth.uid() = user_id);

-- Messages policies
CREATE POLICY "Users can view messages they sent or received" ON messages 
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "Users can insert messages they send" ON messages 
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Appointments policies
CREATE POLICY "Users can view their appointments" ON appointments 
  FOR SELECT USING (auth.uid() = artist_id OR auth.uid() = user_id);
CREATE POLICY "Users can insert appointments" ON appointments 
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() = artist_id);
CREATE POLICY "Artists can update appointments" ON appointments 
  FOR UPDATE USING (auth.uid() = artist_id);

-- Comments policies
CREATE POLICY "Comments are viewable by everyone" ON comments FOR SELECT USING (TRUE);
CREATE POLICY "Users can insert own comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Daily highlights policies (read-only for users, service role can write)
CREATE POLICY "Daily highlights are viewable by everyone" ON daily_highlights FOR SELECT USING (TRUE);

-- Assistant events policies
CREATE POLICY "Artists can view their assistant events" ON assistant_events 
  FOR SELECT USING (auth.uid() = artist_id);

-- Assistant settings policies
CREATE POLICY "Artists can view and update their settings" ON assistant_settings 
  FOR ALL USING (auth.uid() = artist_id);

-- Assistant reports policies
CREATE POLICY "Artists can view their reports" ON assistant_reports 
  FOR SELECT USING (auth.uid() = artist_id);

-- Storage buckets and policies
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('profile-images', 'profile-images', true),
  ('posts', 'posts', true),
  ('portfolio', 'portfolio', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id IN ('profile-images', 'posts', 'portfolio'));
CREATE POLICY "Users can upload profile images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload posts" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload portfolio items" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'portfolio' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own files" ON storage.objects FOR UPDATE USING (auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own files" ON storage.objects FOR DELETE USING (auth.uid()::text = (storage.foldername(name))[1]);