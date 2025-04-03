from flask import Blueprint, render_template, request, jsonify, abort, Response
from flask_login import login_required, current_user
from app import db
from models import (PurchaseOrder, PurchaseOrderItem, Invoice, 
                   OtherTransaction, Project, User, UserRole, Supplier)
from datetime import datetime, timedelta
from sqlalchemy import func, desc, or_
import json
from permissions import get_accessible_projects, has_access_to_project
from decimal import Decimal
from utils import export_to_excel

# إنشاء Blueprint للتقارير
reports_bp = Blueprint('reports', __name__, url_prefix='/reports')

@reports_bp.route('/expenses', methods=['GET'])
@login_required
def project_expenses():
    """تقرير مصاريف المشاريع"""
    
    # التحقق من طلب التصدير إلى إكسيل
    export_format = request.args.get('export', '')
    
    # الحصول على المشاريع التي يمكن للمستخدم الوصول إليها
    projects = Project.query.order_by(Project.name).all()
    
    # في حالة المستخدم ليس مدير أو مشرف، فقط اعرض المشاريع المتاحة له
    from models import UserRole
    if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        project_ids = get_accessible_projects()
        if project_ids:
            projects = Project.query.filter(Project.id.in_(project_ids)).order_by(Project.name).all()
    
    # التحقق من وجود تصفية
    selected_project_id = request.args.get('project_id', type=int)
    start_date_str = request.args.get('start_date', '')
    end_date_str = request.args.get('end_date', '')
    
    # تحويل التواريخ إذا كانت موجودة
    start_date = None
    end_date = None
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        # إذا كان هناك خطأ في تنسيق التاريخ، استخدم التواريخ الافتراضية
        start_date = None
        end_date = None
    
    # إذا لم يتم اختيار مشروع، عرض الصفحة بدون بيانات
    if not selected_project_id:
        return render_template('reports/project_expenses.html', 
                              projects=projects,
                              selected_project=None,
                              start_date=start_date_str,
                              end_date=end_date_str,
                              expenses_data=None,
                              total_amount=0)
    
    # التحقق من الصلاحيات للوصول إلى المشروع المحدد
    if not has_access_to_project(selected_project_id) and current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        abort(403)  # غير مصرح
    
    # الحصول على المشروع المحدد
    selected_project = Project.query.get_or_404(selected_project_id)
    
    # جمع كل المصاريف من مختلف الأنواع
    expenses_data = []
    total_amount = 0
    
    # 1. أوامر الشراء المعتمدة
    purchase_orders_query = PurchaseOrder.query.filter_by(
        project_id=selected_project_id,
        approval_status='معتمد'
    )
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.order_date >= start_date)
    if end_date:
        purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.order_date <= end_date)
    
    # الحصول على أوامر الشراء
    purchase_orders = purchase_orders_query.all()
    
    # إضافة أوامر الشراء إلى بيانات المصاريف
    for po in purchase_orders:
        # حساب إجمالي أمر الشراء من البنود
        po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
        amount = sum(item.price * item.quantity for item in po_items) if po_items else 0
        
        # الحصول على اسم المورد
        supplier_name = po.supplier.name if po.supplier else "غير محدد"
        
        # إضافة أمر الشراء إلى قائمة المصاريف
        expenses_data.append({
            'id': po.id,
            'type': 'أمر شراء',
            'reference_number': po.order_number,
            'date': po.order_date,
            'amount': amount,
            'vat_inclusive': True,  # أوامر الشراء تشمل ضريبة القيمة المضافة
            'description': f"أمر شراء إلى {supplier_name}",
            'status': po.approval_status,
            'url': f"/purchase_orders/orders/view/{po.id}"
        })
        
        total_amount += amount
    
    # 2. المستخلصات المعتمدة
    invoices_query = Invoice.query.filter_by(
        project_name=selected_project.name,  # استخدام اسم المشروع لأن المستخلصات قد لا تحتوي على معرف المشروع
        approval_status='معتمد'
    )
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        invoices_query = invoices_query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        invoices_query = invoices_query.filter(Invoice.invoice_date <= end_date)
    
    # الحصول على المستخلصات
    invoices = invoices_query.all()
    
    # إضافة المستخلصات إلى بيانات المصاريف
    for invoice in invoices:
        expenses_data.append({
            'id': invoice.id,
            'type': 'مستخلص',
            'reference_number': invoice.invoice_number,
            'date': invoice.invoice_date,
            'amount': invoice.invoice_amount,
            'vat_inclusive': True,  # المستخلصات تشمل ضريبة القيمة المضافة
            'description': invoice.description or "مستخلص",
            'status': invoice.approval_status,
            'url': f"/invoices/{invoice.id}"
        })
        
        total_amount += invoice.invoice_amount
    
    # 3. المعاملات الأخرى المعتمدة
    other_transactions_query = OtherTransaction.query.filter_by(
        project_id=selected_project_id,
        approval_status='معتمد'
    )
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        other_transactions_query = other_transactions_query.filter(OtherTransaction.transaction_date >= start_date)
    if end_date:
        other_transactions_query = other_transactions_query.filter(OtherTransaction.transaction_date <= end_date)
    
    # الحصول على المعاملات الأخرى
    other_transactions = other_transactions_query.all()
    
    # إضافة المعاملات الأخرى إلى بيانات المصاريف
    for transaction in other_transactions:
        expenses_data.append({
            'id': transaction.id,
            'type': 'معاملة أخرى',
            'reference_number': transaction.transaction_number,
            'date': transaction.transaction_date,
            'amount': transaction.amount,
            'vat_inclusive': transaction.vat_inclusive,  # حسب إعداد المعاملة
            'description': transaction.description or "معاملة أخرى",
            'status': transaction.approval_status,
            'url': f"/other_transactions/{transaction.id}"
        })
        
        total_amount += transaction.amount
    
    # ترتيب المصاريف حسب التاريخ (الأحدث أولاً)
    expenses_data.sort(key=lambda x: x['date'], reverse=True)
    
    # معالجة طلب التصدير إلى إكسيل
    if export_format == 'excel' and expenses_data:
        # تحضير عناوين الأعمدة للتصدير
        headers = {
            'reference_number': 'الرقم المرجعي',
            'type': 'النوع',
            'date': 'التاريخ',
            'description': 'الوصف',
            'amount': 'المبلغ',
            'status': 'الحالة'
        }
        
        # تهيئة اسم الملف
        filename = f"expenses_{selected_project.name}"
        
        # إضافة معلومات ملخص المشروع في بداية ملف الإكسيل
        project_summary = {
            'project_name': selected_project.name,
            'contract_value': selected_project.contract_value or 0,
            'estimated_budget': selected_project.estimated_budget or 0,
            'total_expenses': total_amount,
            'expense_percentage': round((total_amount / selected_project.estimated_budget) * 100, 1) if selected_project.estimated_budget and selected_project.estimated_budget > 0 else 0,
            'currency': selected_project.currency
        }
        
        # تصدير البيانات إلى إكسيل
        return export_to_excel(expenses_data, headers, filename, project_summary=project_summary)
    
    # تهيئة الصفحة مع البيانات
    return render_template('reports/project_expenses.html', 
                          projects=projects,
                          selected_project=selected_project,
                          start_date=start_date_str,
                          end_date=end_date_str,
                          expenses_data=expenses_data,
                          total_amount=total_amount)

