"""
هذا الملف يحتوي على وظائف لإجراء الهجرة التلقائية لقاعدة البيانات
عند تغيير نماذج البيانات (models)
"""

import os
import logging
import subprocess
from flask import Flask
from flask_migrate import Migrate
from alembic.util import CommandError
from app import app, db
import models  # استيراد كل النماذج

def check_and_update_models():
    """
    تدقيق التغييرات في نماذج البيانات وإجراء الهجرة التلقائية
    إذا كان هناك تغييرات في الهيكل
    """
    logging.info("فحص التغييرات في نماذج البيانات...")
    
    try:
        # تهيئة مجلد الهجرات إذا لم يكن موجوداً
        migrations_dir = os.path.join(os.path.dirname(__file__), 'migrations')
        if not os.path.exists(migrations_dir):
            logging.info("إنشاء مجلد الهجرات لأول مرة...")
            with app.app_context():
                migrate = Migrate(app, db)
                # إنشاء مجلد الهجرات واسكريبت أوّلي
                os.environ['FLASK_APP'] = 'main.py'
                subprocess.run(['flask', 'db', 'init'], check=True)
                
        # إنشاء نسخة جديدة من الهجرة
        with app.app_context():
            migrate = Migrate(app, db)
            # توليد سكريبت الهجرة الجديد
            result = subprocess.run(['flask', 'db', 'migrate', '-m', 'اوتوماتيكية: تحديث نماذج البيانات'], 
                                   check=False, capture_output=True, text=True)
            
            if result.returncode != 0:
                if "Target database is not up to date" in result.stderr:
                    logging.warning("قاعدة البيانات غير محدثة، جارٍ تحديثها أولاً...")
                    upgrade_result = subprocess.run(['flask', 'db', 'upgrade'], check=False, capture_output=True, text=True)
                    if upgrade_result.returncode != 0:
                        logging.error(f"فشل تحديث قاعدة البيانات: {upgrade_result.stderr}")
                        return False
                    
                    # محاولة إنشاء الهجرة مرة أخرى بعد التحديث
                    result = subprocess.run(['flask', 'db', 'migrate', '-m', 'اوتوماتيكية: تحديث نماذج البيانات'], 
                                           check=False, capture_output=True, text=True)
                else:
                    # لا توجد تغييرات أو حدث خطأ آخر
                    if "No changes in schema detected" in result.stdout or "No changes in schema detected" in result.stderr:
                        logging.info("لم يتم العثور على تغييرات في الهيكل")
                        return True
                    else:
                        logging.error(f"خطأ أثناء إنشاء الهجرة: {result.stderr}")
                        return False
            
            # تنفيذ التحديثات على قاعدة البيانات
            logging.info("تم العثور على تغييرات في النماذج، جارٍ تطبيق التحديثات...")
            upgrade_result = subprocess.run(['flask', 'db', 'upgrade'], check=False, capture_output=True, text=True)
            
            if upgrade_result.returncode != 0:
                logging.error(f"فشل تحديث قاعدة البيانات: {upgrade_result.stderr}")
                return False
            
            logging.info("تم تحديث قاعدة البيانات بنجاح")
            return True
            
    except Exception as e:
        logging.error(f"حدث خطأ أثناء تحديث نماذج البيانات: {str(e)}")
        return False

def add_column_if_not_exists(table_name, column_name, column_type):
    """
    إضافة عمود إلى جدول إذا لم يكن موجوداً بالفعل
    
    Args:
        table_name: اسم الجدول
        column_name: اسم العمود
        column_type: نوع العمود (مثل VARCHAR(255), INTEGER, وغيرها)
    
    Returns:
        bool: هل تمت الإضافة بنجاح
    """
    try:
        with app.app_context():
            # التحقق مما إذا كان العمود موجوداً بالفعل
            column_exists_query = f"""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = '{table_name}' 
              AND column_name = '{column_name}'
            """
            result = db.engine.execute(column_exists_query).fetchone()
            
            if not result:
                # إضافة العمود إذا لم يكن موجوداً
                alter_table_query = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type};"
                db.engine.execute(alter_table_query)
                logging.info(f"تمت إضافة العمود {column_name} إلى جدول {table_name}")
                return True
            else:
                logging.info(f"العمود {column_name} موجود بالفعل في جدول {table_name}")
                return False
    except Exception as e:
        logging.error(f"فشل إضافة العمود {column_name} إلى جدول {table_name}: {str(e)}")
        return False

# يمكن استدعاء هذه الدالة عند بدء التطبيق
def run_auto_migration():
    """تشغيل الهجرة التلقائية عند بدء التطبيق"""
    logging.info("بدء التحقق من هجرات قاعدة البيانات...")
    success = check_and_update_models()
    if success:
        logging.info("تم التحقق من هجرات قاعدة البيانات بنجاح")
    else:
        logging.warning("كانت هناك مشكلة في التحقق من هجرات قاعدة البيانات")