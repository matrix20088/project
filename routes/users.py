from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app
from flask_login import login_required, current_user
from werkzeug.security import generate_password_hash
from werkzeug.utils import secure_filename
from app import db
from models import User, UserPermission
import os
from datetime import datetime

# الامتدادات المسموح بها لملفات التوقيع
ALLOWED_SIGNATURE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif']

def allowed_signature_file(filename):
    """
    التحقق من أن امتداد الملف مسموح به للتوقيعات
    """
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_SIGNATURE_EXTENSIONS

users_bp = Blueprint('users', __name__, url_prefix='/users')

# عرض جميع المستخدمين
@users_bp.route('/')
@login_required
def index():
    # التحقق من صلاحية المستخدم
    if current_user.role != 'مدير':
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    users = User.query.all()
    return render_template('users/index.html', users=users)

# إضافة مستخدم جديد
@users_bp.route('/add', methods=['GET', 'POST'])
@login_required
def add():
    # التحقق من صلاحية المستخدم
    if current_user.role != 'مدير':
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        username = request.form.get('username')
        password = request.form.get('password')
        email = request.form.get('email')
        phone = request.form.get('phone')
        role = request.form.get('role')
        
        # التحقق من صحة البيانات
        if not username or not password or not email or not role:
            flash('جميع الحقول المطلوبة يجب ملؤها', 'danger')
            return redirect(url_for('users.add'))
        
        # التحقق من أن اسم المستخدم والبريد الإلكتروني غير موجودين مسبقًا
        if User.query.filter_by(username=username).first():
            flash('اسم المستخدم موجود بالفعل', 'danger')
            return redirect(url_for('users.add'))
        
        if User.query.filter_by(email=email).first():
            flash('البريد الإلكتروني موجود بالفعل', 'danger')
            return redirect(url_for('users.add'))
        
        # الحصول على المسمى الوظيفي
        job_title = request.form.get('job_title')
        
        # معالجة ملف التوقيع إذا تم تقديمه
        signature_path = None
        if 'signature' in request.files:
            signature_file = request.files['signature']
            if signature_file and signature_file.filename != '':
                if not allowed_signature_file(signature_file.filename):
                    flash('نوع ملف التوقيع غير مسموح به. الأنواع المسموح بها: ' + ', '.join(ALLOWED_SIGNATURE_EXTENSIONS), 'danger')
                    return redirect(url_for('users.add'))
                
                # حفظ ملف التوقيع
                filename = secure_filename(signature_file.filename)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                new_filename = f"signature_new_{timestamp}_{filename}"
                signature_path = os.path.join('static/uploads/signatures', new_filename)
                
                # التأكد من وجود المجلد
                os.makedirs('static/uploads/signatures', exist_ok=True)
                
                # حفظ الملف
                signature_file.save(signature_path)
        
        # إنشاء مستخدم جديد
        user = User(
            username=username,
            password_hash=generate_password_hash(password),
            email=email,
            phone=phone,
            job_title=job_title,
            signature_path=signature_path,
            role=role
        )
        
        # حفظ المستخدم في قاعدة البيانات
        db.session.add(user)
        db.session.commit()
        
        # إضافة صلاحيات افتراضية للمستخدم
        modules = ['الموردين', 'طلبات الشراء', 'المستخلصات', 'المعاملات الأخرى', 'الاعتمادات', 'التقارير']
        
        for module in modules:
            # تحديد الصلاحيات حسب الدور والوحدة
            if module in ['المستخلصات', 'المعاملات الأخرى']:
                can_create = role in ['مدير', 'محاسب', 'مدير مالي']
                can_update = role in ['مدير', 'محاسب', 'مدير مالي']
                can_delete = role in ['مدير', 'مدير مالي']
            else:
                can_create = role in ['مدير', 'موظف مشتريات', 'محاسب']
                can_update = role in ['مدير', 'موظف مشتريات', 'محاسب']
                can_delete = role in ['مدير']
            
            # الأدوار المسؤولة عن الاعتماد حسب الوحدة
            if module in ['المستخلصات', 'المعاملات الأخرى']:
                approval_roles = ['مدير', 'محاسب', 'مدير مالي', 'مدير تنفيذي']
            else:
                approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي']
                
            can_approve = role in approval_roles
            
            permission = UserPermission(
                user_id=user.id,
                module=module,
                can_create=can_create,
                can_read=True,
                can_update=can_update,
                can_delete=can_delete,
                can_approve=can_approve
            )
            
            db.session.add(permission)
        
        db.session.commit()
        
        flash('تم إضافة المستخدم بنجاح', 'success')
        return redirect(url_for('users.index'))
    
    return render_template('users/add.html')