@reports_bp.route('/expenses/api', methods=['GET'])
@login_required
def project_expenses_api():
    """واجهة برمجة التطبيقات لتقرير مصاريف المشاريع (للرسوم البيانية)"""
    
    # الحصول على معرف المشروع من الطلب
    project_id = request.args.get('project_id', type=int)
    if not project_id:
        return jsonify({"error": "يجب تحديد المشروع"}), 400
    
    # التحقق من الصلاحيات للوصول إلى المشروع المحدد
    if not has_access_to_project(project_id) and current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        return jsonify({"error": "غير مصرح لك بالوصول إلى هذا المشروع"}), 403
    
    # استرجاع المشروع
    project = Project.query.get_or_404(project_id)
    
    # تصفية حسب التاريخ (آخر 6 أشهر افتراضياً)
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=180)  # آخر 6 أشهر
    
    # تستبدل بالقيم من الطلب إذا تم تحديدها
    start_date_str = request.args.get('start_date', '')
    end_date_str = request.args.get('end_date', '')
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"error": "تنسيق التاريخ غير صحيح"}), 400
    
    # جمع بيانات للرسوم البيانية بناءً على الشهر
    months_data = {}
    
    # تهيئة البيانات لكل شهر في النطاق
    current_date = start_date.replace(day=1)
    while current_date <= end_date:
        month_key = current_date.strftime('%Y-%m')
        month_name = current_date.strftime('%m/%Y')
        months_data[month_key] = {
            'month': month_name,
            'purchase_orders': 0,
            'invoices': 0,
            'other_transactions': 0
        }
        
        # انتقل إلى الشهر التالي
        if current_date.month == 12:
            current_date = current_date.replace(year=current_date.year + 1, month=1)
        else:
            current_date = current_date.replace(month=current_date.month + 1)
    
    # 1. جمع بيانات أوامر الشراء المعتمدة
    purchase_orders = PurchaseOrder.query.filter(
        PurchaseOrder.project_id == project_id,
        PurchaseOrder.status == 'معتمد',
        PurchaseOrder.order_date >= start_date,
        PurchaseOrder.order_date <= end_date
    ).all()
    
    for po in purchase_orders:
        po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
        amount = sum(item.price * item.quantity for item in po_items) if po_items else 0
        
        month_key = po.order_date.strftime('%Y-%m')
        if month_key in months_data:
            months_data[month_key]['purchase_orders'] += amount
    
    # 2. جمع بيانات المستخلصات المعتمدة
    invoices = Invoice.query.filter(
        Invoice.project_name == project.name,
        Invoice.approval_status == 'معتمد',
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date <= end_date
    ).all()
    
    for invoice in invoices:
        month_key = invoice.invoice_date.strftime('%Y-%m')
        if month_key in months_data:
            months_data[month_key]['invoices'] += invoice.invoice_amount
    
    # 3. جمع بيانات المعاملات الأخرى المعتمدة
    other_transactions = OtherTransaction.query.filter(
        OtherTransaction.project_id == project_id,
        OtherTransaction.approval_status == 'معتمد',
        OtherTransaction.transaction_date >= start_date,
        OtherTransaction.transaction_date <= end_date
    ).all()
    
    for transaction in other_transactions:
        month_key = transaction.transaction_date.strftime('%Y-%m')
        if month_key in months_data:
            months_data[month_key]['other_transactions'] += transaction.amount
    
    # تحويل البيانات إلى قائمة وترتيبها حسب الشهر
    chart_data = list(months_data.values())
    chart_data.sort(key=lambda x: datetime.strptime(x['month'], '%m/%Y'))
    
    return jsonify({
        "project_name": project.name,
        "chart_data": chart_data
    })

