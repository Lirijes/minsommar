-- Subcategories for activities, family favorites, and the summer bucket list.

-- 1. New columns on activities
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN NOT NULL DEFAULT false;

-- 2. Bucket list (per child)
CREATE TABLE IF NOT EXISTS public.bucket_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🏖️',
  done BOOLEAN NOT NULL DEFAULT false,
  done_at TIMESTAMPTZ,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bucket_items TO anon, authenticated;
GRANT ALL ON public.bucket_items TO service_role;
ALTER TABLE public.bucket_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "open bucket_items" ON public.bucket_items;
CREATE POLICY "open bucket_items" ON public.bucket_items FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS bucket_items_child_idx ON public.bucket_items(child_id);

-- 3. Reseed the "Kreativitet & Lärande" category into subcategories.
--    Remove existing activities in this category, then insert the new structured set.
DELETE FROM public.activities
WHERE category_id = (SELECT id FROM public.categories WHERE slug = 'kreativitet');

WITH c AS (SELECT id FROM public.categories WHERE slug = 'kreativitet')
INSERT INTO public.activities (category_id, subcategory, name, emoji, sort_order)
SELECT c.id, a.subcategory, a.name, a.emoji, a.sort_order FROM c, (VALUES
  -- 🎨 Kreativitet
  ('kreativitet', 'Diamantmålning', '💎', 1),
  ('kreativitet', 'Måla med vattenfärger', '🎨', 2),
  ('kreativitet', 'Måla stenar', '🪨', 3),
  ('kreativitet', 'Rita ett djur', '🐾', 4),
  ('kreativitet', 'Rita ett självporträtt', '🙂', 5),
  ('kreativitet', 'Rita av ett foto', '📷', 6),
  ('kreativitet', 'Rita en fantasivärld', '🌈', 7),
  ('kreativitet', 'Färglägga mandalas', '🌀', 8),
  ('kreativitet', 'Pärlplatta', '🟧', 9),
  ('kreativitet', 'Vänskapsarmband', '🧶', 10),
  ('kreativitet', 'Göra något av kartong', '📦', 11),
  ('kreativitet', 'Sy en liten kudde', '🧵', 12),
  ('kreativitet', 'Brodera korsstygn', '🪡', 13),
  ('kreativitet', 'Skapa en egen affisch', '🖼️', 14),
  -- 📚 Läsning & skrivande
  ('lasning', 'Läsa 5 sidor', '📖', 1),
  ('lasning', 'Läsa 10 sidor', '📖', 2),
  ('lasning', 'Läsa 20 sidor', '📚', 3),
  ('lasning', 'Läsa ett kapitel', '📕', 4),
  ('lasning', 'Läsa högt för någon', '🗣️', 5),
  ('lasning', 'Skriva dagbok 1 sida', '📔', 6),
  ('lasning', 'Skriva dagbok 2 sidor', '📔', 7),
  ('lasning', 'Skriva en berättelse', '📝', 8),
  ('lasning', 'Skriva en dikt', '✍️', 9),
  ('lasning', 'Skriva ett brev', '✉️', 10),
  ('lasning', 'Skriva om min drömresa', '✈️', 11),
  ('lasning', 'Skriva om mitt favoritdjur', '🐶', 12),
  ('lasning', 'Göra en egen tidning', '📰', 13),
  ('lasning', 'Läsa en faktatext om något intressant', '🔎', 14),
  -- 🍪 Bakning & matlagning
  ('bakning', 'Baka chokladbollar', '🍫', 1),
  ('bakning', 'Baka sockerkaka', '🍰', 2),
  ('bakning', 'Baka kladdkaksmuffins', '🧁', 3),
  ('bakning', 'Baka muffins', '🧁', 4),
  ('bakning', 'Baka cookies', '🍪', 5),
  ('bakning', 'Göra smoothie', '🥤', 6),
  ('bakning', 'Göra fruktsallad', '🍓', 7),
  ('bakning', 'Göra glasspinnar', '🍦', 8),
  ('bakning', 'Hjälpa till med middagen', '🍝', 9),
  ('bakning', 'Duka bordet', '🍽️', 10),
  -- 🧩 Pussel & hjärngympa
  ('pussel', 'Lägga pussel 50 bitar', '🧩', 1),
  ('pussel', 'Lägga pussel 100 bitar', '🧩', 2),
  ('pussel', 'Sudoku', '🔢', 3),
  ('pussel', 'Korsord', '✏️', 4),
  ('pussel', 'Labyrinter', '🌀', 5),
  ('pussel', 'Memory', '🃏', 6),
  ('pussel', 'Logikspel', '🧠', 7),
  ('pussel', 'Rubiks kub', '🟥', 8),
  ('pussel', 'Hitta skillnader-bilder', '🔍', 9),
  -- 🏗️ Bygga & skapa
  ('bygga', 'Bygga LEGO fritt 30 min', '🧱', 1),
  ('bygga', 'Bygga en koja', '🏕️', 2),
  ('bygga', 'Bygga ett korthus', '🃏', 3),
  ('bygga', 'Göra en skattkarta', '🗺️', 4),
  ('bygga', 'Bygga ett pappersflygplan', '✈️', 5),
  -- 🌳 Utomhusaktiviteter
  ('utomhus', 'Rita med gatukritor', '🖍️', 1),
  ('utomhus', 'Såpbubblor', '🫧', 2),
  ('utomhus', 'Picknick', '🧺', 3),
  ('utomhus', 'Samla fina stenar', '🪨', 4),
  ('utomhus', 'Leta efter 10 olika blommor', '🌼', 5),
  ('utomhus', 'Hitta en fjäril', '🦋', 6),
  ('utomhus', 'Fotografera 10 fina saker ute', '📸', 7),
  ('utomhus', 'Besöka en lekplats', '🛝', 8),
  ('utomhus', 'Vattenkrig', '💦', 9),
  ('utomhus', 'Spela kubb', '🪵', 10),
  ('utomhus', 'Samla pinnar och kottar', '🌰', 11),
  -- ⭐ Sommarutmaningar
  ('sommarutmaningar', 'Plantera solrosor', '🌻', 1),
  ('sommarutmaningar', 'Vattna egna plantor', '🪴', 2),
  ('sommarutmaningar', 'Lära sig vissla', '😗', 3),
  ('sommarutmaningar', 'Lära sig jonglera', '🤹', 4),
  ('sommarutmaningar', 'Lära sig ett korttrick', '🃏', 5),
  ('sommarutmaningar', 'Lära sig knyta knopar', '🪢', 6),
  ('sommarutmaningar', 'Lära sig 10 ord på ett nytt språk', '🗯️', 7),
  ('sommarutmaningar', 'Lära sig en dans', '💃', 8),
  -- 👭 Socialt
  ('socialt', 'Ring en kompis', '📞', 1),
  ('socialt', 'Gå ut med en kompis', '🚶', 2),
  ('socialt', 'Bjuda hem en kompis', '🏡', 3),
  ('socialt', 'Spela kortspel', '🃏', 4),
  ('socialt', 'Spela brädspel', '🎲', 5),
  ('socialt', 'Göra picknick med kompis', '🧺', 6),
  ('socialt', 'Göra ett pyssel tillsammans', '✂️', 7),
  ('socialt', 'Läsa tillsammans med någon', '📖', 8),
  ('socialt', 'Hitta på en lek tillsammans', '🎈', 9)
) AS a(subcategory, name, emoji, sort_order);
