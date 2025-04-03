from flask import Blueprint, render_template, redirect, url_for, request, flash
from werkzeug.security import generate_password_hash, check_password_hash
from flask_login import login_user, logout_user, login_required, current_user
from datetime import datetime
import os
import logging
from app import db
from models import User
import signatures

# إعداد التسجيل
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/')
def index():
    # التحقق من أن المستخدم مسجل دخوله بالفعل، وإلا سيتم توجيهه لصفحة تسجيل الدخول
    if current_user.is_authenticated:
        return redirect(url_for('auth.dashboard'))
    # إعادة توجيه المستخدم لصفحة تسجيل الدخول
    return redirect(url_for('auth.login'))

@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    # إجبار تسجيل الخروج قبل تسجيل الدخول من جديد
    if current_user.is_authenticated:
        logout_user()
    
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        user = User.query.filter_by(username=username).first()
        
        # التحقق من صحة اسم المستخدم وكلمة المرور
        if not user or not check_password_hash(user.password_hash, password):
            flash('اسم المستخدم أو كلمة المرور غير صحيحة', 'danger')
            return redirect(url_for('auth.login'))
            
        # تسجيل الدخول للمستخدم
        login_user(user)
        
        # التوجيه إلى الصفحة المطلوبة قبل تسجيل الدخول، أو لوحة التحكم
        next_page = request.args.get('next')
        if next_page:
            return redirect(next_page)
        return redirect(url_for('auth.dashboard'))
        
    return render_template('login.html')

@auth_bp.route('/logout')
@login_required
def logout():
    logout_user()
    return redirect(url_for('auth.login'))

@auth_bp.route('/dashboard')
@login_required
def dashboard():
    # معلومات لعرضها في لوحة التحكم
    from models import Supplier, PurchaseRequest, PurchaseOrder, Project
    from app import db
    from sqlalchemy import func
    
    logger.debug("بدأ تحميل لوحة التحكم")
    
    # إحصائيات سريعة للعرض على لوحة التحكم مع استخدام استعلامات أكثر أمانًا
    suppliers_count = db.session.query(func.count(Supplier.id)).scalar() or 0
    purchase_requests_count = db.session.query(func.count(PurchaseRequest.id)).scalar() or 0
    pending_orders_count = db.session.query(func.count(PurchaseOrder.id)).filter(
        PurchaseOrder.approval_status == 'قيد الانتظار'
    ).scalar() or 0
    orders_count = db.session.query(func.count(PurchaseOrder.id)).scalar() or 0
    
    logger.debug(f"تم الحصول على الإحصائيات: الموردين={suppliers_count}, طلبات الشراء={purchase_requests_count}, أوامر قيد الانتظار={pending_orders_count}, إجمالي أوامر الشراء={orders_count}")
    
    # طلبات الشراء الأخيرة
    try:
        # جلب طلبات الشراء (بطريقة أبسط لتفادي أي أخطاء)
        recent_requests = db.session.query(PurchaseRequest).order_by(
            PurchaseRequest.created_at.desc()
        ).limit(5).all()
        logger.debug(f"تم الحصول على {len(recent_requests)} طلب شراء حديث")
    except Exception as e:
        logger.error(f"خطأ في جلب طلبات الشراء الحديثة: {str(e)}")
        recent_requests = []
    
    # إضافة معلومات إضافية لطلبات الشراء
    for i, request in enumerate(recent_requests):
        try:
            # الحصول على اسم المادة من أول عنصر في طلب الشراء
            request.item_name = 'غير محدد'
            if request.items and len(request.items) > 0:
                request.item_name = request.items[0].item_name
            
            # جلب اسم المشروع للعرض في الجدول
            # استخدام project_name مباشرة بدلاً من محاولة البحث عن المشروع باستخدام project_id
            if not hasattr(request, 'project_name') or not request.project_name:
                # إذا لم يكن لديه project_name أو القيمة فارغة، نضبطه على "غير محدد"
                request.project_name = 'غير محدد'
            
            # إضافة اسم مقدم الطلب
            if hasattr(request, 'created_by') and request.created_by:
                try:
                    # جلب بيانات المستخدم مقدم الطلب
                    from models import User
                    user = db.session.query(User).get(request.created_by)
                    request.requester_name = user.username if user else 'غير محدد'
                except Exception as user_err:
                    logger.error(f"خطأ في جلب معلومات مقدم الطلب: {str(user_err)}")
                    request.requester_name = 'غير محدد'
            else:
                request.requester_name = 'غير محدد'
            
            logger.debug(f"طلب شراء {request.request_number} - المشروع: {request.project_name}, مقدم الطلب: {request.requester_name}")
            
            # تسجيل المعلومات
            logger.debug(f"طلب {i+1}: رقم الطلب: {request.request_number}, المشروع: {request.project_name}, مقدم الطلب: {request.requester_name}")
        except Exception as e:
            logger.error(f"خطأ في معالجة طلب الشراء {request.id}: {str(e)}")
            request.item_name = 'غير محدد'
            request.project_name = 'غير محدد'
            request.requester_name = 'غير محدد'
    
    # أوامر الشراء قيد الانتظار
    try:
        # جلب أوامر الشراء قيد الانتظار (بطريقة أبسط لتفادي أي أخطاء)
        pending_orders = db.session.query(PurchaseOrder).filter(
            PurchaseOrder.approval_status == 'قيد الانتظار'
        ).order_by(
            PurchaseOrder.created_at.desc()
        ).limit(5).all()
        logger.debug(f"تم الحصول على {len(pending_orders)} أمر شراء قيد الانتظار")
    except Exception as e:
        logger.error(f"خطأ في جلب أوامر الشراء قيد الانتظار: {str(e)}")
        pending_orders = []
    
    # إضافة معلومات إضافية لأوامر الشراء
    for i, order in enumerate(pending_orders):
        try:
            # الحصول على اسم المادة من أول عنصر في أمر الشراء
            order.item_name = 'غير محدد'
            if order.items and len(order.items) > 0:
                order.item_name = order.items[0].item_name
            
            # جلب اسم المورد للعرض في الجدول
            if hasattr(order, 'supplier_id') and order.supplier_id:
                try:
                    # إذا كان هناك مورد متصل بأمر الشراء
                    from models import Supplier
                    supplier = db.session.query(Supplier).get(order.supplier_id)
                    order.supplier_name = supplier.name if supplier else 'غير محدد'
                except Exception as supp_err:
                    logger.error(f"خطأ في جلب معلومات المورد: {str(supp_err)}")
                    order.supplier_name = 'غير محدد'
            else:
                order.supplier_name = 'غير محدد'
            
            # جلب اسم المشروع للعرض في الجدول
            if hasattr(order, 'project_id') and order.project_id:
                try:
                    # إذا كان هناك مشروع متصل بأمر الشراء
                    from models import Project
                    project = db.session.query(Project).get(order.project_id)
                    order.project_name = project.name if project else 'غير محدد'
                except Exception as proj_err:
                    logger.error(f"خطأ في جلب معلومات المشروع: {str(proj_err)}")
                    order.project_name = 'غير محدد'
            else:
                order.project_name = 'غير محدد'
            
            # إضافة اسم منشئ الأمر (مقدم الطلب)
            if hasattr(order, 'created_by') and order.created_by:
                try:
                    # جلب بيانات المستخدم منشئ الأمر
                    from models import User
                    user = db.session.query(User).get(order.created_by)
                    order.creator_name = user.username if user else 'غير محدد'
                except Exception as user_err:
                    logger.error(f"خطأ في جلب معلومات منشئ الأمر: {str(user_err)}")
                    order.creator_name = 'غير محدد'
            else:
                order.creator_name = 'غير محدد'
            
            # تسجيل المعلومات
            logger.debug(f"أمر {i+1}: رقم الأمر: {order.order_number}, المورد: {order.supplier_name}, المشروع: {order.project_name}, منشئ الأمر: {order.creator_name}")
        except Exception as e:
            logger.error(f"خطأ في معالجة أمر الشراء {order.id}: {str(e)}")
            order.item_name = 'غير محدد'
            order.supplier_name = 'غير محدد'
            order.project_name = 'غير محدد'
            order.creator_name = 'غير محدد'
    
    return render_template(
        'dashboard.html',
        suppliers_count=suppliers_count,
        purchase_requests_count=purchase_requests_count,
        pending_orders_count=pending_orders_count,
        orders_count=orders_count,
        recent_requests=recent_requests,
        pending_orders=pending_orders
    )

