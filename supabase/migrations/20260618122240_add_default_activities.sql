-- Add new default Rörelse/Hemmafix activities.
--
-- Default activities live as template rows (family_id IS NULL) plus a private
-- cloned copy per family. To satisfy "existing families also get them" without
-- duplicates, this inserts the new rows into EVERY catalog scope at once — the
-- template AND each family's category — guarded by NOT EXISTS on (category, name).
--
-- New families need no extra step: clone_catalog_for_family() copies the updated
-- template. The list is de-duplicated (the source had it twice) and uses
-- sort_order 100+ so the rows append after the existing ones (1-9) in a stable
-- order instead of all colliding at 0. subcategory is NULL (these are flat
-- categories). Idempotent: safe to re-run, never creates duplicates. RLS and
-- clone_catalog_for_family are untouched.

WITH new_acts(slug, emoji, name, ord) AS (
  VALUES
    -- Rörelse
    ('rorelse', '🚶‍♀️', 'Gå ut 60 min', 101),
    ('rorelse', '🚴', 'Cykla 30 min', 102),
    ('rorelse', '🚴‍♀️', 'Cykla 60 min', 103),
    ('rorelse', '🪢', 'Hoppa hopprep 10 min', 104),
    ('rorelse', '🪢', 'Hoppa hopprep 20 min', 105),
    ('rorelse', '🏀', 'Spela basket', 106),
    ('rorelse', '👯', 'Promenera med kompis', 107),
    ('rorelse', '💃', 'Dansa till 3 låtar', 108),
    ('rorelse', '💃', 'Dansa till 5 låtar', 109),
    ('rorelse', '🧘', 'Yoga på YouTube 15 min', 110),
    ('rorelse', '🧘‍♀️', 'Yoga på YouTube 30 min', 111),
    ('rorelse', '🤸', 'Barnträning på YouTube 15 min', 112),
    ('rorelse', '🤸‍♀️', 'Barnträning på YouTube 30 min', 113),
    ('rorelse', '🧎', 'Stretching 10 min', 114),
    ('rorelse', '🏃', 'Hinderbana hemma', 115),
    ('rorelse', '🏃‍♀️', 'Hinderbana ute', 116),
    ('rorelse', '💦', 'Vattenlek ute', 117),
    ('rorelse', '🛴', 'Sparkcykel', 118),
    ('rorelse', '🥏', 'Kasta frisbee', 119),
    ('rorelse', '🎈', 'Ballongvolleyboll', 120),
    ('rorelse', '⚖️', 'Träna balans', 121),
    ('rorelse', '🕺', 'Just Dance-video', 122),
    ('rorelse', '🦘', 'Hoppa studsmatta', 123),
    -- Hemmafix
    ('hemmafix', '👕', 'Vika tvätt 10 min', 101),
    ('hemmafix', '🧦', 'Sortera strumpor', 102),
    ('hemmafix', '🧽', 'Torka av köksbordet', 103),
    ('hemmafix', '🍳', 'Hjälpa till att laga middag', 104),
    ('hemmafix', '🗑️', 'Tömma papperskorgar', 105),
    ('hemmafix', '🧹', 'Dammsuga rummet', 106),
    ('hemmafix', '📦', 'Rensa en låda eller hylla', 107),
    ('hemmafix', '🚿', 'Torka av badrumshandfat', 108),
    ('hemmafix', '🧺', 'Plocka upp saker från golvet', 109),
    ('hemmafix', '📚', 'Organisera skrivbordet', 110),
    ('hemmafix', '🛒', 'Hjälpa till att packa upp matvaror', 111)
)
INSERT INTO public.activities (family_id, category_id, name, emoji, sort_order, subcategory, is_favorite)
SELECT c.family_id, c.id, na.name, na.emoji, na.ord, NULL, false
FROM public.categories c
JOIN new_acts na ON na.slug = c.slug
WHERE c.slug IN ('rorelse', 'hemmafix')
  AND NOT EXISTS (
    SELECT 1 FROM public.activities a
    WHERE a.category_id = c.id AND a.name = na.name
  );
