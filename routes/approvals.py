from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app
from flask_login import login_required, current_user
from app import db, socketio
from models import PurchaseOrder, PurchaseOrderItem, Invoice, ApprovalLog, User, OtherTransaction, PurchaseRequest, Notification
from datetime import datetime
from routes.purchase_orders import calculate_total_with_vat, calculate_item_total, calculate_order_total, allowed_file
import os
from werkzeug.utils import secure_filename
from notifications import send_notification

approvals_bp = Blueprint('approvals', __name__, url_prefix='/approvals')

# عرض جميع أوامر الشراء التي تحتاج إلى اعتماد
@approvals_bp.route('/purchase_orders')
@login_required
def purchase_orders():
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    # الحصول على جميع أوامر الشراء التي تحتاج إلى اعتماد
    purchase_orders = PurchaseOrder.query.filter_by(approval_status='قيد الانتظار').all()
    return render_template('approvals/purchase_orders.html', purchase_orders=purchase_orders)

# عرض تفاصيل أمر الشراء للاعتماد
@approvals_bp.route('/purchase_orders/view/<int:id>')
@login_required
def view_purchase_order(id):
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    purchase_order = PurchaseOrder.query.get_or_404(id)
    
    # الحصول على معلومات منشئ الطلب وبنود الطلب
    creator = User.query.get(purchase_order.created_by)
    order_items = PurchaseOrderItem.query.filter_by(purchase_order_id=id).all()
    
    # إعادة حساب الإجمالي الصحيح (السعر × الكمية لكل صنف)
    correct_total = calculate_order_total(order_items)
    
    return render_template('approvals/view_purchase_order.html', 
                          purchase_order=purchase_order, 
                          order_items=order_items,
                          creator=creator, 
                          correct_total=correct_total,
                          calculate_total_with_vat=calculate_total_with_vat,
                          calculate_item_total=calculate_item_total)

