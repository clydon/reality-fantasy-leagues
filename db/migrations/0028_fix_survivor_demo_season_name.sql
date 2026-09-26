-- Corrects a mislabeling from 0025/0026: the Survivor demo season's cast (Jenna Lewis-Dougherty, Q
-- Burdette, Kamilla Karthigesu, Genevieve Mushaluk, Rizo Velovic, and returning legends like Ozzy,
-- Cirie, Aubry, Colby, Coach, Stephenie, Christian, Chrissy) is Survivor 50: In the Hands of the
-- Fans, not Survivor 40: Winners at War (a copy/paste label error when this row was first written --
-- the cast/boot-order data itself, carried over unchanged from this app's own pre-existing
-- mock-state.ts, was never wrong). Fixes both the id (also embedded in `data`, which
-- demo-season-builder.ts reads) and the display name/seasonName.
UPDATE demo_seasons
   SET id = 'survivor-hands-of-the-fans',
       name = 'Survivor 50: In the Hands of the Fans',
       data = jsonb_set(
                jsonb_set(data, '{id}', '"survivor-hands-of-the-fans"'),
                '{seasonName}', '"Survivor 50: In the Hands of the Fans"'
              )
 WHERE id = 'survivor-winners-at-war';
