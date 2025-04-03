"""
وحدة مساعدة لإدارة التوقيعات الإلكترونية في النظام
تتضمن دوال لرفع وحفظ وعرض التوقيعات للمستخدمين
"""

import os
from werkzeug.utils import secure_filename
from models import User
from flask import current_app
import shutil
import logging

# المجلدات المستخدمة للتوقيعات
SIGNATURES_DIR = 'static/signatures'
UPLOADS_SIGNATURES_DIR = 'static/uploads/signatures'
PLACEHOLDER_SIGNATURE = 'static/images/signature-placeholder.png'

def init_signatures_directory():
    """تهيئة مجلدات التوقيعات إذا لم تكن موجودة"""
    # إنشاء مجلد التوقيعات الرئيسي
    if not os.path.exists(SIGNATURES_DIR):
        os.makedirs(SIGNATURES_DIR, exist_ok=True)
        logging.info(f"تم إنشاء مجلد التوقيعات الرئيسي في {SIGNATURES_DIR}")
    
    # التأكد من وجود مجلد المرفقات الرئيسي static/uploads
    uploads_dir = os.path.dirname(UPLOADS_SIGNATURES_DIR)
    if not os.path.exists(uploads_dir):
        os.makedirs(uploads_dir, exist_ok=True)
        logging.info(f"تم إنشاء مجلد المرفقات الرئيسي في {uploads_dir}")
    
    # إنشاء مجلد التوقيعات في المرفقات
    if not os.path.exists(UPLOADS_SIGNATURES_DIR):
        os.makedirs(UPLOADS_SIGNATURES_DIR, exist_ok=True)
        logging.info(f"تم إنشاء مجلد التوقيعات في المرفقات في {UPLOADS_SIGNATURES_DIR}")

def save_signature(user_id, signature_file):
    """
    حفظ ملف توقيع للمستخدم
    
    Args:
        user_id: معرف المستخدم
        signature_file: ملف التوقيع المرفوع
    
    Returns:
        مسار ملف التوقيع المحفوظ، أو None في حالة فشل الحفظ
    """
    if not signature_file or not signature_file.filename:
        return None
    
    # التأكد من وجود المجلد
    init_signatures_directory()
    
    # التأكد من نوع الملف
    allowed_extensions = {'png', 'jpg', 'jpeg', 'gif'}
    file_ext = signature_file.filename.rsplit('.', 1)[1].lower() if '.' in signature_file.filename else ''
    
    if file_ext not in allowed_extensions:
        logging.warning(f"نوع ملف توقيع غير صالح: {file_ext}")
        return None
    
    # تأمين اسم الملف وحفظه
    signature_filename = f"signature_{user_id}.{file_ext}"
    # نحفظ في مجلد المرفقات حيث يتم حفظ التوقيعات الجديدة
    signature_path = os.path.join(UPLOADS_SIGNATURES_DIR, signature_filename)
    
    try:
        # حفظ الملف
        signature_file.save(signature_path)
        logging.info(f"تم حفظ ملف التوقيع للمستخدم {user_id} في {signature_path}")
        
        # تحديث مسار التوقيع في قاعدة البيانات
        from models import User, db
        user = User.query.get(user_id)
        if user:
            user.signature_path = signature_path
            db.session.commit()
            logging.info(f"تم تحديث مسار التوقيع في قاعدة البيانات للمستخدم {user_id}")
        
        return signature_path
    except Exception as e:
        logging.error(f"فشل في حفظ ملف التوقيع: {str(e)}")
        return None