# اعتماد أو رفض أمر الشراء
@approvals_bp.route('/purchase_orders/approve/<int:id>', methods=['POST'])
@login_required
def approve_purchase_order(id):
    # التحقق من صلاحية المستخدم
    if current_user.role not in ['مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي']:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    purchase_order = PurchaseOrder.query.get_or_404(id)
    
    # التحقق من أن الأمر قيد الانتظار
    if purchase_order.approval_status not in ['قيد الانتظار', 'مرفوض']:
        flash('تم اعتماد هذا الأمر مسبقًا', 'warning')
        return redirect(url_for('approvals.purchase_orders'))
    
    # الحصول على الإجراء والتعليقات من النموذج
    action = request.form.get('action')
    comments = request.form.get('comments')
    
    # التحقق من صحة الإجراء
    if action not in ['معتمد', 'مرفوض']:
        flash('إجراء غير صالح', 'danger')
        return redirect(url_for('approvals.view_purchase_order', id=id))
    
    # المدير التنفيذي يمكنه الاعتماد مباشرة
    if current_user.role == 'مدير تنفيذي':
        purchase_order.engineering_approval = 'معتمد'
        purchase_order.projects_approval = 'معتمد'
        purchase_order.executive_approval = action
        purchase_order.approval_status = action
    
    # مدير المشاريع يتطلب اعتماد مدير المكتب الهندسي أولاً
    elif current_user.role == 'مدير مشاريع':
        if purchase_order.engineering_approval != 'معتمد':
            flash('يجب اعتماد مدير المكتب الهندسي أولاً', 'warning')
            return redirect(url_for('approvals.view_purchase_order', id=id))
        
        purchase_order.projects_approval = action
        
        # تحديث الحالة النهائية عند الاعتماد أو الرفض
        if action == 'مرفوض':
            purchase_order.approval_status = 'مرفوض'
        elif action == 'معتمد' and purchase_order.executive_approval == 'معتمد':
            purchase_order.approval_status = 'معتمد'
            
        # إرسال إشعار للمدير التنفيذي إذا كانت الموافقة بالاعتماد
        if action == 'معتمد':
            # البحث عن المدير التنفيذي
            executive_managers = User.query.filter_by(role='مدير تنفيذي').all()
            for manager in executive_managers:
                # إرسال إشعار باستخدام وظيفة إرسال الإشعارات
                send_notification(
                    db=db,
                    socketio=socketio,
                    user_id=manager.id,
                    title='طلب موافقة على أمر شراء',
                    message=f'أمر الشراء رقم {purchase_order.order_number} بانتظار موافقتكم النهائية',
                    category='أمر شراء',
                    reference_type='purchase_order',
                    reference_id=id,
                    url=url_for('approvals.view_purchase_order', id=id)
                )
    
    # مدير المكتب الهندسي
    elif current_user.role == 'مدير مكتب هندسي':
        purchase_order.engineering_approval = action
        
        # تحديث الحالة النهائية إذا تم الرفض
        if action == 'مرفوض':
            purchase_order.approval_status = 'مرفوض'
        # إذا تم الموافقة وكانت الموافقات الأخرى متاحة
        elif action == 'معتمد' and purchase_order.projects_approval == 'معتمد' and purchase_order.executive_approval == 'معتمد':
            purchase_order.approval_status = 'معتمد'
            
        # إرسال إشعار لمدير المشاريع إذا كانت الموافقة بالاعتماد
        if action == 'معتمد':
            # البحث عن مدير المشاريع
            project_managers = User.query.filter_by(role='مدير مشاريع').all()
            for manager in project_managers:
                # إرسال إشعار باستخدام وظيفة إرسال الإشعارات
                send_notification(
                    db=db,
                    socketio=socketio,
                    user_id=manager.id,
                    title='طلب موافقة على أمر شراء',
                    message=f'أمر الشراء رقم {purchase_order.order_number} بانتظار موافقتكم بعد اعتماد مدير المكتب الهندسي',
                    category='أمر شراء',
                    reference_type='purchase_order',
                    reference_id=id,
                    url=url_for('approvals.view_purchase_order', id=id)
                )
    
    # تحديث حالة طلب الشراء المرتبط بأمر الشراء إذا تمت الموافقة النهائية
    if purchase_order.approval_status == 'معتمد':
        purchase_request = PurchaseRequest.query.get(purchase_order.purchase_request_id)
        if purchase_request:
            purchase_request.status = 'تم التنفيذ'
            # إضافة رسالة سجل للتأكيد
            flash(f'تم تحديث حالة طلب الشراء رقم {purchase_request.request_number} إلى "تم التنفيذ"', 'info')
            
            # إرسال إشعار لمنشئ الطلب
            creator = User.query.get(purchase_order.created_by)
            if creator:
                send_notification(
                    db=db,
                    socketio=socketio,
                    user_id=creator.id,
                    title='تم اعتماد أمر الشراء',
                    message=f'تم اعتماد أمر الشراء رقم {purchase_order.order_number} الخاص بكم',
                    category='أمر شراء',
                    reference_type='purchase_order',
                    reference_id=id,
                    url=url_for('purchase_orders.view_order', id=id)
                )
    
    # إذا تم رفض أمر الشراء، أرسل إشعار لمنشئ الطلب
    elif action == 'مرفوض':
        creator = User.query.get(purchase_order.created_by)
        if creator:
            send_notification(
                db=db,
                socketio=socketio,
                user_id=creator.id,
                title='تم رفض أمر الشراء',
                message=f'تم رفض أمر الشراء رقم {purchase_order.order_number} الخاص بكم',
                category='أمر شراء',
                reference_type='purchase_order',
                reference_id=id,
                url=url_for('purchase_orders.view_order', id=id)
            )
    
    # إنشاء سجل اعتماد جديد
    approval_log = ApprovalLog(
        approval_type='أمر شراء',
        reference_id=id,
        action=action,
        approved_by=current_user.id,
        comments=comments
    )
    
    # حذف الإشعارات المتعلقة بانتظار الاعتماد لهذا الأمر
    # هذا سيزيل جميع إشعارات الاعتماد المتعلقة بأمر الشراء هذا
    if purchase_order.approval_status in ['معتمد', 'مرفوض']:
        # حذف جميع الإشعارات المتعلقة بانتظار الاعتماد لهذا الأمر
        pending_notifications = Notification.query.filter_by(
            reference_type='purchase_order',
            reference_id=id,
            category='اعتماد'
        ).all()
        
        for notification in pending_notifications:
            db.session.delete(notification)
    
    # حفظ التغييرات
    db.session.add(approval_log)
    db.session.commit()
    
    flash(f'تم {action} أمر الشراء بنجاح', 'success')
    return redirect(url_for('approvals.purchase_orders'))

