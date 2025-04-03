import logging

"""
تم إلغاء نظام الإشعارات تماماً حسب طلب المستخدم
هذا الملف يحتوي فقط على دوال فارغة لا تقوم بأي شيء
لتجنب أخطاء في التطبيق في حالة استدعاء هذه الدوال من أجزاء أخرى
"""

def check_similar_notification(user_id, category, reference_id):
    """
    وظيفة فارغة - تم إلغاء نظام الإشعارات
    
    Returns:
        bool: دائماً True لتجنب إنشاء إشعارات جديدة
    """
    return True

def clean_old_notifications(db):
    """
    وظيفة فارغة - تم إلغاء نظام الإشعارات
    """
    pass

def send_notification(db, socketio, user_id, title, message, category, reference_type=None, reference_id=None, url=None, extra_data=None):
    """
    وظيفة فارغة - تم إلغاء نظام الإشعارات
    
    Returns:
        bool: دائماً True للإشارة إلى نجاح العملية (لتجنب أخطاء)
    """
    return True