def get_signature_path(user_id, default_to_placeholder=True):
    """
    الحصول على مسار ملف توقيع المستخدم
    
    Args:
        user_id: معرف المستخدم
        default_to_placeholder: هل يتم استخدام توقيع افتراضي إذا لم يكن هناك توقيع
    
    Returns:
        مسار ملف التوقيع أو مسار التوقيع الافتراضي
    """
    if user_id is None:
        if default_to_placeholder:
            logging.debug("معرف المستخدم فارغ، استخدام التوقيع الافتراضي")
            return PLACEHOLDER_SIGNATURE
        return None
        
    # البحث في قاعدة البيانات عن مسار التوقيع المخزن
    from models import User
    
    try:
        user = User.query.get(user_id)
        if user and user.signature_path and os.path.exists(user.signature_path):
            logging.debug(f"تم العثور على مسار توقيع في قاعدة البيانات للمستخدم {user_id}: {user.signature_path}")
            return user.signature_path
    except Exception as e:
        logging.error(f"خطأ أثناء البحث عن توقيع المستخدم في قاعدة البيانات: {str(e)}")
    
    # البحث عن أي ملف توقيع للمستخدم بأي امتداد في مجلدات التوقيعات
    extensions = ['png', 'jpg', 'jpeg', 'gif']
    
    # البحث في مجلد التوقيعات الرئيسي
    for ext in extensions:
        signature_path = os.path.join(SIGNATURES_DIR, f"signature_{user_id}.{ext}")
        if os.path.exists(signature_path):
            logging.debug(f"تم العثور على ملف توقيع للمستخدم {user_id} في مجلد التوقيعات الرئيسي: {signature_path}")
            return signature_path
    
    # البحث في مجلد التوقيعات في المرفقات
    for ext in extensions:
        uploads_signature_path = os.path.join(UPLOADS_SIGNATURES_DIR, f"signature_{user_id}.{ext}")
        if os.path.exists(uploads_signature_path):
            logging.debug(f"تم العثور على ملف توقيع للمستخدم {user_id} في مجلد المرفقات: {uploads_signature_path}")
            return uploads_signature_path
    
    # إذا لم يتم العثور على توقيع ويسمح باستخدام التوقيع الافتراضي
    if default_to_placeholder:
        logging.debug(f"استخدام التوقيع الافتراضي للمستخدم {user_id}")
        return PLACEHOLDER_SIGNATURE
    
    return None

def get_user_with_signature(user):
    """
    إضافة مسار التوقيع إلى كائن المستخدم
    
    Args:
        user: كائن المستخدم
    
    Returns:
        كائن المستخدم مع إضافة مسار التوقيع
    """
    if not user:
        return None
    
    # إضافة مسار التوقيع إلى كائن المستخدم
    user.signature_full_path = get_signature_path(user.id)
    return user

