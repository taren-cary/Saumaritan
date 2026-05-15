/*
  # User Sheets Configuration

  1. New Tables
    - `user_sheets`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `sheet_id` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on `user_sheets` table
    - Add policies for users to read their own sheet configuration
*/

CREATE TABLE IF NOT EXISTS user_sheets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  sheet_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_sheets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sheet config"
  ON user_sheets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own sheet config"
  ON user_sheets
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);