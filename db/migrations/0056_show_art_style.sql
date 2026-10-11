-- How a show's art (0051) looks behind Overview's header: how much of its color comes through, how
-- strong it is, and the crop. Set in the admin's Show settings. Null, or a key left out, means the
-- default look -- greyscale at the theme's strength, centred a little above the middle.
--
--   color     0..1      share of the art's color kept (0 = greyscale)
--   strength  0.5..3    multiplier on the theme's own strength (--art-opacity)
--   zoom      1..3      scale-up before cropping to the header
--   x, y      0..100    the point the crop is centred on, in % of the image
ALTER TABLE shows ADD COLUMN art_style JSONB;