def get_role_signatures_dict():
    """
    الحصول على قاموس يحتوي على توقيعات لكل دور
    
    Returns:
        قاموس يحتوي على توقيعات للأدوار المختلفة
    """
    roles = {
        'engineering_manager': 'مدير مكتب هندسي',
        'projects_manager': 'مدير مشاريع',
        'executive_manager': 'مدير تنفيذي'
    }
    
    signatures = {}
    logging.debug("بدء إنشاء قاموس التوقيعات للأدوار")
    
    for role_key, role_name in roles.items():
        # حالة خاصة للمدير التنفيذي - البحث عن المهندس سيف عبد الله
        if role_key == 'executive_manager':
            # البحث أولاً عن المهندس سيف عبد الله (معرف 7)
            user_saif = User.query.filter_by(id=7).first()
            if user_saif and user_saif.role == 'مدير تنفيذي':
                logging.debug(f"استخدام المهندس سيف عبد الله (معرف 7) للدور {role_name}")
                signature_path = get_signature_path(user_saif.id)
                signatures[role_key] = {
                    'user': user_saif,
                    'signature_path': signature_path
                }
                logging.debug(f"توقيع المدير التنفيذي (م.سيف): {signature_path}")
                continue
        
        # البحث عن مستخدم له الدور المطلوب
        users = User.query.filter_by(role=role_name).all()
        logging.debug(f"وجدنا {len(users)} مستخدم للدور {role_name}")
        
        # إذا لم نجد مستخدمين، استخدم قيمة افتراضية
        if not users:
            signatures[role_key] = {
                'user': None, 
                'signature_path': PLACEHOLDER_SIGNATURE
            }
            logging.debug(f"لم يتم العثور على مستخدمين للدور {role_name}")
            continue
        
        # البحث أولاً عن مستخدم له توقيع صالح
        user_with_signature = None
        signature_path = None
        
        for user in users:
            temp_signature_path = get_signature_path(user.id, default_to_placeholder=False)
            if temp_signature_path and temp_signature_path != PLACEHOLDER_SIGNATURE:
                user_with_signature = user
                signature_path = temp_signature_path
                logging.debug(f"وجدنا مستخدم {user.username} له توقيع: {signature_path}")
                break
        
        # إذا لم نجد مستخدم له توقيع، استخدم أول مستخدم
        if not user_with_signature:
            user_with_signature = users[0]
            signature_path = get_signature_path(user_with_signature.id)
            logging.debug(f"استخدام أول مستخدم {user_with_signature.username} للدور {role_name} مع التوقيع: {signature_path}")
        
        signatures[role_key] = {
            'user': user_with_signature,
            'signature_path': signature_path
        }
    
    # السجلات النهائية للتوقيعات
    logging.debug(f"القاموس النهائي للتوقيعات: {str({k: {'user_id': v['user'].id if v['user'] else None, 'username': v['user'].username if v['user'] else None, 'signature_path': v['signature_path']} for k, v in signatures.items()})}")
    
    return signatures

def get_approval_user_signature(approval_type, order_id):
    """
    الحصول على المستخدم الذي قام بالاعتماد وتوقيعه
    
    Args:
        approval_type: نوع الاعتماد (engineering_approval, projects_approval, executive_approval)
        order_id: معرف الأمر
    
    Returns:
        كائن المستخدم ومسار التوقيع
    """
    from models import ApprovalLog
    
    # البحث في سجلات الاعتماد
    role_mapping = {
        'engineering_approval': 'مدير مكتب هندسي',
        'projects_approval': 'مدير مشاريع',
        'executive_approval': 'مدير تنفيذي'
    }
    
    if approval_type not in role_mapping:
        return None, PLACEHOLDER_SIGNATURE
    
    role = role_mapping[approval_type]
    
    # البحث عن سجل الاعتماد لهذا الدور 
    try:
        approval_log = ApprovalLog.query.filter_by(
            approval_type='أمر شراء',
            reference_id=order_id,
            action='اعتماد'
        ).join(User, User.id == ApprovalLog.approved_by).filter(User.role == role).first()
    except Exception as e:
        logging.error(f"خطأ في البحث عن سجل الاعتماد: {str(e)}")
        approval_log = None
    
    if approval_log:
        user = User.query.get(approval_log.approved_by)
        if user:
            # الحصول على مسار التوقيع مع توفير المزيد من المعلومات للتصحيح
            signature_path = get_signature_path(user.id)
            logging.debug(f"تم العثور على مستخدم قام بالاعتماد: {user.username} ومسار التوقيع: {signature_path}")
            return user, signature_path
    
    # حالة خاصة للمدير التنفيذي - البحث عن المهندس سيف عبد الله
    if approval_type == 'executive_approval':
        # البحث عن المهندس سيف عبد الله بشكل محدد
        user = User.query.filter_by(id=7).first()  # استخدام معرف المهندس سيف
        if user and user.role == 'مدير تنفيذي':
            logging.debug(f"استخدام توقيع المهندس سيف عبد الله (معرف 7) للمدير التنفيذي")
            return user, get_signature_path(user.id)
    
    # إذا لم يتم العثور على سجل اعتماد، ابحث عن أي مستخدم له الدور المطلوب
    users = User.query.filter_by(role=role).all()
    
    # البحث أولاً عن مستخدم له توقيع
    for user in users:
        signature_path = get_signature_path(user.id, default_to_placeholder=False)
        if signature_path and signature_path != PLACEHOLDER_SIGNATURE:
            logging.debug(f"تم العثور على مستخدم له توقيع: {user.username}, مسار التوقيع: {signature_path}")
            return user, signature_path
    
    # إذا لم يتم العثور على مستخدم له توقيع، استخدم أول مستخدم
    if users:
        logging.debug(f"استخدام أول مستخدم في الدور: {users[0].username}")
        return users[0], get_signature_path(users[0].id)
    
    logging.warning(f"لم يتم العثور على أي مستخدم للدور: {role}")
    return None, PLACEHOLDER_SIGNATURE

