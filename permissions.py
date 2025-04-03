"""
وحدة إدارة الصلاحيات والتحقق من الوصول للمشاريع والمعاملات
"""

from functools import wraps
from flask import flash, redirect, url_for
from flask_login import current_user
from app import db
from models import User, UserRole, ProjectMembership, Project
import logging

# إنشاء logger لتسجيل معلومات الوصول
logger = logging.getLogger(__name__)

def admin_required(f):
    """
    مغلف للوظائف التي تتطلب صلاحيات المسؤول
    
    هذا المغلف يتحقق من أن المستخدم الحالي هو 'admin' قبل السماح بالوصول
    
    Args:
        f: الوظيفة التي سيتم تغليفها
        
    Returns:
        الوظيفة المغلفة التي تتحقق من صلاحيات المستخدم
    """
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated:
            flash('يجب تسجيل الدخول للوصول إلى هذه الصفحة', 'warning')
            return redirect(url_for('auth.login'))
            
        # التحقق من أن المستخدم هو المدير (admin)
        if not current_user.is_admin:
            flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
            return redirect(url_for('auth.dashboard'))
            
        return f(*args, **kwargs)
        
    return decorated_function

def has_access_to_project(project_id):
    """
    التحقق مما إذا كان المستخدم الحالي لديه صلاحية الوصول إلى مشروع معين
    
    Args:
        project_id: معرف المشروع للتحقق منه
        
    Returns:
        bool: True إذا كان المستخدم لديه صلاحية الوصول، False إذا لم يكن كذلك
    """
    if not current_user.is_authenticated:
        return False
        
    # إذا كان المستخدم من الأدوار المستثناة، فلديه حق الوصول لجميع المشاريع
    if current_user.role in [UserRole.PROJECT_MANAGER, UserRole.EXECUTIVE_MANAGER, 
                           UserRole.PURCHASING_STAFF, UserRole.ENGINEERING_OFFICE_MANAGER,
                           UserRole.FINANCIAL_MANAGER]:
        return True
    
    # التحقق مما إذا كان المستخدم عضواً في المشروع
    membership = ProjectMembership.query.filter_by(
        user_id=current_user.id, 
        project_id=project_id
    ).first()
    
    return membership is not None

def get_accessible_projects():
    """
    الحصول على قائمة بمعرفات المشاريع التي يمكن للمستخدم الحالي الوصول إليها
    
    Returns:
        list: قائمة معرفات المشاريع المتاحة للمستخدم الحالي
    """
    if not current_user.is_authenticated:
        return []
        
    # إذا كان المستخدم من الأدوار المستثناة، فلديه حق الوصول لجميع المشاريع
    if current_user.role in [UserRole.PROJECT_MANAGER, UserRole.EXECUTIVE_MANAGER, 
                           UserRole.PURCHASING_STAFF, UserRole.ENGINEERING_OFFICE_MANAGER,
                           UserRole.FINANCIAL_MANAGER]:
        # إعادة كافة معرفات المشاريع
        projects = Project.query.all()
        return [p.id for p in projects]
    
    # الحصول على المشاريع التي المستخدم عضو فيها
    memberships = ProjectMembership.query.filter_by(user_id=current_user.id).all()
    return [m.project_id for m in memberships]

def filter_query_by_project_access(query, project_id_column):
    """
    تعديل استعلام قاعدة البيانات لتضمين فقط السجلات التي يمكن للمستخدم الوصول إليها
    
    Args:
        query: استعلام SQLAlchemy الذي سيتم تعديله
        project_id_column: عمود معرف المشروع في الجدول (مثل PurchaseRequest.project_id)
        
    Returns:
        Query: استعلام SQLAlchemy المعدل
    """
    if not current_user.is_authenticated:
        # إذا لم يكن المستخدم مسجل دخوله، لا يمكنه رؤية أي شيء
        return query.filter(False)
        
    # إذا كان المستخدم من الأدوار المستثناة، فلا داعي لتعديل الاستعلام
    if current_user.role in [UserRole.PROJECT_MANAGER, UserRole.EXECUTIVE_MANAGER, 
                           UserRole.PURCHASING_STAFF, UserRole.ENGINEERING_OFFICE_MANAGER,
                           UserRole.FINANCIAL_MANAGER]:
        return query
    
    # الحصول على قائمة المشاريع المتاحة للمستخدم
    accessible_projects = get_accessible_projects()
    
    # تعديل الاستعلام ليشمل فقط المشاريع المتاحة
    return query.filter(project_id_column.in_(accessible_projects))