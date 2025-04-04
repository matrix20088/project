from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify, current_app
from flask_login import login_required, current_user
import os
import uuid
from datetime import datetime
import json
from sqlalchemy import desc, func, or_
from app import db
from werkzeug.utils import secure_filename
from models import Invoice, ApprovalLog, Project
import signatures
from notifications import send_notification, check_similar_notification

# إنشاء Blueprint للمستخلصات
invoices_bp = Blueprint('invoices', __name__, url_prefix='/invoices')

# الدليل الذي سيتم فيه تخزين المرفقات
UPLOAD_FOLDER = 'static/uploads/invoices'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

# الصيغ المسموح بها للمرفقات
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'doc', 'docx', 'xls', 'xlsx'}

def allowed_file(filename):
    """التحقق مما إذا كان الملف مسموحًا به"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@invoices_bp.route('/', methods=['GET'])
@login_required
def index():
    """عرض قائمة المستخلصات"""
    # الحصول على جميع المستخلصات
    pending_invoices = Invoice.query.filter_by(approval_status='قيد الانتظار').order_by(desc(Invoice.created_at)).all()
    approved_invoices = Invoice.query.filter_by(approval_status='معتمد').order_by(desc(Invoice.created_at)).all()
    rejected_invoices = Invoice.query.filter_by(approval_status='مرفوض').order_by(desc(Invoice.created_at)).all()
    all_invoices = Invoice.query.order_by(desc(Invoice.created_at)).all()

    # إنشاء قائمة المستخلصات مع اسم المستخدم
    all_invoices_with_username = []
    for invoice in all_invoices:
        invoice_dict = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'invoice_date': invoice.invoice_date,
            'invoice_amount': invoice.invoice_amount,
            'project_name': invoice.project_name,
            'description': invoice.description,
            'approval_status': invoice.approval_status,
            'status': invoice.approval_status,  # تكرار للتوافق مع الواجهة
            'username': invoice.creator.username if invoice.creator else "غير معروف"
        }
        all_invoices_with_username.append(invoice_dict)

    pending_invoices_with_username = []
    for invoice in pending_invoices:
        invoice_dict = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'invoice_date': invoice.invoice_date,
            'invoice_amount': invoice.invoice_amount,
            'project_name': invoice.project_name,
            'description': invoice.description,
            'approval_status': invoice.approval_status,
            'status': invoice.approval_status,  # تكرار للتوافق مع الواجهة
            'username': invoice.creator.username if invoice.creator else "غير معروف"
        }
        pending_invoices_with_username.append(invoice_dict)

    approved_invoices_with_username = []
    for invoice in approved_invoices:
        invoice_dict = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'invoice_date': invoice.invoice_date,
            'invoice_amount': invoice.invoice_amount,
            'project_name': invoice.project_name,
            'description': invoice.description,
            'approval_status': invoice.approval_status,
            'status': invoice.approval_status,  # تكرار للتوافق مع الواجهة
            'username': invoice.creator.username if invoice.creator else "غير معروف"
        }
        approved_invoices_with_username.append(invoice_dict)

    rejected_invoices_with_username = []
    for invoice in rejected_invoices:
        invoice_dict = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'invoice_date': invoice.invoice_date,
            'invoice_amount': invoice.invoice_amount,
            'project_name': invoice.project_name,
            'description': invoice.description,
            'approval_status': invoice.approval_status,
            'status': invoice.approval_status,  # تكرار للتوافق مع الواجهة
            'username': invoice.creator.username if invoice.creator else "غير معروف"
        }
        rejected_invoices_with_username.append(invoice_dict)

    # تمرير القوائم المختلفة إلى القالب
    return render_template('invoices/index.html',
                          pending_invoices=pending_invoices_with_username,
                          approved_invoices=approved_invoices_with_username,
                          rejected_invoices=rejected_invoices_with_username,
                          all_invoices=all_invoices_with_username)

@invoices_bp.route('/add', methods=['GET', 'POST'])
@login_required
def add_invoice():
    """إضافة مستخلص جديد"""
    if request.method == 'POST':
        # استخراج البيانات من النموذج
        invoice_number = request.form.get('invoice_number', '')
        invoice_date = request.form.get('invoice_date')
        invoice_amount = request.form.get('invoice_amount')
        project_name = request.form.get('project_name')
        description = request.form.get('description', '')

        # التحقق من البيانات المطلوبة
        if not all([invoice_date, invoice_amount, project_name]):
            flash('يرجى ملء جميع الحقول المطلوبة.', 'danger')
            return redirect(url_for('invoices.add_invoice'))

        # معالجة رقم المستخلص
        if not invoice_number:
            # إنشاء رقم مستخلص فريد باستخدام إعدادات التسلسل
            try:
                from models import SequenceSettings
                next_number, prefix = SequenceSettings.get_next_number('invoice')
                invoice_number = f"{prefix or 'INV-'}{next_number}"
            except Exception as e:
                # في حالة حدوث خطأ، استخدم الطريقة القديمة كإجراء احتياطي
                import logging
                logging.error(f"خطأ في توليد رقم المستخلص: {str(e)}")
                invoice_number = f"INV-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"

        # تحويل البيانات إلى الأنواع المناسبة
        try:
            invoice_date = datetime.strptime(invoice_date, '%Y-%m-%d').date()
            invoice_amount = float(invoice_amount)
        except ValueError:
            flash('تنسيق التاريخ أو المبلغ غير صحيح.', 'danger')
            return redirect(url_for('invoices.add_invoice'))

        # معالجة الملف المرفق إذا وجد
        attachment_path = None
        if 'attachment' in request.files:
            file = request.files['attachment']
            if file and file.filename and allowed_file(file.filename):
                # تأمين اسم الملف
                secure_name = f"{uuid.uuid4().hex}.{file.filename.rsplit('.', 1)[1].lower()}"
                attachment_path = f"{UPLOAD_FOLDER}/{secure_name}"
                file.save(attachment_path)

        # إنشاء سجل المستخلص الجديد
        new_invoice = Invoice(
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            project_name=project_name,
            invoice_amount=invoice_amount,
            description=description,
            attachment_path=attachment_path,
            approval_status='قيد الانتظار',
            created_by=current_user.id
        )

        # حفظ السجل في قاعدة البيانات
        db.session.add(new_invoice)
        db.session.commit()

        # إرسال إشعار للمديرين
        from models import User
        managers = User.query.filter(User.role.in_(['مدير', 'مدير مالي', 'مدير تنفيذي'])).all()

        for manager in managers:
            if not check_similar_notification(manager.id, 'مستخلص', new_invoice.id):
                send_notification(
                    db,
                    current_app.extensions['socketio'],
                    manager.id,
                    'مستخلص جديد بانتظار الاعتماد',
                    f'تم إنشاء مستخلص جديد ({invoice_number}) بمبلغ {invoice_amount} ريال بواسطة {current_user.username}',
                    'مستخلص',
                    'Invoice',
                    new_invoice.id,
                    url_for('invoices.view_invoice', id=new_invoice.id)
                )

        flash('تم إضافة المستخلص بنجاح.', 'success')
        return redirect(url_for('invoices.view_invoice', id=new_invoice.id))

    # الحصول على قائمة المشاريع لعرضها في القائمة المنسدلة
    projects = Project.query.order_by(Project.name).all()
    
    # عرض نموذج إضافة مستخلص
    return render_template('invoices/add.html', projects=projects)

@invoices_bp.route('/<int:id>', methods=['GET'])
@login_required
def view_invoice(id):
    """عرض تفاصيل المستخلص"""
    invoice = Invoice.query.get_or_404(id)

    # التحقق مما إذا كان هذا طلب طباعة
    if request.args.get('print') == '1':
        # الحصول على التوقيعات
        signatures_dict = signatures.get_signatures_for_invoice(invoice)
        return render_template('invoices/print.html', invoice=invoice, signatures_dict=signatures_dict)

    # عرض صفحة تفاصيل المستخلص
    return render_template('invoices/view.html', invoice=invoice)

@invoices_bp.route('/<int:id>/edit', methods=['GET', 'POST'])
@login_required
def edit_invoice(id):
    """تعديل المستخلص"""
    invoice = Invoice.query.get_or_404(id)

    # التحقق مما إذا كان المستخلص قابلاً للتعديل
    if invoice.approval_status != 'قيد الانتظار':
        flash('لا يمكن تعديل هذا المستخلص لأنه تم اعتماده أو رفضه بالفعل.', 'warning')
        return redirect(url_for('invoices.view_invoice', id=id))

    if request.method == 'POST':
        # استخراج البيانات من النموذج
        invoice_number = request.form.get('invoice_number')
        invoice_date = request.form.get('invoice_date')
        invoice_amount = request.form.get('invoice_amount')
        project_name = request.form.get('project_name')
        description = request.form.get('description', '')

        # التحقق من البيانات المطلوبة
        if not all([invoice_date, invoice_amount, project_name]):
            flash('يرجى ملء جميع الحقول المطلوبة.', 'danger')
            return redirect(url_for('invoices.edit_invoice', id=id))

        # تحويل البيانات إلى الأنواع المناسبة
        try:
            invoice_date = datetime.strptime(invoice_date, '%Y-%m-%d').date()
            invoice_amount = float(invoice_amount)
        except ValueError:
            flash('تنسيق التاريخ أو المبلغ غير صحيح.', 'danger')
            return redirect(url_for('invoices.edit_invoice', id=id))

        # معالجة الملف المرفق إذا وجد
        if 'attachment' in request.files:
            file = request.files['attachment']
            if file and file.filename and allowed_file(file.filename):
                # تأمين اسم الملف
                secure_name = f"{uuid.uuid4().hex}.{file.filename.rsplit('.', 1)[1].lower()}"
                attachment_path = f"{UPLOAD_FOLDER}/{secure_name}"
                file.save(attachment_path)

                # حذف الملف القديم إذا وجد
                if invoice.attachment_path and os.path.exists(invoice.attachment_path):
                    os.remove(invoice.attachment_path)

                # تحديث مسار الملف
                invoice.attachment_path = attachment_path

        # تحديث بيانات المستخلص
        invoice.invoice_number = invoice_number
        invoice.invoice_date = invoice_date
        invoice.invoice_amount = invoice_amount
        invoice.project_name = project_name
        invoice.description = description

        # حفظ التغييرات
        db.session.commit()

        flash('تم تحديث المستخلص بنجاح.', 'success')
        return redirect(url_for('invoices.view_invoice', id=id))

    # الحصول على قائمة المشاريع لعرضها في القائمة المنسدلة
    projects = Project.query.order_by(Project.name).all()
    
    # عرض نموذج تعديل المستخلص
    return render_template('invoices/edit.html', invoice=invoice, projects=projects)

@invoices_bp.route('/<int:id>/status', methods=['POST'])
@login_required
def change_status(id):
    """تغيير حالة المستخلص"""
    invoice = Invoice.query.get_or_404(id)

    # التحقق من الصلاحيات
    if current_user.role not in ['مدير', 'مدير مالي', 'مدير تنفيذي']:
        flash('ليس لديك صلاحية لتغيير حالة المستخلص.', 'danger')
        return redirect(url_for('invoices.view_invoice', id=id))

    # استخراج البيانات من النموذج
    status = request.form.get('status')
    comments = request.form.get('comments', '')

    if status not in ['قيد الانتظار', 'معتمد', 'مرفوض']:
        flash('حالة الاعتماد غير صالحة.', 'danger')
        return redirect(url_for('invoices.view_invoice', id=id))

    # تحديث حالة المستخلص
    old_status = invoice.approval_status
    invoice.approval_status = status

    # إضافة سجل الاعتماد
    approval_log = ApprovalLog(
        approval_type='مستخلص',
        reference_id=invoice.id,
        action=status,
        approved_by=current_user.id,
        comments=comments
    )

    db.session.add(approval_log)
    db.session.commit()

    # إرسال إشعار لمنشئ المستخلص
    if old_status != status:
        status_text = "اعتماد" if status == "معتمد" else "رفض" if status == "مرفوض" else "تعليق"
        send_notification(
            db,
            current_app.extensions['socketio'],
            invoice.created_by,
            f'تم {status_text} المستخلص',
            f'تم {status_text} المستخلص {invoice.invoice_number} من قبل {current_user.username} {comments}',
            'مستخلص',
            'Invoice',
            invoice.id,
            url_for('invoices.view_invoice', id=invoice.id)
        )

    flash(f'تم تغيير حالة المستخلص إلى {status}.', 'success')
    return redirect(url_for('invoices.view_invoice', id=id))

@invoices_bp.route('/search', methods=['GET'])
@login_required
def search_invoices():
    """البحث في المستخلصات"""
    query = request.args.get('query', '')

    if not query:
        return redirect(url_for('invoices.index'))

    # البحث في المستخلصات
    invoices = Invoice.query.filter(
        or_(
            Invoice.invoice_number.contains(query),
            Invoice.project_name.contains(query),
            Invoice.description.contains(query),
            func.cast(Invoice.invoice_amount, db.String).contains(query)
        )
    ).order_by(desc(Invoice.created_at)).all()

    # تحضير قائمة المستخلصات مع أسماء المستخدمين
    invoices_with_username = []
    for invoice in invoices:
        invoice_dict = {
            'id': invoice.id,
            'invoice_number': invoice.invoice_number,
            'invoice_date': invoice.invoice_date,
            'invoice_amount': invoice.invoice_amount,
            'project_name': invoice.project_name,
            'description': invoice.description,
            'approval_status': invoice.approval_status,
            'status': invoice.approval_status,  # تكرار للتوافق مع الواجهة
            'username': invoice.creator.username if invoice.creator else "غير معروف"
        }
        invoices_with_username.append(invoice_dict)

    return render_template('invoices/search_results.html', 
                           invoices=invoices_with_username, 
                           query=query,
                           count=len(invoices_with_username))