def get_signatures_for_invoice(invoice):
    """
    الحصول على قاموس يحتوي على توقيعات للمستخلص
    
    Args:
        invoice: كائن المستخلص
    
    Returns:
        قاموس يحتوي على مسارات التوقيعات والمعلومات المتعلقة بها
    """
    from models import User, ApprovalLog
    
    signatures_dict = {}
    
    # التحقق من وجود إعتماد للمستخلص
    if invoice.approval_status == 'معتمد':
        # البحث عن سجلات الاعتماد المتعلقة بالمستخلص
        try:
            approval_logs = ApprovalLog.query.filter_by(
                approval_type='مستخلص',
                reference_id=invoice.id,
                action='معتمد'
            ).order_by(ApprovalLog.created_at.desc()).all()
        except Exception as e:
            logging.error(f"خطأ في البحث عن سجلات الاعتماد للمستخلص: {str(e)}")
            approval_logs = []
        
        # البحث عن المدير الذي قام بالاعتماد
        manager_approval = None
        finance_manager_approval = None
        executive_manager_approval = None
        
        for log in approval_logs:
            try:
                user = User.query.get(log.approved_by)
                if not user:
                    continue
                    
                if user.role == 'مدير':
                    manager_approval = log
                elif user.role == 'مدير مالي':
                    finance_manager_approval = log
                elif user.role == 'مدير تنفيذي':
                    executive_manager_approval = log
            except Exception as e:
                logging.error(f"خطأ في الوصول إلى المستخدم الذي قام بالاعتماد: {str(e)}")
        
        # إضافة توقيع المدير
        if manager_approval:
            try:
                manager = User.query.get(manager_approval.approved_by)
                if manager:
                    signatures_dict['manager'] = {
                        'name': manager.username,
                        'date': manager_approval.created_at.strftime('%Y-%m-%d')
                    }
                    signatures_dict['manager_signature'] = get_signature_path(manager.id)
            except Exception as e:
                logging.error(f"خطأ في الحصول على توقيع المدير: {str(e)}")
        
        # إضافة توقيع المدير المالي
        if finance_manager_approval:
            try:
                finance_manager = User.query.get(finance_manager_approval.approved_by)
                if finance_manager:
                    signatures_dict['finance_manager'] = {
                        'name': finance_manager.username,
                        'date': finance_manager_approval.created_at.strftime('%Y-%m-%d')
                    }
                    signatures_dict['finance_manager_signature'] = get_signature_path(finance_manager.id)
            except Exception as e:
                logging.error(f"خطأ في الحصول على توقيع المدير المالي: {str(e)}")
        
        # إضافة توقيع المدير التنفيذي
        if executive_manager_approval:
            try:
                executive_manager = User.query.get(executive_manager_approval.approved_by)
                if executive_manager:
                    signatures_dict['executive_manager'] = {
                        'name': executive_manager.username,
                        'date': executive_manager_approval.created_at.strftime('%Y-%m-%d')
                    }
                    signatures_dict['executive_manager_signature'] = get_signature_path(executive_manager.id)
            except Exception as e:
                logging.error(f"خطأ في الحصول على توقيع المدير التنفيذي: {str(e)}")
        
        # البحث عن توقيعات افتراضية إذا لم يتم العثور على سجلات اعتماد
        if 'manager_signature' not in signatures_dict:
            manager = User.query.filter_by(role='مدير').first()
            if manager:
                signatures_dict['manager'] = {
                    'name': manager.username,
                    'date': ''
                }
                signatures_dict['manager_signature'] = get_signature_path(manager.id)
        
        if 'finance_manager_signature' not in signatures_dict:
            finance_manager = User.query.filter_by(role='مدير مالي').first()
            if finance_manager:
                signatures_dict['finance_manager'] = {
                    'name': finance_manager.username,
                    'date': ''
                }
                signatures_dict['finance_manager_signature'] = get_signature_path(finance_manager.id)
        
        if 'executive_manager_signature' not in signatures_dict:
            # حالة خاصة للمدير التنفيذي - البحث عن المهندس سيف عبد الله
            executive_manager = User.query.filter_by(id=7).first()  # استخدام معرف المهندس سيف
            if not executive_manager or executive_manager.role != 'مدير تنفيذي':
                executive_manager = User.query.filter_by(role='مدير تنفيذي').first()
            
            if executive_manager:
                signatures_dict['executive_manager'] = {
                    'name': executive_manager.username,
                    'date': ''
                }
                signatures_dict['executive_manager_signature'] = get_signature_path(executive_manager.id)
    
    # إرجاع قاموس التوقيعات
    return signatures_dict

