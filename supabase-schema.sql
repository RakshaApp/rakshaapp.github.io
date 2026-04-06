-- ============================================================
-- RAKSHA — SUPABASE SCHEMA + RLS POLICIES
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard → Your Project → SQL Editor → New Query
-- ============================================================


-- ──────────────────────────────────────────────────────────────
-- 1. PROFILES TABLE
--    Stores user display name and email, linked to auth.users
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  email       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can only read their own profile
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Users can insert their own profile (on signup)
CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);


-- ──────────────────────────────────────────────────────────────
-- 2. POSE_PROGRESS TABLE
--    Tracks each user's best score and completion for each pose
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pose_progress (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pose_id             TEXT NOT NULL,          -- e.g. 'guard_stance', 'jab'
  best_accuracy       NUMERIC(5,2) DEFAULT 0, -- 0-100, best recorded during attempts
  completed           BOOLEAN DEFAULT FALSE,  -- true once held for 5s above threshold
  completed_accuracy  NUMERIC(5,2),           -- accuracy during the successful 5s hold
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, pose_id)                    -- one row per user per pose
);

-- Enable Row Level Security
ALTER TABLE public.pose_progress ENABLE ROW LEVEL SECURITY;

-- Users can only read their own progress
CREATE POLICY "progress_select_own"
  ON public.pose_progress FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own progress rows
CREATE POLICY "progress_insert_own"
  ON public.pose_progress FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own progress rows (for upsert)
CREATE POLICY "progress_update_own"
  ON public.pose_progress FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own progress (if you add a reset feature)
CREATE POLICY "progress_delete_own"
  ON public.pose_progress FOR DELETE
  USING (auth.uid() = user_id);


-- ──────────────────────────────────────────────────────────────
-- 3. GRANT USAGE on public schema to authenticated role
-- ──────────────────────────────────────────────────────────────
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.profiles TO authenticated;
GRANT ALL ON public.pose_progress TO authenticated;


-- ──────────────────────────────────────────────────────────────
-- NOTE ON SUPABASE EMAIL REDIRECT URL
-- ──────────────────────────────────────────────────────────────
-- To make the verification email redirect back to your app:
--
-- 1. Go to: https://supabase.com/dashboard
-- 2. Select your project
-- 3. Go to: Authentication → URL Configuration
-- 4. Under "Site URL" set: https://yourusername.github.io/your-repo/
--    (or your custom domain if you have one)
-- 5. Under "Redirect URLs" add: https://yourusername.github.io/your-repo/
--    (This is the whitelist of allowed redirect targets)
-- 6. Save changes.
--
-- When deployed as a PWA on the home screen, clicking the
-- verification email link opens the browser at your Site URL
-- with the access_token in the URL hash. The app.js code
-- detects this hash and calls supabase.auth.getSession()
-- which Supabase auto-processes, verifying the user.
-- The localStorage session flag is then set automatically
-- by the Supabase client.
--
-- For local development, also add http://localhost:PORT/
-- to the Redirect URLs list.
-- ──────────────────────────────────────────────────────────────
