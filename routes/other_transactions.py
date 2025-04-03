from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, current_app
from flask_login import login_required, current_user
import os
import uuid
from datetime import datetime
import json
from sqlalchemy import desc, func, or_
from app import db
from werkzeug.utils import secure_filename
from models import OtherTransaction, ApprovalLog, Project
import signatures
from notifications import send_notification, check_similar_notification

# إنشاء Blueprint للمعاملات الأخرى
other_transactions_bp = Blueprint('other_transactions', __name__, url_prefix='/other-transactions')

def transaction_to_dict(transaction):
    """تحويل كائن المعاملة إلى قاموس للعرض"""
    return {
        'id': transaction.id,
        'transaction_number': transaction.transaction_number,
        'transaction_date': transaction.transaction_date,
        'transaction_type': transaction.transaction_type,
        'description': transaction.description,
        'amount': transaction.amount,
        'vat_inclusive': transaction.vat_inclusive,
        'approval_status': transaction.approval_status,
        'status': transaction.approval_status,  # تكرار للتوافق مع الواجهة
        'username': transaction.creator.username if transaction.creator else "غير معروف"
    }

# الدليل الذي سيتم فيه تخزين المرفقات
UPLOAD_FOLDER = 'static/uploads/other_transactions'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# الصيغ المسموح بها للمرفقات
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx'}