def get_signatures_for_purchase_request(request):
    """
    الحصول على قاموس يحتوي على توقيعات لطلب الشراء
    
    Args:
        request: كائن طلب الشراء
    
    Returns:
        قاموس يحتوي على مسارات التوقيعات والمعلومات المتعلقة بها
    """
    from models import User, ApprovalLog
    
    signatures_dict = {}
    
    # التحقق من وجود إعتماد لطلب الشراء
    if request.status == 'تم التنفيذ':
        # البحث عن سجلات الاعتماد المتعلقة بطلب الشراء
        try:
            approval_logs = ApprovalLog.query.filter_by(
                approval_type='طلب شراء',
                reference_id=request.id,
                action='اعتماد'
            ).order_by(ApprovalLog.created_at.desc()).all()
        except Exception as e:
            logging.error(f"خطأ في البحث عن سجلات الاعتماد لطلب الشراء: {str(e)}")
            approval_logs = []
        
        # البحث عن المدير الذي قام بالاعتماد
        manager_approval = None
        
        for log in approval_logs:
            try:
                user = User.query.get(log.approved_by)
                if not user:
                    continue
                    
                if user.role == 'مدير':
                    manager_approval = log
            except Exception as e:
                logging.error(f"خطأ في الوصول إلى المستخدم الذي قام بالاعتماد: {str(e)}")
        
        # إضافة توقيع المدير
        if manager_approval:
            try:
                manager = User.query.get(manager_approval.approved_by)
                if manager:
                    signatures_dict['manager'] = {
                        'name': manager.username,
                        'date': manager_approval.created_at.strftime('%Y-%m-%d')
                    }
                    signatures_dict['manager_signature'] = get_signature_path(manager.id)
            except Exception as e:
                logging.error(f"خطأ في الحصول على توقيع المدير: {str(e)}")
        
        # البحث عن توقيعات افتراضية إذا لم يتم العثور على سجلات اعتماد
        if 'manager_signature' not in signatures_dict:
            manager = User.query.filter_by(role='مدير').first()
            if manager:
                signatures_dict['manager'] = {
                    'name': manager.username,
                    'date': ''
                }
                signatures_dict['manager_signature'] = get_signature_path(manager.id)
    
    # إضافة توقيع الموظف الذي أنشأ الطلب
    if request.created_by:
        creator = User.query.get(request.created_by)
        if creator:
            signatures_dict['creator'] = {
                'name': creator.username,
                'date': request.created_at.strftime('%Y-%m-%d')
            }
            signatures_dict['creator_signature'] = get_signature_path(creator.id)
    
    # إرجاع قاموس التوقيعات
    return signatures_dict

