from flask import flash, redirect, url_for
import logging
from sqlalchemy.exc import SQLAlchemyError

def handle_error(error, message=None):
    """
    معالجة الأخطاء في مسارات الويب
    
    Args:
        error (Exception): الخطأ الذي حدث
        message (str, optional): رسالة الخطأ المخصصة. الافتراضي None.
    
    Returns:
        Response: إعادة توجيه إلى لوحة التحكم مع رسالة خطأ
    """
    # تسجيل تفاصيل الخطأ في السجل
    logging.error(f"Error: {str(error)}")
    
    # إظهار رسالة خطأ للمستخدم
    if message:
        flash(message, 'danger')
    else:
        flash('حدث خطأ أثناء معالجة الطلب. الرجاء المحاولة مرة أخرى.', 'danger')
    
    # إعادة توجيه المستخدم إلى لوحة التحكم
    return redirect(url_for('auth.dashboard'))

def handle_db_error(error, message=None):
    """
    معالجة أخطاء قاعدة البيانات في مسارات الويب
    
    Args:
        error (SQLAlchemyError): خطأ قاعدة البيانات
        message (str, optional): رسالة الخطأ المخصصة. الافتراضي None.
    
    Returns:
        Response: إعادة توجيه إلى لوحة التحكم مع رسالة خطأ
    """
    # تسجيل تفاصيل خطأ قاعدة البيانات
    logging.error(f"Database Error: {str(error)}")
    
    # إظهار رسالة خطأ للمستخدم
    if message:
        flash(message, 'danger')
    else:
        flash('حدث خطأ في قاعدة البيانات. الرجاء المحاولة مرة أخرى.', 'danger')
    
    # إعادة توجيه المستخدم إلى لوحة التحكم
    return redirect(url_for('auth.dashboard'))