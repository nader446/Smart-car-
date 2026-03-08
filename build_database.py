import csv
import os
import sqlite3

print("=" * 50)
print("🚀 بناء قاعدة البيانات (الإصدار المتكامل)")
print("=" * 50)

os.makedirs('database', exist_ok=True)

# ============================================
# جمع الرموز مع أو بدون تفاصيل
# ============================================
print("\n📦 جمع الرموز...")
all_codes = []

# الملفات الثلاثة الجديدة
enhanced_files = ['custom_codes.csv', 'obd_elm327_batch.csv', 'obd_elm327_mega_batch.csv']

for filename in enhanced_files:
    if os.path.exists(filename):
        print(f"   📖 {filename}")
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                continue

            for row in reader:
                if not row:  # تخطي الصفوف الفارغة
                    continue

                code = row[0].strip() if len(row) > 0 else ''
                description = row[1].strip() if len(row) > 1 else ''

                if not code or not description:
                    continue

                # استخراج التفاصيل الإضافية إذا كانت موجودة
                if len(row) >= 6:
                    # ملفات محسنة (بها تفاصيل)
                    manufacturer = row[2].split()[0].upper() if row[2] else 'GENERIC'
                    all_codes.append({
                        'code': code,
                        'description': description,
                        'manufacturer': manufacturer,
                        'car_type': row[2],
                        'category': row[3],
                        'common_cause': row[4],
                        'fix_tip': row[5]
                    })
                else:
                    # ملفات بدون تفاصيل
                    manufacturer = 'GENERIC'
                    if len(row) > 2 and row[2]:
                        manufacturer = row[2].split()[0].upper()

                    all_codes.append({
                        'code': code,
                        'description': description,
                        'manufacturer': manufacturer,
                        'car_type': '',
                        'category': '',
                        'common_cause': '',
                        'fix_tip': ''
                    })
        print(f"      ✅ {len(all_codes)} رمز حتى الآن")

# الملفات القديمة من source-data
if os.path.exists('source-data'):
    print("\n   📖 قراءة الملفات القديمة...")
    for filename in os.listdir('source-data'):
        if filename.endswith('.txt'):
            filepath = os.path.join('source-data', filename)
            manufacturer = filename.replace('_codes.txt', '').replace('_codes (1).txt', '').upper()

            with open(filepath, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    if '-' in line:
                        parts = line.split('-', 1)
                        code = parts[0].strip()
                        description = parts[1].strip()
                        if code and description:
                            all_codes.append({
                                'code': code,
                                'description': description,
                                'manufacturer': manufacturer,
                                'car_type': '',
                                'category': '',
                                'common_cause': '',
                                'fix_tip': ''
                            })
            print(f"      ✅ {filename}")

print(f"\n📊 إجمالي الرموز المجمعة: {len(all_codes)}")

# ============================================
# إنشاء قاعدة البيانات (مع جميع الأعمدة)
# ============================================
print("\n💾 إنشاء قاعدة البيانات...")

db_path = 'database/dtc_full.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# إنشاء جدول بجميع الأعمدة (حتى لو كانت فارغة)
cursor.execute('''
    CREATE TABLE IF NOT EXISTS dtc (
        code TEXT PRIMARY KEY,
        description TEXT,
        manufacturer TEXT,
        car_type TEXT,
        category TEXT,
        common_cause TEXT,
        fix_tip TEXT
    )
''')

# إدراج البيانات
insert_count = 0
for item in all_codes:
    try:
        cursor.execute('''
            INSERT OR REPLACE INTO dtc 
            (code, description, manufacturer, car_type, category, common_cause, fix_tip)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            item['code'],
            item['description'],
            item['manufacturer'],
            item['car_type'],
            item['category'],
            item['common_cause'],
            item['fix_tip']
        ))
        insert_count += 1
        if insert_count % 1000 == 0:
            print(f"      ⏳ تم إدراج {insert_count} رمز...")
    except Exception as e:
        print(f"      ⚠️ خطأ في إدراج {item['code']}: {e}")

conn.commit()
conn.close()

# ============================================
# النتيجة النهائية
# ============================================
print("\n" + "=" * 50)
print(f"🎉 تم بناء قاعدة البيانات بنجاح!")
print(f"📊 إجمالي الرموز المدرجة: {insert_count}")
print(f"💾 قاعدة البيانات: {db_path}")
print("=" * 50)
print("🚀 الآن اضغط على Run لتشغيل التطبيق")
print("=" * 50)