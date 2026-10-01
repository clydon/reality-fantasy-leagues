-- Auto-research timing as "N hours after each episode airs" (Admin > Shows & Seasons), replacing the
-- weekly weekday + time slot from 0020. Follows the real air schedule, so a double episode or a week
-- off needs nothing special. NULL = the old weekly slot (research_weekday/research_time), which
-- seasons set up before this keep using until a delay is chosen.
ALTER TABLE show_seasons ADD COLUMN research_delay_hours INTEGER CHECK (research_delay_hours BETWEEN 0 AND 336);
