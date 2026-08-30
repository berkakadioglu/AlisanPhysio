-- =============================================================================
-- AlisanPhysio — Canadian / North American sports-nutrition food library.
--
-- Run manually AFTER 0016_nutrition_quantities.sql. Do not run as a migration.
-- Safe/idempotent: MERGE matches the canonical English name case-insensitively,
-- updates the curated structured serving/nutrition fields, and inserts missing rows.
-- Existing staff-authored notes are preserved.
-- grams_per_unit is gram-only: liquid cup labels with an exact parenthetical
-- mL amount are stored directly as ml servings, never as a guessed gram mass.
--
-- Whole-food values are rounded representative values from Health Canada's
-- Canadian Nutrient File (CNF) / Nutrient Value of Some Common Foods and USDA
-- FoodData Central. Packaged supplement rows use representative label servings
-- from the manufacturers listed below. Brand/flavour values can vary.
--
-- Sources (accessed 2026-08-30):
--   Health Canada CNF 2026:
--   https://open.canada.ca/data/en/dataset/1b6139bd-ed7e-4043-bc28-ff00e10f3109
--   Health Canada common-food portions:
--   https://www.canada.ca/en/health-canada/services/food-nutrition/healthy-eating/nutrient-data/nutrient-value-some-common-foods-2008.html
--   USDA FoodData Central: https://fdc.nal.usda.gov/
--   Optimum Nutrition whey-isolate label:
--   https://www.optimumnutrition.com/en-gb/products/gold-standard-100-isolate-whey-protein-powder-eu
--   Myprotein Canada whey-concentrate label:
--   https://ca.myprotein.com/p/sports-nutrition/impact-whey-protein/10852500/
--   Optimum Nutrition casein/mass-gainer labels:
--   https://www.optimumnutrition.com/en-gb/products/gold-standard-100-casein-protein-powder-eu
--   https://www.optimumnutrition.com/en-gb/products/serious-mass-weight-gainer-protein-powder-eu
--   Gatorade Endurance label:
--   https://www.gatorade.com/powders/endurance-formula/orange-powder-32-oz-canister
--   Quest protein-bar label:
--   https://www.questnutrition.com/products/oatmeal-chocolate-chip-protein-bar
--   Nordic Naturals omega-3 label:
--   https://cdn.nordic.com/pro/app/uploads/2023/06/02012255/Omega-3-Product-Guide.pdf
--
-- Supplement entries are tracking references only. They contain no dosing,
-- recommendation, performance claim, or medical advice.
-- =============================================================================