# عرض جميع المستخلصات التي تحتاج إلى اعتماد
@approvals_bp.route('/invoices')
@login_required
def invoices():
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    # الحصول على جميع المستخلصات التي تحتاج إلى اعتماد
    invoices = Invoice.query.filter_by(approval_status='قيد الانتظار').all()
    return render_template('approvals/invoices.html', invoices=invoices)

# عرض تفاصيل المستخلص للاعتماد
@approvals_bp.route('/invoices/view/<int:id>')
@login_required
def view_invoice(id):
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    invoice = Invoice.query.get_or_404(id)
    
    # الحصول على معلومات منشئ المستخلص
    creator = User.query.get(invoice.created_by)
    
    return render_template('approvals/view_invoice.html', invoice=invoice, creator=creator)

# اعتماد أو رفض المستخلص
@approvals_bp.route('/invoices/approve/<int:id>', methods=['POST'])
@login_required
def approve_invoice(id):
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    invoice = Invoice.query.get_or_404(id)
    
    # التحقق من أن المستخلص قيد الانتظار
    if invoice.approval_status != 'قيد الانتظار':
        flash('تم اعتماد أو رفض هذا المستخلص مسبقًا', 'warning')
        return redirect(url_for('approvals.invoices'))
    
    # الحصول على الإجراء والتعليقات من النموذج
    action = request.form.get('action')
    comments = request.form.get('comments')
    
    # التحقق من صحة الإجراء
    if action not in ['معتمد', 'مرفوض']:
        flash('إجراء غير صالح', 'danger')
        return redirect(url_for('approvals.view_invoice', id=id))
    
    # تحديث حالة الاعتماد
    invoice.approval_status = action
    
    # إنشاء سجل اعتماد جديد
    approval_log = ApprovalLog(
        entity_type='مستخلص',
        reference_id=id,
        action=action,
        approved_by=current_user.id,
        comments=comments
    )
    
    # حذف الإشعارات المتعلقة بانتظار الاعتماد لهذا المستخلص
    if invoice.approval_status in ['معتمد', 'مرفوض']:
        # حذف جميع الإشعارات المتعلقة بانتظار الاعتماد لهذا المستخلص
        pending_notifications = Notification.query.filter_by(
            reference_type='invoice',
            reference_id=id,
            category='اعتماد'
        ).all()
        
        for notification in pending_notifications:
            db.session.delete(notification)
    
    # حفظ التغييرات
    db.session.add(approval_log)
    db.session.commit()
    
    # إرسال إشعار لمنشئ المستخلص
    creator = User.query.get(invoice.created_by)
    if creator:
        notification_title = 'تم اعتماد المستخلص' if action == 'معتمد' else 'تم رفض المستخلص'
        notification_message = f"{notification_title} رقم {invoice.invoice_number} الخاص بكم"
        
        send_notification(
            db=db,
            socketio=socketio,
            user_id=creator.id,
            title=notification_title,
            message=notification_message,
            category='مستخلص',
            reference_type='invoice',
            reference_id=id,
            url=url_for('approvals.view_invoice', id=id)
        )
    
    flash(f'تم {action} المستخلص بنجاح', 'success')
    return redirect(url_for('approvals.invoices'))