@auth_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    if request.method == 'POST':
        # تحديث معلومات الملف الشخصي
        email = request.form.get('email')
        phone = request.form.get('phone')
        current_password = request.form.get('current_password')
        new_password = request.form.get('new_password')
        
        # التحقق من تغيير كلمة المرور
        if current_password and new_password:
            if not check_password_hash(current_user.password_hash, current_password):
                flash('كلمة المرور الحالية غير صحيحة', 'danger')
                return redirect(url_for('auth.profile'))
            
            current_user.password_hash = generate_password_hash(new_password)
            flash('تم تحديث كلمة المرور بنجاح', 'success')
        
        # تحديث البريد الإلكتروني ورقم الهاتف
        if email != current_user.email:
            # التحقق من أن البريد الإلكتروني غير مستخدم من قبل
            if db.session.query(User.id).filter(User.email == email, User.id != current_user.id).first():
                flash('البريد الإلكتروني مستخدم بالفعل', 'danger')
                return redirect(url_for('auth.profile'))
            
            current_user.email = email
        
        current_user.phone = phone
        
        # معالجة ملف التوقيع إذا تم رفعه
        signature_file = request.files.get('signature')
        if signature_file and signature_file.filename:
            # استخدام وحدة التوقيعات الجديدة لحفظ ملف التوقيع
            signature_path = signatures.save_signature(current_user.id, signature_file)
            
            if signature_path:
                # تحديث مسار التوقيع في قاعدة البيانات
                current_user.signature_path = signature_path
                flash('تم رفع ملف التوقيع بنجاح', 'success')
            else:
                flash('نوع الملف غير مسموح به. يرجى استخدام PNG، JPEG، أو GIF', 'danger')
        
        db.session.commit()
        flash('تم تحديث الملف الشخصي بنجاح', 'success')
        return redirect(url_for('auth.profile'))
    
    # الحصول على مسار توقيع المستخدم الحالي للعرض
    user_signature_path = signatures.get_signature_path(current_user.id, default_to_placeholder=False)
    
    return render_template('profile.html', user_signature_path=user_signature_path)
