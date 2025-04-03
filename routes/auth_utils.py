from functools import wraps
from flask import redirect, url_for, flash, abort, request
from flask_login import login_required, current_user
from models import UserPermission

def requires_permission(module, permission):
    """
    مغلف للتحقق من صلاحيات المستخدم للوصول إلى وظائف معينة
    
    Args:
        module (str): اسم الوحدة (مثل "طلبات الشراء" أو "الموردين")
        permission (str): نوع الصلاحية المطلوبة (can_read, can_create, can_update, can_delete, can_approve)
    
    Returns:
        function: دالة مغلف تتحقق من صلاحيات المستخدم قبل تنفيذ الدالة المطلوبة
    """
    def decorator(func):
        @wraps(func)
        @login_required
        def wrapper(*args, **kwargs):
            # مدير النظام يمتلك جميع الصلاحيات
            if current_user.role == 'مدير':
                return func(*args, **kwargs)
            
            # التحقق من وجود صلاحية للمستخدم الحالي للوحدة المطلوبة
            user_permission = UserPermission.query.filter_by(
                user_id=current_user.id,
                module=module
            ).first()
            
            # إذا لم يكن للمستخدم صلاحيات أو لم يمتلك الصلاحية المطلوبة
            if not user_permission or not getattr(user_permission, permission, False):
                flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
                return redirect(url_for('auth.dashboard'))
            
            return func(*args, **kwargs)
        return wrapper
    return decorator

def check_permission(module, permission):
    """
    التحقق من وجود صلاحية محددة للمستخدم الحالي
    
    Args:
        module (str): اسم الوحدة
        permission (str): نوع الصلاحية المطلوبة
    
    Returns:
        bool: هل يمتلك المستخدم الصلاحية المطلوبة؟
    """
    # مدير النظام يمتلك جميع الصلاحيات
    if current_user.role == 'مدير':
        return True
    
    # التحقق من وجود صلاحية للمستخدم الحالي للوحدة المطلوبة
    user_permission = UserPermission.query.filter_by(
        user_id=current_user.id,
        module=module
    ).first()
    
    # إذا لم يكن للمستخدم صلاحيات أو لم يمتلك الصلاحية المطلوبة
    if not user_permission or not getattr(user_permission, permission, False):
        return False
    
    return True

def get_user_modules():
    """
    الحصول على قائمة الوحدات المتاحة للمستخدم الحالي
    
    Returns:
        list: قائمة بأسماء الوحدات التي يمكن للمستخدم الوصول إليها
    """
    # مدير النظام يمتلك جميع الوحدات
    if current_user.role == 'مدير':
        return [
            'الموردين',
            'طلبات الشراء',
            'المستخلصات',
            'المعاملات الأخرى',
            'الاعتمادات',
            'التقارير',
            'المستخدمين',
            'projects'  # تمت إضافة وحدة المشاريع
        ]
    
    # الحصول على الوحدات التي يمتلك فيها المستخدم صلاحية القراءة على الأقل
    user_permissions = UserPermission.query.filter_by(
        user_id=current_user.id
    ).all()
    
    # إنشاء قائمة بالوحدات المتاحة
    available_modules = []
    for permission in user_permissions:
        # إضافة الوحدة فقط إذا كان المستخدم يمتلك على الأقل صلاحية القراءة
        if permission.can_read:
            available_modules.append(permission.module)
    
    return available_modules