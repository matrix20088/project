"""
وحدة مساعدة للتعامل مع قاعدة البيانات ومعالجة الاستثناءات
"""

import logging
import time
import functools
import sqlalchemy
from sqlalchemy import exc as sqlalchemy_exc
from app import db

def handle_db_connection_error(max_retries=3, delay=0.5):
    """
    مغلف للدوال التي تتفاعل مع قاعدة البيانات 
    يعيد محاولة الاتصال عند حدوث أخطاء الاتصال
    
    Args:
        max_retries: عدد المحاولات الأقصى لإعادة الاتصال
        delay: التأخير بين محاولات إعادة الاتصال (بالثواني)
    """
    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            retries = 0
            while retries < max_retries:
                try:
                    return func(*args, **kwargs)
                except sqlalchemy_exc.OperationalError as e:
                    retries += 1
                    logging.warning(f"خطأ اتصال بقاعدة البيانات: {str(e)}")
                    logging.warning(f"محاولة إعادة الاتصال {retries}/{max_retries}")
                    
                    # إعادة تعيين الجلسة في حالة انقطاع الاتصال
                    db.session.rollback()
                    
                    if retries >= max_retries:
                        logging.error("فشلت جميع محاولات إعادة الاتصال بقاعدة البيانات")
                        raise
                    
                    # انتظار قبل المحاولة التالية
                    time.sleep(delay * retries)  # زيادة وقت الانتظار مع كل محاولة
                except sqlalchemy_exc.SQLAlchemyError as e:
                    # إلغاء التعديلات في حالة حدوث خطأ آخر في SQLAlchemy
                    db.session.rollback()
                    logging.error(f"خطأ في SQLAlchemy: {str(e)}")
                    raise
        return wrapper
    return decorator


def safe_commit():
    """
    حفظ التغييرات بشكل آمن مع التعامل مع أخطاء الاتصال
    
    Returns:
        bool: هل تم الحفظ بنجاح
    """
    try:
        db.session.commit()
        return True
    except sqlalchemy_exc.OperationalError as e:
        logging.warning(f"خطأ اتصال أثناء حفظ التغييرات: {str(e)}")
        db.session.rollback()
        return False
    except sqlalchemy_exc.SQLAlchemyError as e:
        logging.error(f"خطأ في SQLAlchemy أثناء حفظ التغييرات: {str(e)}")
        db.session.rollback()
        return False


def is_db_connected():
    """
    التحقق مما إذا كان الاتصال بقاعدة البيانات فعالاً
    
    Returns:
        bool: هل الاتصال بقاعدة البيانات فعال
    """
    try:
        # تنفيذ استعلام بسيط للتحقق من الاتصال
        db.session.execute("SELECT 1").scalar()
        return True
    except Exception as e:
        logging.warning(f"قاعدة البيانات غير متصلة: {str(e)}")
        # إعادة تعيين الجلسة في حالة حدوث خطأ
        try:
            db.session.rollback()
        except:
            pass
        return False


def reconnect_db():
    """
    محاولة إعادة الاتصال بقاعدة البيانات
    
    Returns:
        bool: هل تم إعادة الاتصال بنجاح
    """
    try:
        # إغلاق جميع الاتصالات الحالية
        db.session.close()
        db.engine.dispose()
        
        # التحقق من الاتصال
        is_connected = is_db_connected()
        
        if is_connected:
            logging.info("تم إعادة الاتصال بقاعدة البيانات بنجاح")
        else:
            logging.warning("فشل في إعادة الاتصال بقاعدة البيانات")
            
        return is_connected
    except Exception as e:
        logging.error(f"خطأ أثناء إعادة الاتصال بقاعدة البيانات: {str(e)}")
        return False