merge into public.food_library as target
using (
  values
    -- Lean proteins and dairy
    ('Chicken breast', 'Tavuk göğsü', '150 g cooked', 150, 'g', null, null, 248, 46.5, 0, 5.4),
    ('Turkey breast', 'Hindi göğsü', '150 g roasted', 150, 'g', null, null, 203, 44.5, 0, 2.4),
    ('Extra-lean ground beef', 'Ekstra yağsız dana kıyma', '150 g cooked', 150, 'g', null, null, 258, 39, 0, 10),
    ('Salmon', 'Somon', '150 g cooked', 150, 'g', null, null, 309, 33, 0, 18.5),
    ('Tuna in water', 'Suda ton balığı', '120 g drained', 120, 'g', null, null, 139, 30.7, 0, 1),
    ('Atlantic cod', 'Atlantik morinası', '150 g cooked', 150, 'g', null, null, 158, 34, 0, 2),
    ('Eggs', 'Yumurta', '2 large (100 g)', 2, 'piece', 50, null, 144, 12.6, 0.7, 9.5),
    ('Egg whites', 'Yumurta akı', '200 g', 200, 'g', null, null, 104, 21.8, 1.5, 0.3),
    ('Greek yogurt', 'Sade yağsız süzme yoğurt', '200 g', 200, 'g', null, null, 118, 20.6, 7.2, 0.8),
    ('Cottage cheese', 'Az yağlı cottage peyniri', '150 g', 150, 'g', null, null, 126, 16.7, 6.5, 3.5),
    ('Skim milk', 'Yağsız süt', '1 cup (245 mL)', 245, 'ml', null, null, 83, 8.3, 12, 0.2),
    ('2% milk', '%2 yağlı süt', '1 cup (244 mL)', 244, 'ml', null, null, 122, 8.1, 12, 4.8),
    ('Firm tofu', 'Sert tofu', '150 g', 150, 'g', null, null, 216, 26, 4.2, 13),

    -- Complex and training-friendly carbohydrate sources
    ('Oats', 'Yulaf ezmesi', '1 cup cooked (234 g)', 1, 'cup', 234, null, 166, 5.9, 28.1, 3.6),
    ('Brown rice', 'Esmer pirinç', '1 cup cooked (195 g)', 1, 'cup', 195, null, 218, 4.6, 45.8, 1.6),
    ('White rice', 'Beyaz pirinç', '1 cup cooked (186 g)', 1, 'cup', 186, null, 205, 4.3, 44.5, 0.4),
    ('Quinoa', 'Kinoa', '1 cup cooked (185 g)', 1, 'cup', 185, null, 222, 8.1, 39.4, 3.6),
    ('Sweet potato', 'Tatlı patates', '200 g baked', 200, 'g', null, null, 180, 4, 41.4, 0.3),
    ('Baked potato', 'Fırınlanmış patates', '200 g', 200, 'g', null, null, 186, 5, 42, 0.3),
    ('Whole-grain bread', 'Tam tahıllı ekmek', '2 slices (70 g)', 2, 'piece', 35, null, 180, 8, 32, 2.5),
    ('Whole-wheat pasta', 'Tam buğday makarna', '1 cup cooked (148 g)', 1, 'cup', 148, null, 183, 8, 39, 1),
    ('Plain rice cakes', 'Sade pirinç patlağı', '2 cakes (18 g)', 2, 'piece', 9, null, 70, 1.4, 14.6, 0.6),

    -- Common fruit and vegetables
    ('Banana', 'Muz', '1 medium (118 g)', 1, 'piece', 118, null, 105, 1.3, 27, 0.4),
    ('Apple', 'Elma', '1 medium (182 g)', 1, 'piece', 182, null, 95, 0.5, 25.1, 0.3),
    ('Orange', 'Portakal', '1 medium (131 g)', 1, 'piece', 131, null, 62, 1.2, 15.4, 0.2),
    ('Blueberries', 'Yaban mersini', '1 cup (148 g)', 1, 'cup', 148, null, 84, 1.1, 21.4, 0.5),
    ('Strawberries', 'Çilek', '1 cup (152 g)', 1, 'cup', 152, null, 49, 1, 11.7, 0.5),
    ('Raspberries', 'Ahududu', '1 cup (123 g)', 1, 'cup', 123, null, 64, 1.5, 14.7, 0.8),
    ('Broccoli', 'Brokoli', '1 cup chopped (91 g)', 1, 'cup', 91, null, 31, 2.6, 6, 0.3),
    ('Spinach', 'Ispanak', '2 cups raw (60 g)', 2, 'cup', 30, null, 14, 1.7, 2.2, 0.2),
    ('Mixed greens', 'Karışık salata yeşillikleri', '2 cups (85 g)', 2, 'cup', 42.5, null, 20, 2, 3.5, 0.3),
    ('Bell pepper', 'Dolmalık biber', '1 medium (119 g)', 1, 'piece', 119, null, 37, 1.2, 7.2, 0.4),
    ('Carrots', 'Havuç', '1 cup chopped (128 g)', 1, 'cup', 128, null, 52, 1.2, 12.3, 0.3),
    ('Green beans', 'Taze fasulye', '1 cup cooked (125 g)', 1, 'cup', 125, null, 44, 2.4, 9.9, 0.4),

    -- Fats, nuts, and seeds
    ('Olive oil', 'Zeytinyağı', '1 tbsp (13.5 g)', 1, 'tbsp', 13.5, null, 119, 0, 0, 13.5),
    ('Avocado', 'Avokado', '1/2 medium (100 g)', 0.5, 'piece', 200, null, 160, 2, 8.5, 14.7),
    ('Almonds', 'Badem', '30 g (1 oz)', 30, 'g', null, null, 174, 6.4, 6.5, 15),
    ('Walnuts', 'Ceviz', '30 g (1 oz)', 30, 'g', null, null, 196, 4.6, 4.1, 19.6),
    ('Natural peanut butter', 'Doğal fıstık ezmesi', '2 tbsp (32 g)', 2, 'tbsp', 16, null, 190, 8, 7, 16),
    ('Natural almond butter', 'Doğal badem ezmesi', '2 tbsp (32 g)', 2, 'tbsp', 16, null, 196, 6.8, 6, 17.8),
    ('Chia seeds', 'Chia tohumu', '2 tbsp (28 g)', 2, 'tbsp', 14, null, 138, 4.7, 11.9, 8.7),
    ('Ground flaxseed', 'Öğütülmüş keten tohumu', '2 tbsp (14 g)', 2, 'tbsp', 7, null, 75, 2.6, 4, 5.9),

    -- Legumes
    ('Lentils', 'Mercimek', '1 cup cooked (198 g)', 1, 'cup', 198, null, 230, 17.9, 39.9, 0.8),
    ('Chickpeas', 'Nohut', '1 cup cooked (164 g)', 1, 'cup', 164, null, 269, 14.5, 45, 4.2),
    ('Black beans', 'Siyah fasulye', '1 cup cooked (172 g)', 1, 'cup', 172, null, 227, 15.2, 40.8, 0.9),

    -- Tracked supplements and packaged sports-nutrition items
    ('Whey isolate powder', 'Whey izolat protein tozu', '1 scoop (30 g)', 1, 'scoop', 30, null, 110, 25, 1.3, 0.4),
    ('Whey concentrate powder', 'Whey konsantre protein tozu', '1 scoop (25 g)', 1, 'scoop', 25, null, 100, 19, 3, 1),
    ('Casein protein powder', 'Kazein protein tozu', '1 scoop (33 g)', 1, 'scoop', 33, null, 117, 24, 3.2, 0.8),
    ('Mass gainer powder', 'Yüksek kalorili karbonhidrat-protein tozu', '2 scoops (336 g)', 2, 'scoop', 168, null, 1262, 50, 248, 7),
    ('Electrolyte drink powder', 'Elektrolit içecek tozu', '1.5 scoops (makes 12 fl oz)', 1.5, 'scoop', null, null, 90, 0, 22, 0),
    ('Protein bar', 'Protein barı', '1 bar (60 g)', 1, 'piece', 60, null, 190, 20, 24, 7),
    ('Creatine monohydrate', 'Kreatin monohidrat', '1 scoop (5 g)', 1, 'scoop', 5, null, 0, 0, 0, 0),
    ('Omega-3 softgels', 'Omega-3 yumuşak kapsül', '2 softgels', 2, 'piece', null, null, 20, 0, 0, 2),
    ('Daily multivitamin', 'Günlük multivitamin', '1 caplet', 1, 'piece', null, null, 0, 0, 0, 0),
    ('Vitamin D softgel', 'D vitamini yumuşak kapsül', '1 softgel', 1, 'piece', null, null, 0, 0, 0, 0),
    ('Magnesium caplet', 'Magnezyum tablet', '1 caplet', 1, 'piece', null, null, 0, 0, 0, 0)
) as source (
  name,
  name_tr,
  default_portion,
  serving_qty,
  serving_unit,
  grams_per_unit,
  note,
  kcal,
  protein_g,
  carb_g,
  fat_g
)
on lower(target.name) = lower(source.name)
when matched then
  update set
    name_tr = source.name_tr,
    default_portion = source.default_portion,
    serving_qty = source.serving_qty,
    serving_unit = source.serving_unit,
    grams_per_unit = source.grams_per_unit,
    kcal = source.kcal,
    protein_g = source.protein_g,
    carb_g = source.carb_g,
    fat_g = source.fat_g
when not matched then
  insert (
    name,
    name_tr,
    default_portion,
    serving_qty,
    serving_unit,
    grams_per_unit,
    note,
    kcal,
    protein_g,
    carb_g,
    fat_g
  )
  values (
    source.name,
    source.name_tr,
    source.default_portion,
    source.serving_qty,
    source.serving_unit,
    source.grams_per_unit,
    source.note,
    source.kcal,
    source.protein_g,
    source.carb_g,
    source.fat_g
  );