@reports_bp.route('/summary', methods=['GET'])
@login_required
def projects_summary():
    """تقرير ملخص المشاريع"""
    
    # التحقق من طلب التصدير إلى إكسيل
    export_format = request.args.get('export', '')
    
    # الحصول على المشاريع التي يمكن للمستخدم الوصول إليها
    from models import UserRole
    
    if current_user.role in UserRole.ROLES_WITH_FULL_ACCESS or current_user.is_admin:
        # المستخدمون ذوو الصلاحيات الكاملة يمكنهم رؤية جميع المشاريع
        projects = Project.query.order_by(Project.name).all()
    else:
        # المستخدمون العاديون يمكنهم رؤية المشاريع التي لديهم وصول إليها فقط
        project_ids = get_accessible_projects()
        if project_ids:
            projects = Project.query.filter(Project.id.in_(project_ids)).order_by(Project.name).all()
        else:
            projects = []
    
    # بيانات ملخص المشاريع
    summary_data = []
    
    for project in projects:
        # 1. إجمالي أوامر الشراء المعتمدة
        po_total = 0
        # استخدام status بدلاً من approval_status للتوافق مع الخاصية المضافة في كائن PurchaseOrder
        purchase_orders = PurchaseOrder.query.filter(
            PurchaseOrder.project_id == project.id,
            PurchaseOrder.status == 'معتمد'
        ).all()
        
        for po in purchase_orders:
            po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
            po_total += sum(item.price * item.quantity for item in po_items) if po_items else 0
        
        # 2. إجمالي المستخلصات المعتمدة
        invoice_total = db.session.query(func.sum(Invoice.invoice_amount)).filter(
            Invoice.project_name == project.name,
            Invoice.approval_status == 'معتمد'
        ).scalar() or 0
        
        # 3. إجمالي المعاملات الأخرى المعتمدة
        other_transaction_total = db.session.query(func.sum(OtherTransaction.amount)).filter(
            OtherTransaction.project_id == project.id,
            OtherTransaction.approval_status == 'معتمد'
        ).scalar() or 0
        
        # حساب إجمالي المصاريف
        total_expenses = po_total + invoice_total + other_transaction_total
        
        # 4. نسبة المصاريف من الميزانية
        budget_percentage = 0
        if project.estimated_budget and project.estimated_budget > 0:
            budget_percentage = (total_expenses / project.estimated_budget) * 100
        
        # إضافة بيانات المشروع إلى الملخص
        summary_data.append({
            'id': project.id,
            'name': project.name,
            'po_total': po_total,
            'invoice_total': invoice_total,
            'other_transaction_total': other_transaction_total,
            'total_expenses': total_expenses,
            'estimated_budget': project.estimated_budget or 0,
            'budget_percentage': budget_percentage,
            'status': project.status
        })
    
    # معالجة طلب التصدير إلى إكسيل
    if export_format == 'excel' and summary_data:
        # تحضير عناوين الأعمدة للتصدير
        headers = {
            'name': 'اسم المشروع',
            'po_total': 'إجمالي أوامر الشراء',
            'invoice_total': 'إجمالي المستخلصات',
            'other_transaction_total': 'إجمالي المعاملات الأخرى',
            'total_expenses': 'إجمالي المصاريف',
            'estimated_budget': 'الميزانية التقديرية',
            'budget_percentage': 'نسبة الإنفاق من الميزانية (%)',
            'status': 'حالة المشروع'
        }
        
        # تهيئة اسم الملف
        filename = f"projects_summary_report"
        
        # إعداد ملخص كلي للتقرير
        total_projects = len(summary_data)
        total_expenses_all = sum(project['total_expenses'] for project in summary_data)
        total_budget_all = sum(project['estimated_budget'] for project in summary_data)
        total_percentage = round((total_expenses_all / total_budget_all) * 100, 1) if total_budget_all > 0 else 0
        
        # إعداد معلومات الملخص للإكسيل
        report_summary = {
            'project_name': 'تقرير ملخص جميع المشاريع',
            'contract_value': total_budget_all,  # نستخدم إجمالي الميزانيات كقيمة العقود 
            'estimated_budget': total_budget_all,
            'total_expenses': total_expenses_all,
            'expense_percentage': total_percentage,
            'currency': 'ريال سعودي'  # عملة افتراضية
        }
        
        # تصدير البيانات إلى إكسيل مع إضافة الملخص
        return export_to_excel(summary_data, headers, filename, project_summary=report_summary)
    
    return render_template('reports/projects_summary.html', 
                          summary_data=summary_data)
                          