def get_signatures_for_other_transaction(transaction):
    """
    الحصول على قاموس يحتوي على توقيعات للمعاملة
    
    Args:
        transaction: كائن المعاملة
    
    Returns:
        قاموس يحتوي على مسارات التوقيعات والمعلومات المتعلقة بها
    """
    from models import User, ApprovalLog
    
    signatures_dict = {}
    
    # التحقق من وجود إعتماد للمعاملة
    if transaction.approval_status == 'معتمد':
        # البحث عن سجلات الاعتماد المتعلقة بالمعاملة
        try:
            approval_logs = ApprovalLog.query.filter_by(
                approval_type='معاملة أخرى',
                reference_id=transaction.id,
                action='معتمد'
            ).order_by(ApprovalLog.created_at.desc()).all()
        except Exception as e:
            logging.error(f"خطأ في البحث عن سجلات الاعتماد للمعاملة: {str(e)}")
            approval_logs = []
        
        # البحث عن المدير الذي قام بالاعتماد
        manager_approval = None
        executive_manager_approval = None
        
        for log in approval_logs:
            try:
                user = User.query.get(log.approved_by)
                if not user:
                    continue
                    
                if user.role == 'مدير':
                    manager_approval = log
                elif user.role == 'مدير تنفيذي':
                    executive_manager_approval = log
            except Exception as e:
                logging.error(f"خطأ في الوصول إلى المستخدم الذي قام بالاعتماد: {str(e)}")
        
        # إضافة توقيع المدير
        if manager_approval:
            try:
                manager = User.query.get(manager_approval.approved_by)
                if manager:
                    signatures_dict['manager'] = {
                        'name': manager.username,
                        'date': manager_approval.created_at.strftime('%Y-%m-%d')
                    }
                    signatures_dict['manager_signature'] = get_signature_path(manager.id)
            except Exception as e:
                logging.error(f"خطأ في الحصول على توقيع المدير: {str(e)}")
        
        # إضافة توقيع المدير التنفيذي
        if executive_manager_approval:
            try:
                executive_manager = User.query.get(executive_manager_approval.approved_by)
                if executive_manager:
                    signatures_dict['executive_manager'] = {
                        'name': executive_manager.username,
                        'date': executive_manager_approval.created_at.strftime('%Y-%m-%d')
                    }
                    signatures_dict['executive_manager_signature'] = get_signature_path(executive_manager.id)
            except Exception as e:
                logging.error(f"خطأ في الحصول على توقيع المدير التنفيذي: {str(e)}")
        
        # البحث عن توقيعات افتراضية إذا لم يتم العثور على سجلات اعتماد
        if 'manager_signature' not in signatures_dict:
            manager = User.query.filter_by(role='مدير').first()
            if manager:
                signatures_dict['manager'] = {
                    'name': manager.username,
                    'date': ''
                }
                signatures_dict['manager_signature'] = get_signature_path(manager.id)
        
        if 'executive_manager_signature' not in signatures_dict:
            # حالة خاصة للمدير التنفيذي - البحث عن المهندس سيف عبد الله
            executive_manager = User.query.filter_by(id=7).first()  # استخدام معرف المهندس سيف
            if not executive_manager or executive_manager.role != 'مدير تنفيذي':
                executive_manager = User.query.filter_by(role='مدير تنفيذي').first()
            
            if executive_manager:
                signatures_dict['executive_manager'] = {
                    'name': executive_manager.username,
                    'date': ''
                }
                signatures_dict['executive_manager_signature'] = get_signature_path(executive_manager.id)
    
    # إرجاع قاموس التوقيعات
    return signatures_dict