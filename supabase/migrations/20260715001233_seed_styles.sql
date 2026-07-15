-- Migration: seed_styles
-- Canonical tattoo-style taxonomy. Idempotent on slug.

insert into public.styles (slug, name, category, sort_order) values
  ('american-traditional', 'American Traditional', 'traditional',    10),
  ('neo-traditional',      'Neo-Traditional',      'traditional',    20),
  ('japanese-irezumi',     'Japanese / Irezumi',   'traditional',    30),
  ('tribal',               'Tribal',               'traditional',    40),
  ('chicano',              'Chicano',              'traditional',    50),
  ('fine-line',            'Fine Line',            'linework',       60),
  ('script-lettering',     'Script / Lettering',   'linework',       70),
  ('ornamental',           'Ornamental',           'linework',       80),
  ('minimalist',           'Minimalist',           'linework',       90),
  ('realism',              'Realism',              'realism',       100),
  ('black-and-grey',       'Black & Grey',         'realism',       110),
  ('portrait',             'Portrait',             'realism',       120),
  ('micro-realism',        'Micro-Realism',        'realism',       130),
  ('blackwork',            'Blackwork',            'black',         140),
  ('dotwork',              'Dotwork',              'black',         150),
  ('geometric',            'Geometric',            'black',         160),
  ('new-school',           'New School',           'illustrative',  170),
  ('illustrative',         'Illustrative',         'illustrative',  180),
  ('watercolor',           'Watercolor',           'illustrative',  190),
  ('sticker-ignorant',     'Sticker / Ignorant',   'illustrative',  200),
  ('anime',                'Anime',                'illustrative',  210),
  ('floral-botanical',     'Floral / Botanical',   'illustrative',  220),
  ('surrealism',           'Surrealism',           'illustrative',  230),
  ('trash-polka',          'Trash Polka',          'contemporary',  240),
  ('biomechanical',        'Biomechanical',        'contemporary',  250)
on conflict (lower(slug)) do nothing;
