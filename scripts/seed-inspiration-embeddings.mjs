// One-off (demo) seed: build deterministic 256-d embeddings for the existing
// image_tags rows using the SAME builder the tag-image function uses, so the
// match-inspiration flow can be proven end-to-end (the sandbox couldn't run
// live Vision, so these rows were tagged but left embedding = NULL).
//
//   node scripts/seed-inspiration-embeddings.mjs        # prints ONE seed SQL
//
// Emits a single UPDATE that expands SPARSE (index,value) pairs into the
// 256-vector in SQL, so the payload stays tiny and dimension-safe. Uses
// buildImageVector from the shared tagging module (self-contained — Node
// type-strips it directly), so stored vectors match query vectors byte-for-byte.
import { buildImageVector } from "../supabase/functions/_shared/image-tagging.ts";

/** subject_type, subject_id, styles[[slug,conf]], color_type, size_estimate */
const ROWS = [
  ["post", "f11d0000-0000-4000-8000-000000000007", [["blackwork", 0.9], ["fine-line", 0.9]], "black_grey", "medium"],
  ["post", "f11d0000-0000-4000-8000-000000000008", [["dotwork", 0.9], ["ornamental", 0.9]], "black_grey", "medium"],
  ["post", "f11d0000-0000-4000-8000-000000000001", [["blackwork", 0.9]], "black_grey", "medium"],
  ["post", "f11d0000-0000-4000-8000-000000000002", [["fine-line", 0.9], ["floral-botanical", 0.9]], "black_grey", "medium"],
  ["post", "f11d0000-0000-4000-8000-000000000003", [["dotwork", 0.9]], "black_grey", "medium"],
  ["post", "f11d0000-0000-4000-8000-000000000004", [["blackwork", 0.9], ["ornamental", 0.9]], "black_grey", "medium"],
  ["post", "f11d0000-0000-4000-8000-000000000005", [["blackwork", 0.9], ["floral-botanical", 0.9]], "black_grey", "medium"],
  ["post", "f11d0000-0000-4000-8000-000000000006", [["fine-line", 0.9], ["floral-botanical", 0.9]], "black_grey", "medium"],
  ["post", "0f4f7079-e165-41f4-8185-8ba0a900fcad", [["neo-traditional", 0.9]], "black_grey", "medium"],
  ["post", "2fe4b6c3-2b4c-491b-aac9-a1baf59cdfa6", [["floral-botanical", 0.9], ["illustrative", 0.9]], "black_grey", "medium"],
  ["post", "f22d0000-0000-4000-8000-000000000001", [["neo-traditional", 0.9]], "black_grey", "medium"],
  ["post", "f22d0000-0000-4000-8000-000000000002", [["illustrative", 0.9], ["watercolor", 0.9]], "black_grey", "medium"],
  ["post", "f22d0000-0000-4000-8000-000000000003", [["japanese-irezumi", 0.9]], "black_grey", "medium"],
  ["post", "f22d0000-0000-4000-8000-000000000004", [["illustrative", 0.9], ["new-school", 0.9]], "black_grey", "medium"],
  ["post", "f22d0000-0000-4000-8000-000000000005", [["floral-botanical", 0.9], ["watercolor", 0.9]], "black_grey", "medium"],
  ["flash_item", "f11d5170-0000-4000-8000-000000000001", [["blackwork", 0.92], ["ornamental", 0.8]], "black_grey", "small"],
  ["flash_item", "f11d5170-0000-4000-8000-000000000002", [["fine-line", 0.9], ["floral-botanical", 0.7]], "black_grey", "small"],
  ["flash_item", "f11d5170-0000-4000-8000-000000000004", [["ornamental", 0.9], ["blackwork", 0.75]], "black_grey", "medium"],
  ["flash_item", "f83746e2-5b40-43d9-b933-bbda4ae68c84", [["floral-botanical", 0.88]], "color", "small"],
  ["flash_item", "8417caba-f6f9-4e36-9b5c-b3e29750e851", [["floral-botanical", 0.9], ["fine-line", 0.6]], "color", "small"],
  ["flash_item", "50d295cc-ddc8-432b-afb6-38044fc0d889", [["american-traditional", 0.9], ["blackwork", 0.7]], "color", "medium"],
  ["flash_item", "aba4859f-e64d-4d13-bf71-7be8d80fb5e4", [["japanese-irezumi", 0.93]], "color", "large"],
];

function sparse(styles, color, size) {
  const v = buildImageVector({
    styles: styles.map(([slug, confidence]) => ({ slug, confidence })),
    placement: [],
    color_type: color,
    size_estimate: size,
    subject_matter: [],
    description: "",
  });
  const pairs = [];
  v.forEach((x, i) => {
    if (x !== 0) pairs.push({ i, v: +x.toFixed(5) });
  });
  return pairs;
}

const values = ROWS.map(([type, id, styles, color, size]) => {
  const json = JSON.stringify(sparse(styles, color, size)).replace(/'/g, "''");
  return `('${type}'::image_subject_type, '${id}'::uuid, '${json}'::jsonb)`;
}).join(",\n  ");

const sql = `with seed(t, id, pairs) as (values
  ${values}
)
update image_tags it
set embedding = (
  select array(
    select coalesce((select r.v from jsonb_to_recordset(seed.pairs) as r(i int, v real) where r.i = g), 0)::real
    from generate_series(0, 255) as g
  )::vector(256)
),
model_version = 'inkd-tagfp-v1-seed'
from seed
where it.subject_type = seed.t and it.subject_id = seed.id;`;

console.log(sql);