# عرض تفاصيل المستخدم
@users_bp.route('/view/<int:id>')
@login_required
def view(id):
    # التحقق من صلاحية المستخدم
    if current_user.role != 'مدير' and current_user.id != id:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    user = User.query.get_or_404(id)
    permissions = UserPermission.query.filter_by(user_id=id).all()
    
    return render_template('users/view.html', user=user, permissions=permissions)

# تعديل بيانات المستخدم
@users_bp.route('/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit(id):
    # التحقق من صلاحية المستخدم
    if current_user.role != 'مدير' and current_user.id != id:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    user = User.query.get_or_404(id)
    
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        email = request.form.get('email')
        phone = request.form.get('phone')
        job_title = request.form.get('job_title')
        
        # تحديث الدور فقط إذا كان المستخدم مديرًا
        if current_user.role == 'مدير':
            role = request.form.get('role')
            user.role = role
        
        # التحقق من أن البريد الإلكتروني غير موجود مسبقًا
        if email != user.email and User.query.filter_by(email=email).first():
            flash('البريد الإلكتروني موجود بالفعل', 'danger')
            return redirect(url_for('users.edit', id=id))
        
        # تحديث بيانات المستخدم
        user.email = email
        user.phone = phone
        user.job_title = job_title
        
        # تحديث كلمة المرور إذا تم توفيرها
        password = request.form.get('password')
        if password:
            user.password_hash = generate_password_hash(password)
        
        # معالجة ملف التوقيع إذا تم تقديمه
        if 'signature' in request.files:
            signature_file = request.files['signature']
            if signature_file and signature_file.filename != '':
                if not allowed_signature_file(signature_file.filename):
                    flash('نوع ملف التوقيع غير مسموح به. الأنواع المسموح بها: ' + ', '.join(ALLOWED_SIGNATURE_EXTENSIONS), 'danger')
                    return redirect(url_for('users.edit', id=id))
                
                # حذف ملف التوقيع القديم إذا وجد
                if user.signature_path and os.path.exists(user.signature_path):
                    try:
                        os.remove(user.signature_path)
                    except:
                        pass
                
                # حفظ ملف التوقيع الجديد
                filename = secure_filename(signature_file.filename)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                new_filename = f"signature_{id}_{timestamp}_{filename}"
                signature_path = os.path.join('static/uploads/signatures', new_filename)
                
                # التأكد من وجود المجلد
                os.makedirs('static/uploads/signatures', exist_ok=True)
                
                # حفظ الملف
                signature_file.save(signature_path)
                user.signature_path = signature_path
        
        # حفظ التغييرات
        db.session.commit()
        
        flash('تم تحديث بيانات المستخدم بنجاح', 'success')
        return redirect(url_for('users.view', id=id))
    
    return render_template('users/edit.html', user=user)

# إدارة صلاحيات المستخدم
@users_bp.route('/permissions/<int:id>', methods=['GET', 'POST'])
@login_required
def permissions(id):
    # التحقق من صلاحية المستخدم
    if current_user.role != 'مدير':
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    user = User.query.get_or_404(id)
    
    if request.method == 'POST':
        # الحصول على الوحدات المتاحة
        modules = ['الموردين', 'طلبات الشراء', 'المستخلصات', 'المعاملات الأخرى', 'المشاريع', 'الاعتمادات', 'التقارير']
        
        # حذف الصلاحيات الموجودة
        UserPermission.query.filter_by(user_id=id).delete()
        
        # إضافة الصلاحيات الجديدة
        for module in modules:
            # الحصول على الصلاحيات من النموذج
            can_create = request.form.get(f'{module}_create') == 'on'
            can_read = request.form.get(f'{module}_read') == 'on'
            can_update = request.form.get(f'{module}_update') == 'on'
            can_delete = request.form.get(f'{module}_delete') == 'on'
            can_approve = request.form.get(f'{module}_approve') == 'on'
            
            # إنشاء صلاحية جديدة
            permission = UserPermission(
                user_id=id,
                module=module,
                can_create=can_create,
                can_read=can_read,
                can_update=can_update,
                can_delete=can_delete,
                can_approve=can_approve
            )
            
            db.session.add(permission)
        
        db.session.commit()
        
        flash('تم تحديث صلاحيات المستخدم بنجاح', 'success')
        return redirect(url_for('users.view', id=id))
    
    # الحصول على الصلاحيات الحالية
    permissions = UserPermission.query.filter_by(user_id=id).all()
    
    # تحويل الصلاحيات إلى قاموس للسهولة في العرض
    permissions_dict = {}
    for permission in permissions:
        permissions_dict[permission.module] = {
            'can_create': permission.can_create,
            'can_read': permission.can_read,
            'can_update': permission.can_update,
            'can_delete': permission.can_delete,
            'can_approve': permission.can_approve
        }
    
    return render_template('users/permissions.html', user=user, permissions=permissions_dict)

# تحديث صلاحيات المستخدمين للقوائم الجديدة
@users_bp.route('/update_all_permissions')
@login_required
def update_all_permissions():
    # التحقق من صلاحية المستخدم
    if current_user.role != 'مدير':
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    try:
        # الحصول على جميع المستخدمين
        users = User.query.all()
        
        # الوحدات الجديدة
        new_modules = ['المستخلصات', 'المعاملات الأخرى', 'المشاريع']
        
        for user in users:
            for module in new_modules:
                # التحقق من وجود الصلاحية
                permission = UserPermission.query.filter_by(user_id=user.id, module=module).first()
                
                # إذا لم تكن الصلاحية موجودة، قم بإضافتها
                if not permission:
                    # تحديد الصلاحيات حسب الدور والوحدة
                    if module in ['المستخلصات', 'المعاملات الأخرى', 'المشاريع']:
                        can_create = user.role in ['مدير', 'محاسب', 'مدير مالي']
                        can_update = user.role in ['مدير', 'محاسب', 'مدير مالي']
                        can_delete = user.role in ['مدير', 'مدير مالي']
                        
                        # الأدوار المسؤولة عن الاعتماد
                        approval_roles = ['مدير', 'محاسب', 'مدير مالي', 'مدير تنفيذي']
                        can_approve = user.role in approval_roles
                    else:
                        can_create = user.role in ['مدير', 'موظف مشتريات', 'محاسب']
                        can_update = user.role in ['مدير', 'موظف مشتريات', 'محاسب']
                        can_delete = user.role in ['مدير']
                        
                        # الأدوار المسؤولة عن الاعتماد
                        approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي']
                        can_approve = user.role in approval_roles
                    
                    # إنشاء صلاحية جديدة
                    new_permission = UserPermission(
                        user_id=user.id,
                        module=module,
                        can_create=can_create,
                        can_read=True,
                        can_update=can_update,
                        can_delete=can_delete,
                        can_approve=can_approve
                    )
                    
                    db.session.add(new_permission)
        
        db.session.commit()
        flash('تم تحديث صلاحيات جميع المستخدمين بنجاح', 'success')
    except Exception as e:
        db.session.rollback()
        flash(f'حدث خطأ أثناء تحديث الصلاحيات: {str(e)}', 'danger')
    
    return redirect(url_for('users.index'))

# حذف المستخدم
@users_bp.route('/delete/<int:id>')
@login_required
def delete(id):
    # التحقق من صلاحية المستخدم
    if current_user.role != 'مدير':
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    # التحقق من أن المستخدم ليس المستخدم الحالي
    if id == current_user.id:
        flash('لا يمكن حذف المستخدم الحالي', 'danger')
        return redirect(url_for('users.index'))
    
    user = User.query.get_or_404(id)
    
    try:
        # فحص وجود سجلات في ApprovalLog تشير إلى هذا المستخدم
        from models import ApprovalLog
        approval_logs = ApprovalLog.query.filter_by(approved_by=id).all()
        
        # إذا كان هناك سجلات اعتماد، نقوم بربطها بالمدير الحالي
        if approval_logs:
            for log in approval_logs:
                log.approved_by = current_user.id
                log.comments = f"{log.comments or ''} [تم تعديل المعتمد تلقائيًا بسبب حذف المستخدم الأصلي]"
            db.session.commit()
        
        # فحص وجود سجلات أخرى مرتبطة بالمستخدم
        from models import PurchaseRequest, PurchaseOrder, Invoice, OtherTransaction, InventoryMovement, Inventory
        
        # التحقق من طلبات الشراء
        if PurchaseRequest.query.filter_by(created_by=id).count() > 0:
            flash('لا يمكن حذف المستخدم - يوجد طلبات شراء مرتبطة به', 'danger')
            return redirect(url_for('users.index'))
        
        # التحقق من أوامر الشراء
        if PurchaseOrder.query.filter_by(created_by=id).count() > 0:
            flash('لا يمكن حذف المستخدم - يوجد أوامر شراء مرتبطة به', 'danger')
            return redirect(url_for('users.index'))
        
        # التحقق من الفواتير
        if Invoice.query.filter_by(created_by=id).count() > 0:
            flash('لا يمكن حذف المستخدم - يوجد فواتير مرتبطة به', 'danger')
            return redirect(url_for('users.index'))
        
        # التحقق من المعاملات الأخرى
        if OtherTransaction.query.filter_by(created_by=id).count() > 0:
            flash('لا يمكن حذف المستخدم - يوجد معاملات أخرى مرتبطة به', 'danger')
            return redirect(url_for('users.index'))
        
        # التحقق من حركات المخزون
        if InventoryMovement.query.filter_by(created_by=id).count() > 0:
            flash('لا يمكن حذف المستخدم - يوجد حركات مخزون مرتبطة به', 'danger')
            return redirect(url_for('users.index'))
        
        # التحقق من عمليات الجرد
        if Inventory.query.filter_by(created_by=id).count() > 0:
            flash('لا يمكن حذف المستخدم - يوجد عمليات جرد مرتبطة به', 'danger')
            return redirect(url_for('users.index'))
            
        # حذف صلاحيات المستخدم
        UserPermission.query.filter_by(user_id=id).delete()
        
        # حذف الإشعارات المرتبطة بالمستخدم
        from models import Notification
        Notification.query.filter_by(user_id=id).delete()
        
        # حذف ملف التوقيع إذا وجد
        if user.signature_path and os.path.exists(user.signature_path):
            try:
                os.remove(user.signature_path)
            except:
                pass
        
        # حذف المستخدم
        db.session.delete(user)
        db.session.commit()
        
        flash('تم حذف المستخدم بنجاح', 'success')
        return redirect(url_for('users.index'))
    
    except Exception as e:
        db.session.rollback()
        flash(f'حدث خطأ أثناء حذف المستخدم: {str(e)}', 'danger')
        return redirect(url_for('users.index'))
