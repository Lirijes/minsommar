
-- Children
CREATE TABLE public.children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL DEFAULT 'pink',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.children TO anon, authenticated;
GRANT ALL ON public.children TO service_role;
ALTER TABLE public.children ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open children" ON public.children FOR ALL USING (true) WITH CHECK (true);

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT NOT NULL DEFAULT 'sparkles',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO anon, authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open categories" ON public.categories FOR ALL USING (true) WITH CHECK (true);

-- Activities
CREATE TABLE public.activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '✨',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.activities TO anon, authenticated;
GRANT ALL ON public.activities TO service_role;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open activities" ON public.activities FOR ALL USING (true) WITH CHECK (true);

-- Completions
CREATE TABLE public.completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_date DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Europe/Stockholm')::date
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.completions TO anon, authenticated;
GRANT ALL ON public.completions TO service_role;
ALTER TABLE public.completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open completions" ON public.completions FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX completions_child_date_idx ON public.completions(child_id, completed_date);

-- Seed children
INSERT INTO public.children (name, color) VALUES ('Lea', 'pink'), ('Nora', 'purple');

-- Seed categories
INSERT INTO public.categories (name, slug, icon, sort_order) VALUES
  ('Rörelse', 'rorelse', 'activity', 1),
  ('Hemmafix', 'hemmafix', 'home', 2),
  ('Kreativitet & Lärande', 'kreativitet', 'palette', 3);

-- Seed activities
WITH c AS (SELECT id, slug FROM public.categories)
INSERT INTO public.activities (category_id, name, emoji, sort_order)
SELECT c.id, a.name, a.emoji, a.sort_order FROM c JOIN (VALUES
  ('rorelse', 'Gå ut 30 minuter', '🚶‍♀️', 1),
  ('rorelse', 'Cykla', '🚴‍♀️', 2),
  ('rorelse', 'Hoppa hopprep', '🪢', 3),
  ('rorelse', 'Dansa', '💃', 4),
  ('rorelse', 'Yoga', '🧘‍♀️', 5),
  ('rorelse', 'Fotboll', '⚽', 6),
  ('rorelse', 'Naturpromenad', '🌳', 7),
  ('rorelse', 'Lekplats', '🛝', 8),
  ('rorelse', 'Vattenlek', '💦', 9),
  ('hemmafix', 'Fylla diskmaskinen', '🍽️', 1),
  ('hemmafix', 'Tömma diskmaskinen', '🧽', 2),
  ('hemmafix', 'Vika tvätt', '👕', 3),
  ('hemmafix', 'Bädda sängen', '🛏️', 4),
  ('hemmafix', 'Vattna blommor', '🌸', 5),
  ('hemmafix', 'Plocka undan i rummet', '🧸', 6),
  ('hemmafix', 'Hjälpa till med maten', '🥗', 7),
  ('kreativitet', 'Läsa 10 sidor', '📖', 1),
  ('kreativitet', 'Skriva dagbok', '📔', 2),
  ('kreativitet', 'Rita', '✏️', 3),
  ('kreativitet', 'Måla', '🎨', 4),
  ('kreativitet', 'Diamantmålning', '💎', 5),
  ('kreativitet', 'Pärlplatta', '🟧', 6),
  ('kreativitet', 'LEGO', '🧱', 7),
  ('kreativitet', 'Pussel', '🧩', 8),
  ('kreativitet', 'Baka', '🧁', 9),
  ('kreativitet', 'Skriva berättelse', '📝', 10)
) AS a(slug, name, emoji, sort_order) ON c.slug = a.slug;
