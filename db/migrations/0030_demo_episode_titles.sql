-- Real episode titles for the three demo seasons, so an episode's header can name the episode rather
-- than who left in it. Read off each show's wiki (Survivor: Template:S50epguide's {{Ep|50xx}} codes,
-- expanded; The Challenge: Template:SLA EpGuide; The Traitors: "The Traitors (US)/Season 4"'s
-- Episode Titles table). Index 0 is episode 1; a demo episode past the list just shows its number.
UPDATE demo_seasons SET data = jsonb_set(data, '{episodeTitles}', '[
  "Epic Party", "Therapy Carousel", "Did You Vote For a Swap?", "Knife to the Heart", "Open Wounds",
  "The Blood Moon", "That''s Not How I Play Survivor", "Double the Fun, Double the Demise",
  "I Deserve All of This", "A Side Dish of Chaos", "Everyone Will Be Shooketh!", "Inconceivable",
  "Reverse the Curse"
]'::jsonb) WHERE id = 'survivor-hands-of-the-fans';

UPDATE demo_seasons SET data = jsonb_set(data, '{episodeTitles}', '[
  "The List", "Bertha", "Truce or Dare", "Messy", "Good Vibes and Gladiator", "Alien", "Uncle CT",
  "The Threat", "The War", "Precious Stones", "Mucus Plug", "500", "Titanic", "Mavericks",
  "The Cave of the Wolf", "Riverdance", "Drop Dead", "Night of Mistakes", "The Decision"
]'::jsonb) WHERE id = 'challenge-spies-lies-allies';

UPDATE demo_seasons SET data = jsonb_set(data, '{episodeTitles}', '[
  "Let the Cards Fall As They Will", "The Death Conga", "Show Me Your Faces", "Cut the Head off the Snake",
  "If You''re Gonna Come for Me, I''ll Finish You", "Planning a Coup", "The Black Banquet",
  "A Queen Never Comes Off Her Throne", "Think Outside the Box", "Do You Know the Enemy?", "Leap of Faith"
]'::jsonb) WHERE id = 'traitors-season-4';