@reports_bp.route('/total_purchases', methods=['GET'])
@login_required
def total_purchases():
    """تقرير المشتريات الإجمالية"""
    
    # التحقق من طلب التصدير إلى إكسيل
    export_format = request.args.get('export', '')
    
    # تصفية حسب الفترة الزمنية
    start_date_str = request.args.get('start_date', '')
    end_date_str = request.args.get('end_date', '')
    
    # تحويل التواريخ إذا كانت موجودة
    start_date = None
    end_date = None
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        # إذا كان هناك خطأ في تنسيق التاريخ، استخدم التواريخ الافتراضية
        start_date = None
        end_date = None
    
    # 1. استعلام أوامر الشراء
    purchase_orders_query = PurchaseOrder.query.filter(PurchaseOrder.status == 'معتمد')
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.order_date >= start_date)
    if end_date:
        purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.order_date <= end_date)
        
    # المستخدم العادي يرى فقط المشاريع التي لديه وصول إليها
    project_ids = None
    if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        project_ids = get_accessible_projects()
        if project_ids:
            purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.project_id.in_(project_ids))
    
    # الحصول على أوامر الشراء
    purchase_orders = purchase_orders_query.all()
    
    # 2. استعلام المستخلصات
    invoices_query = Invoice.query.filter(Invoice.approval_status == 'معتمد')
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        invoices_query = invoices_query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        invoices_query = invoices_query.filter(Invoice.invoice_date <= end_date)
    
    # تطبيق تصفية المشاريع للمستخدم العادي
    if project_ids and current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        # الحصول على قائمة أسماء المشاريع المسموح بها
        allowed_projects = Project.query.filter(Project.id.in_(project_ids)).all()
        allowed_project_names = [p.name for p in allowed_projects]
        
        if allowed_project_names:
            # تصفية المستخلصات حسب أسماء المشاريع
            invoices_query = invoices_query.filter(Invoice.project_name.in_(allowed_project_names))
    
    # الحصول على المستخلصات
    invoices = invoices_query.all()
    
    # 3. استعلام المعاملات الأخرى
    other_transactions_query = OtherTransaction.query.filter(OtherTransaction.approval_status == 'معتمد')
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        other_transactions_query = other_transactions_query.filter(OtherTransaction.transaction_date >= start_date)
    if end_date:
        other_transactions_query = other_transactions_query.filter(OtherTransaction.transaction_date <= end_date)
    
    # تطبيق تصفية المشاريع للمستخدم العادي
    if project_ids and current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        other_transactions_query = other_transactions_query.filter(OtherTransaction.project_id.in_(project_ids))
    
    # الحصول على المعاملات الأخرى
    other_transactions = other_transactions_query.all()
    
    # تجميع جميع المعاملات
    all_transactions = []
    monthly_data = {}
    
    # إجمالي المبالغ
    total_po_amount = 0
    total_invoice_amount = 0
    total_other_amount = 0
    
    # 1. تجميع أوامر الشراء
    for po in purchase_orders:
        # حساب قيمة أمر الشراء
        po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
        po_amount = sum(item.price * item.quantity for item in po_items) if po_items else 0
        total_po_amount += po_amount
        
        project_name = po.project.name if po.project else "غير محدد"
        
        # إضافة إلى قائمة جميع المعاملات
        all_transactions.append({
            'id': po.id,
            'type': 'أمر شراء',
            'reference_number': po.order_number,
            'date': po.order_date,
            'project': project_name,
            'supplier': po.supplier.name if po.supplier else "غير محدد",
            'amount': po_amount,
            'url': f"/purchase_orders/orders/view/{po.id}"
        })
        
        # تجميع البيانات الشهرية
        month_key = po.order_date.strftime('%Y-%m')
        month_name = po.order_date.strftime('%m/%Y')
        
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                'month': month_name,
                'purchase_orders': 0,
                'invoices': 0,
                'others': 0,
                'total': 0
            }
        
        monthly_data[month_key]['purchase_orders'] += po_amount
        monthly_data[month_key]['total'] += po_amount
    
    # 2. تجميع المستخلصات
    for invoice in invoices:
        total_invoice_amount += invoice.invoice_amount
        
        # إضافة إلى قائمة جميع المعاملات
        all_transactions.append({
            'id': invoice.id,
            'type': 'مستخلص',
            'reference_number': invoice.invoice_number,
            'date': invoice.invoice_date,
            'project': invoice.project_name,
            'supplier': invoice.supplier_name,
            'amount': invoice.invoice_amount,
            'url': f"/invoices/{invoice.id}"
        })
        
        # تجميع البيانات الشهرية
        month_key = invoice.invoice_date.strftime('%Y-%m')
        month_name = invoice.invoice_date.strftime('%m/%Y')
        
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                'month': month_name,
                'purchase_orders': 0,
                'invoices': 0,
                'others': 0,
                'total': 0
            }
        
        monthly_data[month_key]['invoices'] += invoice.invoice_amount
        monthly_data[month_key]['total'] += invoice.invoice_amount
    
    # 3. تجميع المعاملات الأخرى
    for transaction in other_transactions:
        total_other_amount += transaction.amount
        
        project_name = transaction.project.name if transaction.project else "غير محدد"
        
        # إضافة إلى قائمة جميع المعاملات
        all_transactions.append({
            'id': transaction.id,
            'type': 'معاملة أخرى',
            'reference_number': transaction.transaction_number,
            'date': transaction.transaction_date,
            'project': project_name,
            'supplier': "", # المعاملات الأخرى قد لا ترتبط بمورد
            'amount': transaction.amount,
            'url': f"/other_transactions/{transaction.id}"
        })
        
        # تجميع البيانات الشهرية
        month_key = transaction.transaction_date.strftime('%Y-%m')
        month_name = transaction.transaction_date.strftime('%m/%Y')
        
        if month_key not in monthly_data:
            monthly_data[month_key] = {
                'month': month_name,
                'purchase_orders': 0,
                'invoices': 0,
                'others': 0,
                'total': 0
            }
        
        monthly_data[month_key]['others'] += transaction.amount
        monthly_data[month_key]['total'] += transaction.amount
    
    # ترتيب المعاملات حسب التاريخ (الأحدث أولاً)
    all_transactions.sort(key=lambda x: x['date'], reverse=True)
    
    # ترتيب البيانات الشهرية حسب التاريخ
    chart_data = list(monthly_data.values())
    chart_data.sort(key=lambda x: datetime.strptime(x['month'], '%m/%Y'))
    
    # إجمالي جميع المعاملات
    total_amount = total_po_amount + total_invoice_amount + total_other_amount
    
    # معالجة طلب التصدير إلى إكسيل
    if export_format == 'excel' and all_transactions:
        # تحضير عناوين الأعمدة للتصدير
        headers = {
            'reference_number': 'الرقم المرجعي',
            'type': 'النوع',
            'date': 'التاريخ',
            'project': 'المشروع',
            'supplier': 'المورد',
            'amount': 'المبلغ',
        }
        
        # تهيئة اسم الملف
        filename = f"total_purchases_report"
        
        # إعداد ملخص كلي للتقرير
        report_summary = {
            'project_name': 'تقرير المشتريات الإجمالية',
            'contract_value': total_amount,  # نستخدم المجموع الكلي كقيمة العقد للتنسيق فقط
            'estimated_budget': total_amount,
            'total_expenses': total_amount,
            'expense_percentage': 100.0,  # النسبة هي 100% بالطبع في حالة التقرير الإجمالي
            'currency': 'ريال سعودي'  # عملة افتراضية
        }
        
        # تصدير البيانات إلى إكسيل مع إضافة الملخص
        return export_to_excel(all_transactions, headers, filename, project_summary=report_summary)
    
    return render_template('reports/total_purchases.html',
                          all_transactions=all_transactions,
                          total_amount=total_amount,
                          total_po_amount=total_po_amount,
                          total_invoice_amount=total_invoice_amount,
                          total_other_amount=total_other_amount,
                          chart_data=chart_data,
                          start_date=start_date_str,
                          end_date=end_date_str)

