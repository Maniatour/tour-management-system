-- Drop existing off_schedules and off_requests tables
DROP TABLE IF EXISTS off_requests CASCADE;
DROP TABLE IF EXISTS off_schedules CASCADE;

-- Create unified off_schedules table for storing off requests and approved off days
CREATE TABLE IF NOT EXISTS off_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_email VARCHAR(255) NOT NULL REFERENCES team(email) ON DELETE CASCADE,
    off_date DATE NOT NULL,
    reason TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    approved_by VARCHAR(255) REFERENCES team(email),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_off_schedules_team_email ON off_schedules(team_email);
CREATE INDEX IF NOT EXISTS idx_off_schedules_date ON off_schedules(off_date);
CREATE INDEX IF NOT EXISTS idx_off_schedules_status ON off_schedules(status);
CREATE INDEX IF NOT EXISTS idx_off_schedules_team_date ON off_schedules(team_email, off_date);

-- Enable RLS
ALTER TABLE off_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies for off_schedules
CREATE POLICY "Users can view their own off schedules" ON off_schedules
    FOR SELECT USING (
        team_email = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email')
    );

CREATE POLICY "Admins can view all off schedules" ON off_schedules
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own off schedules" ON off_schedules
    FOR INSERT WITH CHECK (
        team_email = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email')
    );

CREATE POLICY "Admins can insert off schedules" ON off_schedules
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own pending off schedules" ON off_schedules
    FOR UPDATE USING (
        team_email = (SELECT email FROM team WHERE email = auth.jwt() ->> 'email') 
        AND status = 'pending'
    );

CREATE POLICY "Admins can update all off schedules" ON off_schedules
    FOR UPDATE USING (true);

CREATE POLICY "Admins can delete off schedules" ON off_schedules
    FOR DELETE USING (true);

-- Create function to automatically update approved_at when status changes
CREATE OR REPLACE FUNCTION handle_off_schedule_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- If status changed to approved or rejected, update approved_at
    IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
        NEW.approved_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for off_schedule status changes
CREATE TRIGGER trigger_handle_off_schedule_status_change
    BEFORE UPDATE ON off_schedules
    FOR EACH ROW
    EXECUTE FUNCTION handle_off_schedule_status_change();
