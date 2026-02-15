ALTER TABLE debate_turns ADD COLUMN turn_type TEXT DEFAULT 'rebuttal'
  CHECK (turn_type IN ('intro', 'rebuttal', 'conclusion'));