@reports_bp.route('/purchases_by_supplier', methods=['GET'])
@login_required
def purchases_by_supplier():
    """تقرير المشتريات حسب المورد"""
    
    # تصفية حسب الفترة الزمنية والمورد
    start_date_str = request.args.get('start_date', '')
    end_date_str = request.args.get('end_date', '')
    supplier_id = request.args.get('supplier_id', type=int)
    
    # تحويل التواريخ إذا كانت موجودة
    start_date = None
    end_date = None
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        # إذا كان هناك خطأ في تنسيق التاريخ، استخدم التواريخ الافتراضية
        start_date = None
        end_date = None
    
    # الحصول على الموردين
    suppliers = Supplier.query.order_by(Supplier.name).all()
    selected_supplier = None
    if supplier_id:
        selected_supplier = Supplier.query.get_or_404(supplier_id)
    
    # استعلام أوامر الشراء
    purchase_orders_query = PurchaseOrder.query.filter(PurchaseOrder.status == 'معتمد')
    
    # تطبيق تصفية المورد إذا كان موجوداً
    if supplier_id:
        purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.supplier_id == supplier_id)
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.order_date >= start_date)
    if end_date:
        purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.order_date <= end_date)
        
    # المستخدم العادي يرى فقط المشاريع التي لديه وصول إليها
    if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        project_ids = get_accessible_projects()
        if project_ids:
            purchase_orders_query = purchase_orders_query.filter(PurchaseOrder.project_id.in_(project_ids))
    
    # الحصول على أوامر الشراء
    purchase_orders = purchase_orders_query.all()
    
    # تجميع البيانات حسب المورد
    supplier_data = {}
    total_amount = 0
    
    for po in purchase_orders:
        # حساب قيمة أمر الشراء
        po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
        po_amount = sum(item.price * item.quantity for item in po_items) if po_items else 0
        total_amount += po_amount
        
        # تجميع البيانات حسب المورد
        supplier_name = po.supplier.name if po.supplier else "غير محدد"
        supplier_id = po.supplier.id if po.supplier else 0
        
        if supplier_id not in supplier_data:
            supplier_data[supplier_id] = {
                'name': supplier_name,
                'amount': 0,
                'orders_count': 0
            }
        
        supplier_data[supplier_id]['amount'] += po_amount
        supplier_data[supplier_id]['orders_count'] += 1
    
    # تحويل البيانات إلى قائمة وترتيبها حسب المبلغ (تنازلياً)
    suppliers_chart_data = list(supplier_data.values())
    suppliers_chart_data.sort(key=lambda x: x['amount'], reverse=True)
    
    return render_template('reports/purchases_by_supplier.html',
                          suppliers=suppliers,
                          selected_supplier=selected_supplier,
                          total_amount=total_amount,
                          suppliers_chart_data=suppliers_chart_data,
                          purchase_orders=purchase_orders,
                          start_date=start_date_str,
                          end_date=end_date_str)

