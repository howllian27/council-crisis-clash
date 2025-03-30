-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_incentives ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access to games" ON games;
DROP POLICY IF EXISTS "Allow public read access to players" ON players;
DROP POLICY IF EXISTS "Allow public read access to votes" ON votes;
DROP POLICY IF EXISTS "Allow public read access to resources" ON resources;
DROP POLICY IF EXISTS "Allow public read access to secret_incentives" ON secret_incentives;

-- Create policies for games table
CREATE POLICY "Allow public read access to games"
    ON games FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access to games"
    ON games FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update access to games"
    ON games FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete access to games"
    ON games FOR DELETE
    USING (true);

-- Create policies for players table
CREATE POLICY "Allow public read access to players"
    ON players FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access to players"
    ON players FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update access to players"
    ON players FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete access to players"
    ON players FOR DELETE
    USING (true);

-- Create policies for votes table
CREATE POLICY "Allow public read access to votes"
    ON votes FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access to votes"
    ON votes FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update access to votes"
    ON votes FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete access to votes"
    ON votes FOR DELETE
    USING (true);

-- Create policies for resources table
CREATE POLICY "Allow public read access to resources"
    ON resources FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access to resources"
    ON resources FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update access to resources"
    ON resources FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete access to resources"
    ON resources FOR DELETE
    USING (true);

-- Create policies for secret_incentives table
CREATE POLICY "Allow public read access to secret_incentives"
    ON secret_incentives FOR SELECT
    USING (true);

CREATE POLICY "Allow public insert access to secret_incentives"
    ON secret_incentives FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Allow public update access to secret_incentives"
    ON secret_incentives FOR UPDATE
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Allow public delete access to secret_incentives"
    ON secret_incentives FOR DELETE
    USING (true); 