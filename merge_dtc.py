import csv
import os
import re

print("🚀 بدء دمج ملفات الرموز الخاصة بالشركات...")

# مجلد المصدر
source_dir = 'source-data'
output_file = 'database/dtc_master.csv'

# التأكد من وجود مجلد الوجهة
os.makedirs('database', exist_ok=True)

# فتح ملف الإخراج للكتابة
with open(output_file, 'w', encoding='utf-8', newline='') as outfile:
    writer = csv.writer(outfile)
    # كتابة الترويسة (مع إضافة عمود للعربية)
    writer.writerow(['code', 'description', 'manufacturer', 'description_ar'])

    total_codes = 0

    # قراءة كل ملف في المجلد
    for filename in os.listdir(source_dir):
        if filename.endswith('.txt'):
            filepath = os.path.join(source_dir, filename)
            manufacturer = filename.replace('_codes.txt', '').replace('_codes (1).txt', '').upper()

            print(f"📖 قراءة ملف: {filename} (الشركة: {manufacturer})")

            file_count = 0
            with open(filepath, 'r', encoding='utf-8') as infile:
                for line in infile:
                    line = line.strip()
                    if line and '-' in line:
                        parts = line.split('-', 1)
                        code = parts[0].strip()
                        description = parts[1].strip()

                        # تنظيف الرمز
                        code = re.sub(r'\s+', ' ', code).strip()

                        # نترك الترجمة العربية فارغة الآن (يمكن إضافتها لاحقاً)
                        writer.writerow([code, description, manufacturer, ''])
                        file_count += 1
                        total_codes += 1

            print(f"   ✅ تم استخراج {file_count} رمز من {filename}")

    print(f"\n🎉 تم دمج {total_codes} رمز في ملف {output_file}")