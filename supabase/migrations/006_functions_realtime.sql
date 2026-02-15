-- Migration 006: Realtime configuration

-- Enable Realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE debate_turns;
ALTER PUBLICATION supabase_realtime ADD TABLE lie_alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE fact_checks;
ALTER PUBLICATION supabase_realtime ADD TABLE debates;
ALTER PUBLICATION supabase_realtime ADD TABLE debate_votes;