# عرض سجل الاعتمادات
@approvals_bp.route('/logs')
@login_required
def logs():
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    # الحصول على جميع سجلات الاعتماد
    approval_logs = ApprovalLog.query.order_by(ApprovalLog.approval_date.desc()).all()
    
    # تحضير معلومات إضافية لكل سجل
    logs_info = []
    for log in approval_logs:
        log_info = {
            'log': log,
            'approver': User.query.get(log.approved_by),
            'reference': None
        }
        
        # الحصول على المرجع (أمر الشراء أو المستخلص أو معاملة أخرى)
        if log.approval_type == 'أمر شراء':
            log_info['reference'] = PurchaseOrder.query.get(log.reference_id)
        elif log.approval_type == 'مستخلص':
            log_info['reference'] = Invoice.query.get(log.reference_id)
        else:  # معاملة أخرى
            log_info['reference'] = OtherTransaction.query.get(log.reference_id)
        
        logs_info.append(log_info)
    
    return render_template('approvals/logs.html', logs_info=logs_info)

# إضافة مستخلص جديد
@approvals_bp.route('/invoices/add', methods=['GET', 'POST'])
@login_required
def add_invoice():
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        invoice_number = request.form.get('invoice_number')
        invoice_date_str = request.form.get('invoice_date')
        project_name = request.form.get('project_name')
        invoice_amount = request.form.get('invoice_amount')
        
        # التحقق من صحة البيانات
        if not invoice_number or not invoice_date_str or not project_name or not invoice_amount:
            flash('جميع الحقول المطلوبة يجب ملؤها', 'danger')
            return redirect(url_for('approvals.add_invoice'))
        
        try:
            invoice_date = datetime.strptime(invoice_date_str, '%Y-%m-%d').date()
            invoice_amount = float(invoice_amount)
        except ValueError:
            flash('صيغة التاريخ أو المبلغ غير صحيحة', 'danger')
            return redirect(url_for('approvals.add_invoice'))
        
        # إنشاء مستخلص جديد
        invoice = Invoice(
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            project_name=project_name,
            invoice_amount=invoice_amount,
            approval_status='قيد الانتظار',
            created_by=current_user.id
        )
        
        # التعامل مع الملف المرفق
        if 'attachment' in request.files:
            file = request.files['attachment']
            if file and file.filename != '':
                if allowed_file(file.filename):
                    # التأكد من وجود مجلد التحميل
                    upload_folder = os.path.join(current_app.static_folder, 'uploads/invoices')
                    if not os.path.exists(upload_folder):
                        os.makedirs(upload_folder)
                    
                    # حفظ الملف
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(upload_folder, f"{invoice_number}_{filename}")
                    file.save(file_path)
                    
                    # تحديث مسار الملف في قاعدة البيانات
                    relative_path = f"uploads/invoices/{invoice_number}_{filename}"
                    invoice.attachment_path = relative_path
                else:
                    flash('صيغة الملف غير مسموح بها', 'danger')
                    return redirect(url_for('approvals.add_invoice'))
        
        # حفظ المستخلص في قاعدة البيانات
        db.session.add(invoice)
        db.session.commit()
        
        flash('تم إضافة المستخلص بنجاح', 'success')
        return redirect(url_for('approvals.invoices'))
    
    return render_template('approvals/add_invoice.html')

# عرض جميع المعاملات الأخرى التي تحتاج إلى اعتماد
@approvals_bp.route('/other_transactions')
@login_required
def other_transactions():
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    # الحصول على جميع المعاملات التي تحتاج إلى اعتماد
    transactions = OtherTransaction.query.filter_by(approval_status='قيد الانتظار').all()
    return render_template('approvals/other_transactions.html', transactions=transactions)

