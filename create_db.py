import sqlite3
import csv
import os

print("🚀 بدء إنشاء قاعدة البيانات العملاقة...")

# تحديد مسارات الملفات
csv_file_path = 'database/dtc_master.csv'
db_file_path = 'database/dtc_full.db'

# التأكد من وجود المجلد database
os.makedirs('database', exist_ok=True)

# إنشاء اتصال بقاعدة البيانات
conn = sqlite3.connect(db_file_path)
cursor = conn.cursor()

# إنشاء الجدول (مع إضافة عمود للترجمة العربية)
cursor.execute('''
    CREATE TABLE IF NOT EXISTS dtc (
        code TEXT PRIMARY KEY,
        description TEXT,
        manufacturer TEXT DEFAULT 'Generic',
        description_ar TEXT
    )
''')

print("✅ تم إنشاء الجدول")

# قراءة ملف CSV وإدراج البيانات
try:
    with open(csv_file_path, 'r', encoding='utf-8') as csvfile:
        # قراءة كل الأسطر
        lines = csvfile.readlines()
        print(f"📊 عدد الأسطر في الملف: {len(lines)}")

        # إعادة تعيين المؤشر لقراءة CSV بشكل صحيح
        csvfile.seek(0)
        reader = csv.reader(csvfile)

        # قراءة السطر الأول (الترويسة)
        try:
            header = next(reader)
            print(f"📋 الأعمدة الموجودة: {header}")
        except StopIteration:
            print("❌ الملف فارغ!")
            exit()

        count = 0
        for row in reader:
            if len(row) >= 2:  # التأكد من وجود عمودين على الأقل
                code = row[0].strip()
                description = row[1].strip()

                # استخراج الشركة المصنعة (إذا كان موجوداً)
                manufacturer = row[2].strip() if len(row) > 2 else 'Generic'

                # استخراج الترجمة العربية (إذا كانت موجودة)
                description_ar = row[3].strip() if len(row) > 3 else ''

                # تجاهل الصفوف الفارغة
                if code and description:
                    try:
                        cursor.execute(
                            "INSERT OR REPLACE INTO dtc (code, description, manufacturer, description_ar) VALUES (?, ?, ?, ?)",
                            (code, description, manufacturer, description_ar)
                        )
                        count += 1

                        # عرض تقدم كل 500 رمز
                        if count % 500 == 0:
                            print(f"✅ تم إدراج {count} رمز حتى الآن...")

                    except Exception as e:
                        print(f"⚠️ خطأ في إدراج {code}: {e}")

        conn.commit()
        print(f"\n🎉 تم إدراج {count} رمز بنجاح!")

except FileNotFoundError:
    print(f"❌ الملف {csv_file_path} غير موجود. تأكد من إنشائه في مجلد database/")
except Exception as e:
    print(f"❌ حدث خطأ: {e}")

finally:
    conn.close()
    print("🏁 انتهى!")