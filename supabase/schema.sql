-- Create games table
CREATE TABLE games (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    host_id TEXT NOT NULL,
    current_round INTEGER DEFAULT 1,
    max_rounds INTEGER DEFAULT 10,
    is_active BOOLEAN DEFAULT true,
    current_scenario JSONB,
    phase TEXT DEFAULT 'lobby',
    elimination_target TEXT,
    round_start_time TIMESTAMP WITH TIME ZONE,
    round_end_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create players table
CREATE TABLE players (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES games(session_id),
    player_id TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    secret_incentive TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    vote_weight FLOAT DEFAULT 1.0,
    has_voted BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, player_id)
);

-- Create votes table
CREATE TABLE votes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES games(session_id),
    player_id TEXT NOT NULL,
    round INTEGER NOT NULL,
    vote TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, player_id, round)
);

-- Create resources table
CREATE TABLE resources (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES games(session_id),
    tech INTEGER DEFAULT 100,
    manpower INTEGER DEFAULT 100,
    economy INTEGER DEFAULT 100,
    happiness INTEGER DEFAULT 100,
    trust INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id)
);

-- Create secret_incentives table
CREATE TABLE secret_incentives (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES games(session_id),
    player_id TEXT NOT NULL,
    incentive TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(session_id, player_id)
);

-- Enable Row Level Security
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE secret_incentives ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Allow public read access to games"
    ON games FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to players"
    ON players FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to votes"
    ON votes FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to resources"
    ON resources FOR SELECT
    USING (true);

CREATE POLICY "Allow public read access to secret_incentives"
    ON secret_incentives FOR SELECT
    USING (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_games_updated_at
    BEFORE UPDATE ON games
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_players_updated_at
    BEFORE UPDATE ON players
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_resources_updated_at
    BEFORE UPDATE ON resources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 