# إضافة معاملة أخرى جديدة
@approvals_bp.route('/other_transactions/add', methods=['GET', 'POST'])
@login_required
def add_other_transaction():
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        transaction_number = request.form.get('transaction_number')
        transaction_date_str = request.form.get('transaction_date')
        transaction_type = request.form.get('transaction_type')
        description = request.form.get('description')
        
        # التحقق من صحة البيانات
        if not transaction_number or not transaction_date_str or not transaction_type:
            flash('جميع الحقول المطلوبة يجب ملؤها', 'danger')
            return redirect(url_for('approvals.add_other_transaction'))
        
        try:
            transaction_date = datetime.strptime(transaction_date_str, '%Y-%m-%d').date()
        except ValueError:
            flash('صيغة التاريخ غير صحيحة', 'danger')
            return redirect(url_for('approvals.add_other_transaction'))
        
        # إنشاء معاملة جديدة
        transaction = OtherTransaction(
            transaction_number=transaction_number,
            transaction_date=transaction_date,
            transaction_type=transaction_type,
            description=description,
            approval_status='قيد الانتظار',
            created_by=current_user.id
        )
        
        # التعامل مع الملف المرفق
        if 'attachment' in request.files:
            file = request.files['attachment']
            if file and file.filename != '':
                if allowed_file(file.filename):
                    # التأكد من وجود مجلد التحميل
                    upload_folder = os.path.join(current_app.static_folder, 'uploads/transactions')
                    if not os.path.exists(upload_folder):
                        os.makedirs(upload_folder)
                    
                    # حفظ الملف
                    filename = secure_filename(file.filename)
                    file_path = os.path.join(upload_folder, f"{transaction_number}_{filename}")
                    file.save(file_path)
                    
                    # تحديث مسار الملف في قاعدة البيانات
                    relative_path = f"uploads/transactions/{transaction_number}_{filename}"
                    transaction.attachment_path = relative_path
                else:
                    flash('صيغة الملف غير مسموح بها', 'danger')
                    return redirect(url_for('approvals.add_other_transaction'))
        
        # حفظ المعاملة في قاعدة البيانات
        db.session.add(transaction)
        db.session.commit()
        
        flash('تم إضافة المعاملة بنجاح', 'success')
        return redirect(url_for('approvals.other_transactions'))
    
    return render_template('approvals/add_other_transaction.html')

# عرض تفاصيل المعاملة للاعتماد
@approvals_bp.route('/other_transactions/view/<int:id>')
@login_required
def view_other_transaction(id):
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    transaction = OtherTransaction.query.get_or_404(id)
    
    # الحصول على معلومات منشئ المعاملة
    creator = User.query.get(transaction.created_by)
    
    return render_template('approvals/view_other_transaction.html', transaction=transaction, creator=creator)

# اعتماد أو رفض المعاملة
@approvals_bp.route('/other_transactions/approve/<int:id>', methods=['POST'])
@login_required
def approve_other_transaction(id):
    # التحقق من صلاحية المستخدم
    approval_roles = ['مدير', 'محاسب', 'مدير مكتب هندسي', 'مدير مشاريع', 'مدير تنفيذي', 'admin']
    if current_user.role not in approval_roles:
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    transaction = OtherTransaction.query.get_or_404(id)
    
    # التحقق من أن المعاملة قيد الانتظار
    if transaction.approval_status != 'قيد الانتظار':
        flash('تم اعتماد أو رفض هذه المعاملة مسبقًا', 'warning')
        return redirect(url_for('approvals.other_transactions'))
    
    # الحصول على الإجراء والتعليقات من النموذج
    action = request.form.get('action')
    comments = request.form.get('comments')
    
    # التحقق من صحة الإجراء
    if action not in ['معتمد', 'مرفوض']:
        flash('إجراء غير صالح', 'danger')
        return redirect(url_for('approvals.view_other_transaction', id=id))
    
    # تحديث حالة الاعتماد
    transaction.approval_status = action
    
    # إنشاء سجل اعتماد جديد
    approval_log = ApprovalLog(
        approval_type='معاملة أخرى',
        reference_id=id,
        action=action,
        approved_by=current_user.id,
        comments=comments
    )
    
    # حذف الإشعارات المتعلقة بانتظار الاعتماد لهذه المعاملة
    if transaction.approval_status in ['معتمد', 'مرفوض']:
        # حذف جميع الإشعارات المتعلقة بانتظار الاعتماد لهذه المعاملة
        pending_notifications = Notification.query.filter_by(
            reference_type='other_transaction',
            reference_id=id,
            category='اعتماد'
        ).all()
        
        for notification in pending_notifications:
            db.session.delete(notification)
    
    # حفظ التغييرات
    db.session.add(approval_log)
    db.session.commit()
    
    flash(f'تم {action} المعاملة بنجاح', 'success')
    return redirect(url_for('approvals.other_transactions'))