@reports_bp.route('/supplier_performance', methods=['GET'])
@login_required
def supplier_performance():
    """تقرير أداء الموردين"""
    
    # تجميع بيانات أداء الموردين
    suppliers = Supplier.query.order_by(Supplier.name).all()
    performance_data = []
    
    for supplier in suppliers:
        # عدد أوامر الشراء المعتمدة
        approved_orders_count = PurchaseOrder.query.filter(
            PurchaseOrder.supplier_id == supplier.id,
            PurchaseOrder.status == 'معتمد'
        ).count()
        
        # عدد أوامر الشراء المعلقة
        pending_orders_count = PurchaseOrder.query.filter(
            PurchaseOrder.supplier_id == supplier.id,
            PurchaseOrder.status == 'قيد الانتظار'
        ).count()
        
        # عدد أوامر الشراء المرفوضة
        rejected_orders_count = PurchaseOrder.query.filter(
            PurchaseOrder.supplier_id == supplier.id,
            PurchaseOrder.status == 'مرفوض'
        ).count()
        
        # إجمالي قيمة أوامر الشراء المعتمدة
        total_purchase_amount = 0
        purchase_orders = PurchaseOrder.query.filter(
            PurchaseOrder.supplier_id == supplier.id,
            PurchaseOrder.status == 'معتمد'
        ).all()
        
        for po in purchase_orders:
            po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
            total_purchase_amount += sum(item.price * item.quantity for item in po_items) if po_items else 0
        
        # الانضمام إلى قائمة الأداء
        performance_data.append({
            'id': supplier.id,
            'name': supplier.name,
            'approved_orders_count': approved_orders_count,
            'pending_orders_count': pending_orders_count,
            'rejected_orders_count': rejected_orders_count,
            'total_orders_count': approved_orders_count + pending_orders_count + rejected_orders_count,
            'total_purchase_amount': total_purchase_amount
        })
    
    # ترتيب البيانات حسب إجمالي قيمة أوامر الشراء (تنازلياً)
    performance_data.sort(key=lambda x: x['total_purchase_amount'], reverse=True)
    
    return render_template('reports/supplier_performance.html',
                          performance_data=performance_data)