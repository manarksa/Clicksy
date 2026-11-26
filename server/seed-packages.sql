-- Clicksy package data (seed). Copied word for word from the site as it was before packages moved
-- into the database. Run with: npm run db:seed (dry run) / npm run db:seed -- --yes
-- INSERT IGNORE: rows that already exist are left exactly as they are (edits made later are kept).


INSERT IGNORE INTO packages (package_id, name, description_en, description_ar, price, duration, is_popular, is_active) VALUES
  ('essential', 'Essential', 'Clean coverage for intimate gatherings',      'تغطية أنيقة للمناسبات الحميمة',       450,  3, 0, 1),
  ('signature', 'Signature', 'Photo + film highlights for the full night',  'صور وفيلم لأبرز لحظات الأمسية',      750,  4, 1, 1),
  ('prestige',  'Prestige',  'Full studio crew. Cinematic everything.',     'طاقم استوديو كامل. كل شيء سينمائي.', 1200, 6, 0, 1);

INSERT IGNORE INTO package_features (package_id, sort_order, feature_name_en, feature_name_ar) VALUES
  ('essential', 1, '1 lead photographer',                 'مصور رئيسي'),
  ('essential', 2, 'Edited photo gallery',                'معرض صور بعد التعديل'),
  ('essential', 3, 'Online delivery in 7 days',           'تسليم إلكتروني خلال 7 أيام'),
  ('essential', 4, 'Personal usage license',              'ترخيص استخدام شخصي'),
  ('signature', 1, 'Photographer + videographer',         'مصور ومصوّر فيديو'),
  ('signature', 2, '60–90s highlight reel',               'فيلم قصير من 60–90 ثانية'),
  ('signature', 3, 'Color-graded stills',                 'صور بتدرج لوني'),
  ('signature', 4, 'Priority delivery in 5 days',         'تسليم أولوية خلال 5 أيام'),
  ('signature', 5, 'Social media cutdowns',               'مقاطع قصيرة لمنصات التواصل'),
  ('prestige',  1, '2 photographers + 1 videographer',    'مصوران ومصوّر فيديو'),
  ('prestige',  2, 'Drone / cinematic B-roll*',           'درون / لقطات سينمائية*'),
  ('prestige',  3, 'Full event film + album-ready edits', 'فيلم المناسبة وتعديلات جاهزة للألبوم'),
  ('prestige',  4, 'Same-week preview selects',           'مختارات معاينة خلال الأسبوع نفسه'),
  ('prestige',  5, 'Dedicated creative director',         'مخرج إبداعي مخصّص'),
  ('prestige',  6, 'Raw files on request',                'الملفات الأصلية عند الطلب');
