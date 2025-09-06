-- Add team_type column to tours table
ALTER TABLE tours ADD COLUMN IF NOT EXISTS team_type TEXT DEFAULT '1guide' CHECK (team_type IN ('1guide', '2guide', 'guide+driver'));

-- Add index for team_type
CREATE INDEX IF NOT EXISTS idx_tours_team_type ON tours(team_type);

-- Update existing tours to have default team_type
UPDATE tours SET team_type = '1guide' WHERE team_type IS NULL;