def allowed_file(filename):
    """التحقق مما إذا كان الملف مسموحًا به"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@other_transactions_bp.route('/', methods=['GET'])
@login_required
def index():
    """عرض قائمة المعاملات"""
    # الحصول على جميع المعاملات
    pending_transactions = OtherTransaction.query.filter_by(approval_status='قيد الانتظار').order_by(desc(OtherTransaction.created_at)).all()
    approved_transactions = OtherTransaction.query.filter_by(approval_status='معتمد').order_by(desc(OtherTransaction.created_at)).all()
    rejected_transactions = OtherTransaction.query.filter_by(approval_status='مرفوض').order_by(desc(OtherTransaction.created_at)).all()
    all_transactions = OtherTransaction.query.order_by(desc(OtherTransaction.created_at)).all()
    
    # إنشاء قائمة المعاملات مع اسم المستخدم
    all_transactions_with_username = []
    for transaction in all_transactions:
        transaction_dict = transaction_to_dict(transaction)
        all_transactions_with_username.append(transaction_dict)
    
    pending_transactions_with_username = []
    for transaction in pending_transactions:
        transaction_dict = transaction_to_dict(transaction)
        pending_transactions_with_username.append(transaction_dict)
    
    approved_transactions_with_username = []
    for transaction in approved_transactions:
        transaction_dict = transaction_to_dict(transaction)
        approved_transactions_with_username.append(transaction_dict)
    
    rejected_transactions_with_username = []
    for transaction in rejected_transactions:
        transaction_dict = transaction_to_dict(transaction)
        rejected_transactions_with_username.append(transaction_dict)
    
    # تمرير القوائم المختلفة إلى القالب
    return render_template('other_transactions/index.html',
                          pending_transactions=pending_transactions_with_username,
                          approved_transactions=approved_transactions_with_username,
                          rejected_transactions=rejected_transactions_with_username,
                          all_transactions=all_transactions_with_username)

@other_transactions_bp.route('/add', methods=['GET', 'POST'])
@login_required
def add_transaction():
    """إضافة معاملة جديدة"""
    if request.method == 'POST':
        # استخراج البيانات من النموذج
        transaction_number = request.form.get('transaction_number', '')
        transaction_date = request.form.get('transaction_date')
        transaction_type = request.form.get('transaction_type')
        description = request.form.get('description', '')
        project_name = request.form.get('project_name', '')
        amount = request.form.get('amount', '')
        vat_inclusive = 'vat_inclusive' in request.form
        
        # التحقق من البيانات المطلوبة
        if not all([transaction_date, transaction_type]):
            flash('يرجى ملء جميع الحقول المطلوبة.', 'danger')
            return redirect(url_for('other_transactions.add_transaction'))
        
        # معالجة رقم المعاملة
        if not transaction_number:
            # إنشاء رقم معاملة فريد باستخدام إعدادات التسلسل
            try:
                from models import SequenceSettings
                next_number, prefix = SequenceSettings.get_next_number('other_transaction')
                transaction_number = f"{prefix or 'TX-'}{next_number}"
            except Exception as e:
                # في حالة حدوث خطأ، استخدم الطريقة القديمة كإجراء احتياطي
                import logging
                logging.error(f"خطأ في توليد رقم المعاملة: {str(e)}")
                transaction_number = f"TX-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        
        # تحويل البيانات إلى الأنواع المناسبة
        try:
            transaction_date = datetime.strptime(transaction_date, '%Y-%m-%d').date()
        except ValueError:
            flash('تنسيق التاريخ غير صحيح.', 'danger')
            return redirect(url_for('other_transactions.add_transaction'))
        
        # معالجة الملف المرفق إذا وجد
        attachment_path = None
        if 'attachment' in request.files:
            file = request.files['attachment']
            if file and file.filename and allowed_file(file.filename):
                # تأمين اسم الملف
                secure_name = f"{uuid.uuid4().hex}.{file.filename.rsplit('.', 1)[1].lower()}"
                attachment_path = f"{UPLOAD_FOLDER}/{secure_name}"
                file.save(attachment_path)
        
        # البحث عن المشروع إذا تم تحديده
        project = None
        if project_name:
            project = Project.query.filter_by(name=project_name).first()

        # تحويل المبلغ إلى رقم عشري
        amount_float = None
        if amount:
            try:
                amount_float = float(amount)
            except ValueError:
                flash('قيمة المبلغ غير صالحة، يرجى إدخال رقم صحيح.', 'danger')
                return redirect(url_for('other_transactions.add_transaction'))
        
        # إنشاء سجل المعاملة الجديد
        new_transaction = OtherTransaction(
            transaction_number=transaction_number,
            transaction_date=transaction_date,
            transaction_type=transaction_type,
            description=description,
            amount=amount_float,
            vat_inclusive=vat_inclusive,
            project_name=project_name if project_name else None,
            project_id=project.id if project else None,
            attachment_path=attachment_path,
            approval_status='قيد الانتظار',
            created_by=current_user.id
        )
        
        # حفظ السجل في قاعدة البيانات
        db.session.add(new_transaction)
        db.session.commit()
        
        # إرسال إشعار للمديرين
        from models import User
        managers = User.query.filter(User.role.in_(['مدير', 'مدير تنفيذي'])).all()
        
        for manager in managers:
            if not check_similar_notification(manager.id, 'معاملة', new_transaction.id):
                send_notification(
                    db,
                    current_app.extensions['socketio'],
                    manager.id,
                    'معاملة جديدة بانتظار الاعتماد',
                    f'تم إنشاء معاملة جديدة ({transaction_number}) من نوع {transaction_type} بواسطة {current_user.username}',
                    'معاملة',
                    'OtherTransaction',
                    new_transaction.id,
                    url_for('other_transactions.view_transaction', id=new_transaction.id)
                )
        
        flash('تم إضافة المعاملة بنجاح.', 'success')
        return redirect(url_for('other_transactions.view_transaction', id=new_transaction.id))
    
    # الحصول على قائمة المشاريع لعرضها في القائمة المنسدلة
    projects = Project.query.order_by(Project.name).all()
    
    # عرض نموذج إضافة معاملة
    return render_template('other_transactions/add.html', projects=projects)

@other_transactions_bp.route('/<int:id>', methods=['GET'])
@login_required
def view_transaction(id):
    """عرض تفاصيل المعاملة"""
    transaction = OtherTransaction.query.get_or_404(id)
    
    # التحقق مما إذا كان هذا طلب طباعة
    if request.args.get('print') == '1':
        # الحصول على التوقيعات
        signatures_dict = signatures.get_signatures_for_other_transaction(transaction)
        return render_template('other_transactions/print.html', transaction=transaction, signatures_dict=signatures_dict)
    
    # عرض صفحة تفاصيل المعاملة
    return render_template('other_transactions/view.html', transaction=transaction)

@other_transactions_bp.route('/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_transaction(id):
    """تعديل المعاملة"""
    transaction = OtherTransaction.query.get_or_404(id)
    
    # التحقق مما إذا كانت المعاملة قابلة للتعديل
    if transaction.approval_status != 'قيد الانتظار':
        flash('لا يمكن تعديل هذه المعاملة لأنها تم اعتمادها أو رفضها بالفعل.', 'warning')
        return redirect(url_for('other_transactions.view_transaction', id=id))
    
    if request.method == 'POST':
        # استخراج البيانات من النموذج
        transaction_number = request.form.get('transaction_number')
        transaction_date = request.form.get('transaction_date')
        transaction_type = request.form.get('transaction_type')
        description = request.form.get('description', '')
        project_name = request.form.get('project_name', '')
        amount = request.form.get('amount', '')
        vat_inclusive = 'vat_inclusive' in request.form
        
        # التحقق من البيانات المطلوبة
        if not all([transaction_date, transaction_type]):
            flash('يرجى ملء جميع الحقول المطلوبة.', 'danger')
            return redirect(url_for('other_transactions.edit_transaction', id=id))
        
        # تحويل البيانات إلى الأنواع المناسبة
        try:
            transaction_date = datetime.strptime(transaction_date, '%Y-%m-%d').date()
        except ValueError:
            flash('تنسيق التاريخ غير صحيح.', 'danger')
            return redirect(url_for('other_transactions.edit_transaction', id=id))
        
        # معالجة الملف المرفق إذا وجد
        if 'attachment' in request.files:
            file = request.files['attachment']
            if file and file.filename and allowed_file(file.filename):
                # تأمين اسم الملف
                secure_name = f"{uuid.uuid4().hex}.{file.filename.rsplit('.', 1)[1].lower()}"
                attachment_path = f"{UPLOAD_FOLDER}/{secure_name}"
                file.save(attachment_path)
                
                # حذف الملف القديم إذا وجد
                if transaction.attachment_path and os.path.exists(transaction.attachment_path):
                    os.remove(transaction.attachment_path)
                
                # تحديث مسار الملف
                transaction.attachment_path = attachment_path
        
        # تحويل المبلغ إلى رقم عشري
        amount_float = None
        if amount:
            try:
                amount_float = float(amount)
            except ValueError:
                flash('قيمة المبلغ غير صالحة، يرجى إدخال رقم صحيح.', 'danger')
                return redirect(url_for('other_transactions.edit_transaction', id=id))
        
        # البحث عن المشروع إذا تم تحديده
        project = None
        if project_name:
            project = Project.query.filter_by(name=project_name).first()
            
        # تحديث بيانات المعاملة
        transaction.transaction_number = transaction_number
        transaction.transaction_date = transaction_date
        transaction.transaction_type = transaction_type
        transaction.description = description
        transaction.amount = amount_float
        transaction.vat_inclusive = vat_inclusive
        transaction.project_name = project_name if project_name else None
        transaction.project_id = project.id if project else None
        
        # حفظ التغييرات
        db.session.commit()
        
        flash('تم تحديث المعاملة بنجاح.', 'success')
        return redirect(url_for('other_transactions.view_transaction', id=id))
    
    # الحصول على قائمة المشاريع لعرضها في القائمة المنسدلة
    projects = Project.query.order_by(Project.name).all()
    
    # عرض نموذج تعديل المعاملة
    return render_template('other_transactions/edit.html', transaction=transaction, projects=projects)

@other_transactions_bp.route('/<int:id>/status', methods=['POST'])
@login_required
def change_status(id):
    """تغيير حالة المعاملة"""
    transaction = OtherTransaction.query.get_or_404(id)
    
    # التحقق من الصلاحيات
    if current_user.role not in ['مدير', 'مدير تنفيذي']:
        flash('ليس لديك صلاحية لتغيير حالة المعاملة.', 'danger')
        return redirect(url_for('other_transactions.view_transaction', id=id))
    
    # استخراج البيانات من النموذج
    status = request.form.get('status')
    comments = request.form.get('comments', '')
    
    if status not in ['قيد الانتظار', 'معتمد', 'مرفوض']:
        flash('حالة الاعتماد غير صالحة.', 'danger')
        return redirect(url_for('other_transactions.view_transaction', id=id))
    
    # تحديث حالة المعاملة
    old_status = transaction.approval_status
    transaction.approval_status = status
    
    # إضافة سجل الاعتماد
    approval_log = ApprovalLog(
        approval_type='معاملة أخرى',
        reference_id=transaction.id,
        action=status,
        approved_by=current_user.id,
        comments=comments
    )
    
    db.session.add(approval_log)
    db.session.commit()
    
    # إرسال إشعار لمنشئ المعاملة
    if old_status != status:
        status_text = "اعتماد" if status == "معتمد" else "رفض" if status == "مرفوض" else "تعليق"
        send_notification(
            db,
            current_app.extensions['socketio'],
            transaction.created_by,
            f'تم {status_text} المعاملة',
            f'تم {status_text} المعاملة {transaction.transaction_number} من قبل {current_user.username} {comments}',
            'معاملة',
            'OtherTransaction',
            transaction.id,
            url_for('other_transactions.view_transaction', id=transaction.id)
        )
    
    flash(f'تم تغيير حالة المعاملة إلى {status}.', 'success')
    return redirect(url_for('other_transactions.view_transaction', id=id))

@other_transactions_bp.route('/search', methods=['GET'])
@login_required
def search_transactions():
    """البحث في المعاملات"""
    query = request.args.get('query', '')
    
    if not query:
        return redirect(url_for('other_transactions.index'))
    
    # البحث في المعاملات
    transactions = OtherTransaction.query.filter(
        or_(
            OtherTransaction.transaction_number.contains(query),
            OtherTransaction.transaction_type.contains(query),
            OtherTransaction.description.contains(query)
        )
    ).order_by(desc(OtherTransaction.created_at)).all()
    
    # تحضير قائمة المعاملات مع أسماء المستخدمين
    transactions_with_username = []
    for transaction in transactions:
        transaction_dict = transaction_to_dict(transaction)
        transactions_with_username.append(transaction_dict)
    
    return render_template('other_transactions/search_results.html', 
                           transactions=transactions_with_username, 
                           query=query,
                           count=len(transactions_with_username))