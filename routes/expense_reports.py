from flask import Blueprint, render_template, request, jsonify, abort, Response, current_app
from flask_login import login_required, current_user
from app import db
from models import (PurchaseOrder, PurchaseOrderItem, Invoice, InvoiceItem,
                   OtherTransaction, Project, User, UserRole, Supplier)
from datetime import datetime, timedelta, date
from sqlalchemy import func, desc, or_, cast, Float
import json
from permissions import get_accessible_projects, has_access_to_project
from decimal import Decimal
from utils import export_to_excel
import pandas as pd
import io

# إنشاء Blueprint لتقارير المصروفات
expense_reports_bp = Blueprint('expense_reports', __name__, url_prefix='/expense-reports')

def get_user_projects():
    """
    الحصول على قائمة المشاريع المتاحة للمستخدم الحالي
    
    Returns:
        list: قائمة بكائنات المشاريع المتاحة للمستخدم
    """
    if current_user.role in UserRole.ROLES_WITH_FULL_ACCESS or current_user.is_admin:
        # المستخدمون ذوو الصلاحيات الكاملة يمكنهم رؤية جميع المشاريع
        return Project.query.order_by(Project.name).all()
    else:
        # المستخدمون العاديون يمكنهم رؤية المشاريع التي لديهم وصول إليها فقط
        project_ids = get_accessible_projects()
        if project_ids:
            return Project.query.filter(Project.id.in_(project_ids)).order_by(Project.name).all()
        return []

def calculate_project_expenses(project_id, start_date=None, end_date=None):
    """
    حساب المصروفات لمشروع محدد في فترة زمنية محددة

    Args:
        project_id (int): معرف المشروع
        start_date (date, optional): تاريخ البداية. المستوى الافتراضي هو None.
        end_date (date, optional): تاريخ النهاية. المستوى الافتراضي هو None.

    Returns:
        dict: قاموس يحتوي على مجاميع المصروفات المختلفة
    """
    # 1. حساب مجموع قيم أوامر الشراء المعتمدة
    po_query = db.session.query(
        func.coalesce(func.sum(
            PurchaseOrderItem.price * PurchaseOrderItem.quantity
        ), 0)
    ).join(
        PurchaseOrder, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id
    ).filter(
        PurchaseOrder.project_id == project_id,
        PurchaseOrder.approval_status == 'معتمد'
    )
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        po_query = po_query.filter(PurchaseOrder.order_date >= start_date)
    if end_date:
        po_query = po_query.filter(PurchaseOrder.order_date <= end_date)
    
    po_total = po_query.scalar() or 0
    
    # 2. حساب مجموع قيم المستخلصات المعتمدة
    project = Project.query.get(project_id)
    if not project:
        return {
            'purchase_orders': 0,
            'invoices': 0,
            'other_transactions': 0,
            'total': 0
        }
    
    invoice_query = db.session.query(
        func.coalesce(func.sum(Invoice.invoice_amount), 0)
    ).filter(
        Invoice.project_id == project_id,
        Invoice.approval_status == 'معتمد'
    )
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        invoice_query = invoice_query.filter(Invoice.invoice_date >= start_date)
    if end_date:
        invoice_query = invoice_query.filter(Invoice.invoice_date <= end_date)
    
    invoice_total = invoice_query.scalar() or 0
    
    # 3. حساب مجموع قيم المعاملات الأخرى المعتمدة
    other_txn_query = db.session.query(
        func.coalesce(func.sum(OtherTransaction.amount), 0)
    ).filter(
        OtherTransaction.project_id == project_id,
        OtherTransaction.approval_status == 'معتمد',
        OtherTransaction.amount != None  # استثناء المعاملات ذات القيمة الفارغة
    )
    
    # تطبيق تصفية التاريخ إذا كانت موجودة
    if start_date:
        other_txn_query = other_txn_query.filter(OtherTransaction.transaction_date >= start_date)
    if end_date:
        other_txn_query = other_txn_query.filter(OtherTransaction.transaction_date <= end_date)
    
    other_txn_total = other_txn_query.scalar() or 0
    
    # إعادة النتائج
    return {
        'purchase_orders': float(po_total),
        'invoices': float(invoice_total),
        'other_transactions': float(other_txn_total),
        'total': float(po_total + invoice_total + other_txn_total)
    }

@expense_reports_bp.route('/project-expenses', methods=['GET'])
@login_required
def project_expenses():
    """
    تقرير مصاريف المشاريع مع تفاصيل أكثر دقة وشاملة
    """
    # التحقق من طلب التصدير إلى إكسيل
    export_format = request.args.get('export', '')
    
    # الحصول على المشاريع التي يمكن للمستخدم الوصول إليها
    projects = get_user_projects()
    
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
    
    # إذا لم يتم تحديد تاريخ نهاية، استخدم اليوم
    if not end_date:
        end_date = date.today()
    
    # إذا لم يتم تحديد تاريخ بداية، استخدم بداية السنة الحالية
    if not start_date:
        start_date = date(end_date.year, 1, 1)
    
    # تجهيز قائمة بيانات التقرير
    report_data = []
    
    # إذا تم تحديد مشروع محدد
    if selected_project_id:
        # التحقق من أن المستخدم لديه إذن الوصول للمشروع
        if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
            if not has_access_to_project(current_user.id, selected_project_id):
                abort(403)  # غير مصرح
        
        project = Project.query.get(selected_project_id)
        if not project:
            abort(404)  # المشروع غير موجود
        
        # حساب المصروفات للمشروع المحدد
        expenses = calculate_project_expenses(selected_project_id, start_date, end_date)
        
        # قائمة أوامر الشراء الخاصة بالمشروع
        purchase_orders = PurchaseOrder.query.filter(
            PurchaseOrder.project_id == selected_project_id,
            PurchaseOrder.approval_status == 'معتمد'
        )
        if start_date:
            purchase_orders = purchase_orders.filter(PurchaseOrder.order_date >= start_date)
        if end_date:
            purchase_orders = purchase_orders.filter(PurchaseOrder.order_date <= end_date)
        
        purchase_orders = purchase_orders.all()
        po_details = []
        
        for po in purchase_orders:
            items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
            po_amount = sum(item.price * item.quantity for item in items) if items else 0
            
            po_details.append({
                'id': po.id,
                'number': po.order_number,
                'date': po.order_date,
                'supplier': po.supplier.name if po.supplier else "غير محدد",
                'amount': po_amount,
                'status': po.approval_status
            })
        
        # قائمة المستخلصات الخاصة بالمشروع
        invoices = Invoice.query.filter(
            Invoice.project_id == selected_project_id,
            Invoice.approval_status == 'معتمد'
        )
        if start_date:
            invoices = invoices.filter(Invoice.invoice_date >= start_date)
        if end_date:
            invoices = invoices.filter(Invoice.invoice_date <= end_date)
        
        invoices = invoices.all()
        invoice_details = []
        
        for invoice in invoices:
            invoice_details.append({
                'id': invoice.id,
                'number': invoice.invoice_number,
                'date': invoice.invoice_date,
                'supplier': invoice.supplier_name,
                'amount': invoice.invoice_amount,
                'status': invoice.approval_status
            })
        
        # قائمة المعاملات الأخرى الخاصة بالمشروع
        other_transactions = OtherTransaction.query.filter(
            OtherTransaction.project_id == selected_project_id,
            OtherTransaction.approval_status == 'معتمد',
            OtherTransaction.amount != None  # استثناء المعاملات ذات القيمة الفارغة
        )
        if start_date:
            other_transactions = other_transactions.filter(OtherTransaction.transaction_date >= start_date)
        if end_date:
            other_transactions = other_transactions.filter(OtherTransaction.transaction_date <= end_date)
        
        other_transactions = other_transactions.all()
        other_txn_details = []
        
        for txn in other_transactions:
            other_txn_details.append({
                'id': txn.id,
                'number': txn.transaction_number,
                'date': txn.transaction_date,
                'description': txn.description,
                'amount': txn.amount,
                'status': txn.approval_status
            })
        
        # الشهور لبيانات الرسم البياني
        months_data = {}
        # تحديد نطاق الشهور
        current_date = start_date.replace(day=1)
        while current_date <= end_date:
            month_key = current_date.strftime('%Y-%m')
            month_display = current_date.strftime('%m/%Y')
            
            # إضافة بيانات الشهر
            months_data[month_key] = {
                'month': month_display,
                'month_key': month_key,
                'purchase_orders': 0,
                'invoices': 0,
                'other_transactions': 0,
                'total': 0
            }
            
            # الانتقال إلى الشهر التالي
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        # ملء بيانات الرسم البياني
        # 1. أوامر الشراء
        for po in purchase_orders:
            items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
            amount = sum(item.price * item.quantity for item in items) if items else 0
            
            month_key = po.order_date.strftime('%Y-%m')
            if month_key in months_data:
                months_data[month_key]['purchase_orders'] += amount
                months_data[month_key]['total'] += amount
        
        # 2. المستخلصات
        for invoice in invoices:
            month_key = invoice.invoice_date.strftime('%Y-%m')
            if month_key in months_data:
                months_data[month_key]['invoices'] += invoice.invoice_amount
                months_data[month_key]['total'] += invoice.invoice_amount
        
        # 3. المعاملات الأخرى
        for txn in other_transactions:
            month_key = txn.transaction_date.strftime('%Y-%m')
            if month_key in months_data:
                months_data[month_key]['other_transactions'] += txn.amount
                months_data[month_key]['total'] += txn.amount
        
        # تحويل بيانات الشهور إلى قائمة مرتبة
        chart_data = list(months_data.values())
        chart_data.sort(key=lambda x: datetime.strptime(x['month'], '%m/%Y'))
        
        # إذا كان هناك طلب تصدير إلى إكسيل
        if export_format == 'excel':
            # تجهيز بيانات التصدير
            # 1. تفاصيل المشروع
            project_data = {
                'project_name': project.name,
                'project_code': project.code,
                'client_name': project.client_name,
                'start_date': start_date.strftime('%Y-%m-%d'),
                'end_date': end_date.strftime('%Y-%m-%d'),
                'contract_value': project.contract_value or 0,
                'estimated_budget': project.estimated_budget or 0,
                'total_expenses': expenses['total'],
                'expense_percentage': (expenses['total'] / project.estimated_budget * 100) if project.estimated_budget and project.estimated_budget > 0 else 0,
                'currency': project.currency or 'ريال سعودي'
            }
            
            # تجهيز الملف
            # Sheet 1: ملخص المشروع والمصروفات
            summary_df = pd.DataFrame({
                'البند': ['اسم المشروع', 'كود المشروع', 'العميل', 'قيمة العقد', 'الميزانية التقديرية', 
                         'إجمالي المصروفات', 'نسبة الإنفاق من الميزانية', 'الفترة الزمنية'],
                'القيمة': [
                    project.name,
                    project.code,
                    project.client_name,
                    f"{project.contract_value:,.2f} {project.currency}" if project.contract_value else "غير محدد",
                    f"{project.estimated_budget:,.2f} {project.currency}" if project.estimated_budget else "غير محدد",
                    f"{expenses['total']:,.2f} {project.currency}",
                    f"{(expenses['total'] / project.estimated_budget * 100):,.2f}%" if project.estimated_budget and project.estimated_budget > 0 else "غير محدد",
                    f"من {start_date.strftime('%Y-%m-%d')} إلى {end_date.strftime('%Y-%m-%d')}"
                ]
            })
            
            # Sheet 2: تفاصيل أوامر الشراء
            po_df = pd.DataFrame(po_details)
            if not po_df.empty:
                po_df = po_df.rename(columns={
                    'id': 'الرقم التسلسلي',
                    'number': 'رقم أمر الشراء',
                    'date': 'تاريخ الأمر',
                    'supplier': 'المورد',
                    'amount': 'المبلغ',
                    'status': 'الحالة'
                })
            
            # Sheet 3: تفاصيل المستخلصات
            invoice_df = pd.DataFrame(invoice_details)
            if not invoice_df.empty:
                invoice_df = invoice_df.rename(columns={
                    'id': 'الرقم التسلسلي',
                    'number': 'رقم المستخلص',
                    'date': 'تاريخ المستخلص',
                    'supplier': 'المورد',
                    'amount': 'المبلغ',
                    'status': 'الحالة'
                })
            
            # Sheet 4: تفاصيل المعاملات الأخرى
            other_txn_df = pd.DataFrame(other_txn_details)
            if not other_txn_df.empty:
                other_txn_df = other_txn_df.rename(columns={
                    'id': 'الرقم التسلسلي',
                    'number': 'رقم المعاملة',
                    'date': 'تاريخ المعاملة',
                    'description': 'الوصف',
                    'amount': 'المبلغ',
                    'status': 'الحالة'
                })
            
            # Sheet 5: البيانات الشهرية
            monthly_df = pd.DataFrame(chart_data)
            if not monthly_df.empty:
                monthly_df = monthly_df.rename(columns={
                    'month': 'الشهر',
                    'purchase_orders': 'أوامر الشراء',
                    'invoices': 'المستخلصات',
                    'other_transactions': 'المعاملات الأخرى',
                    'total': 'الإجمالي'
                })
                # إزالة حقل month_key غير المطلوب في التصدير
                monthly_df = monthly_df.drop('month_key', axis=1, errors='ignore')
            
            # إنشاء كائن إكسيل متعدد الصفحات
            output = io.BytesIO()
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                summary_df.to_excel(writer, sheet_name='ملخص المشروع', index=False)
                if not po_df.empty:
                    po_df.to_excel(writer, sheet_name='أوامر الشراء', index=False)
                if not invoice_df.empty:
                    invoice_df.to_excel(writer, sheet_name='المستخلصات', index=False)
                if not other_txn_df.empty:
                    other_txn_df.to_excel(writer, sheet_name='المعاملات الأخرى', index=False)
                if not monthly_df.empty:
                    monthly_df.to_excel(writer, sheet_name='البيانات الشهرية', index=False)
            
            output.seek(0)
            
            # إعداد استجابة الملف
            filename = f"expense_report_{project.code}_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.xlsx"
            return Response(
                output,
                mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                }
            )
        
        # استجابة عرض القالب
        return render_template(
            'reports/project_expenses_detailed.html',
            project=project,
            expenses=expenses,
            start_date=start_date,
            end_date=end_date,
            projects=projects,
            po_details=po_details,
            invoice_details=invoice_details,
            other_txn_details=other_txn_details,
            chart_data=json.dumps(chart_data)
        )
    
    # إذا لم يتم تحديد مشروع، عرض جميع المشاريع المتاحة
    for project in projects:
        # حساب المصروفات لكل مشروع
        expenses = calculate_project_expenses(project.id, start_date, end_date)
        
        # حساب نسبة الإنفاق من الميزانية
        budget_percentage = 0
        if project.estimated_budget and project.estimated_budget > 0:
            budget_percentage = (expenses['total'] / project.estimated_budget) * 100
        
        # إضافة بيانات المشروع إلى قائمة التقرير
        report_data.append({
            'id': project.id,
            'name': project.name,
            'code': project.code,
            'client': project.client_name,
            'po_total': expenses['purchase_orders'],
            'invoice_total': expenses['invoices'],
            'other_transactions_total': expenses['other_transactions'],
            'total_expenses': expenses['total'],
            'estimated_budget': project.estimated_budget or 0,
            'budget_percentage': budget_percentage,
            'status': project.status,
            'start_date': project.start_date,
            'end_date': project.expected_end_date
        })
    
    # إذا كان هناك طلب تصدير إلى إكسيل
    if export_format == 'excel' and report_data:
        # تجهيز عناوين الأعمدة للتصدير
        headers = {
            'name': 'اسم المشروع',
            'code': 'كود المشروع',
            'client': 'العميل',
            'po_total': 'إجمالي أوامر الشراء',
            'invoice_total': 'إجمالي المستخلصات',
            'other_transactions_total': 'إجمالي المعاملات الأخرى',
            'total_expenses': 'إجمالي المصاريف',
            'estimated_budget': 'الميزانية التقديرية',
            'budget_percentage': 'نسبة الإنفاق من الميزانية (%)',
            'status': 'حالة المشروع',
            'start_date': 'تاريخ البداية',
            'end_date': 'تاريخ النهاية المتوقع'
        }
        
        # اسم الملف
        filename = f"projects_expenses_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}"
        
        # إعداد ملخص للتقرير
        total_projects = len(report_data)
        total_expenses_all = sum(project['total_expenses'] for project in report_data)
        total_budget_all = sum(project['estimated_budget'] for project in report_data)
        total_percentage = round((total_expenses_all / total_budget_all) * 100, 1) if total_budget_all > 0 else 0
        
        report_summary = {
            'project_name': 'تقرير مصروفات جميع المشاريع',
            'contract_value': total_budget_all,
            'estimated_budget': total_budget_all,
            'total_expenses': total_expenses_all,
            'expense_percentage': total_percentage,
            'currency': 'ريال سعودي'
        }
        
        # تصدير البيانات إلى إكسيل
        return export_to_excel(report_data, headers, filename, project_summary=report_summary)
    
    # استجابة عرض القالب
    return render_template(
        'reports/projects_expenses_summary.html',
        report_data=report_data,
        start_date=start_date,
        end_date=end_date,
        projects=projects
    )

@expense_reports_bp.route('/project-expenses-api', methods=['GET'])
@login_required
def project_expenses_api():
    """
    واجهة برمجة التطبيقات لتقرير مصاريف المشاريع - تستخدم لعرض الرسوم البيانية
    """
    project_id = request.args.get('project_id', type=int)
    if not project_id:
        return jsonify({'error': 'معرف المشروع مطلوب'}), 400
    
    # التحقق من وجود المشروع وإمكانية الوصول إليه
    project = Project.query.get(project_id)
    if not project:
        return jsonify({'error': 'المشروع غير موجود'}), 404
    
    if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        if not has_access_to_project(current_user.id, project_id):
            return jsonify({'error': 'غير مصرح بالوصول إلى هذا المشروع'}), 403
    
    # تاريخ البداية والنهاية
    start_date_str = request.args.get('start_date', '')
    end_date_str = request.args.get('end_date', '')
    
    # تحويل التواريخ
    start_date = None
    end_date = None
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({'error': 'تنسيق التاريخ غير صحيح'}), 400
    
    # إذا لم يتم تحديد تاريخ نهاية، استخدم اليوم
    if not end_date:
        end_date = date.today()
    
    # إذا لم يتم تحديد تاريخ بداية، استخدم بداية السنة الحالية
    if not start_date:
        start_date = date(end_date.year, 1, 1)
    
    # إنشاء قاموس الشهور
    months_data = {}
    current_date = start_date.replace(day=1)
    
    while current_date <= end_date:
        month_key = current_date.strftime('%Y-%m')
        month_display = current_date.strftime('%m/%Y')
        
        months_data[month_key] = {
            'month': month_display,
            'purchase_orders': 0,
            'invoices': 0,
            'other_transactions': 0,
            'total': 0
        }
        
        # الانتقال إلى الشهر التالي
        if current_date.month == 12:
            current_date = current_date.replace(year=current_date.year + 1, month=1)
        else:
            current_date = current_date.replace(month=current_date.month + 1)
    
    # 1. جمع بيانات أوامر الشراء المعتمدة
    purchase_orders = PurchaseOrder.query.filter(
        PurchaseOrder.project_id == project_id,
        PurchaseOrder.approval_status == 'معتمد',
        PurchaseOrder.order_date >= start_date,
        PurchaseOrder.order_date <= end_date
    ).all()
    
    for po in purchase_orders:
        po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
        amount = sum(item.price * item.quantity for item in po_items) if po_items else 0
        
        month_key = po.order_date.strftime('%Y-%m')
        if month_key in months_data:
            months_data[month_key]['purchase_orders'] += amount
            months_data[month_key]['total'] += amount
    
    # 2. جمع بيانات المستخلصات المعتمدة
    invoices = Invoice.query.filter(
        Invoice.project_id == project_id,
        Invoice.approval_status == 'معتمد',
        Invoice.invoice_date >= start_date,
        Invoice.invoice_date <= end_date
    ).all()
    
    for invoice in invoices:
        month_key = invoice.invoice_date.strftime('%Y-%m')
        if month_key in months_data:
            months_data[month_key]['invoices'] += invoice.invoice_amount
            months_data[month_key]['total'] += invoice.invoice_amount
    
    # 3. جمع بيانات المعاملات الأخرى المعتمدة
    other_transactions = OtherTransaction.query.filter(
        OtherTransaction.project_id == project_id,
        OtherTransaction.approval_status == 'معتمد',
        OtherTransaction.amount != None,  # استثناء المعاملات ذات القيمة الفارغة
        OtherTransaction.transaction_date >= start_date,
        OtherTransaction.transaction_date <= end_date
    ).all()
    
    for transaction in other_transactions:
        month_key = transaction.transaction_date.strftime('%Y-%m')
        if month_key in months_data:
            # تحقق من أن transaction.amount ليس فارغاً (None)
            if transaction.amount is not None:
                months_data[month_key]['other_transactions'] += transaction.amount
                months_data[month_key]['total'] += transaction.amount
    
    # تحويل البيانات إلى قائمة وترتيبها حسب الشهر
    chart_data = list(months_data.values())
    chart_data.sort(key=lambda x: datetime.strptime(x['month'], '%m/%Y'))
    
    return jsonify({
        "project_name": project.name,
        "chart_data": chart_data
    })

@expense_reports_bp.route('/expense-trends', methods=['GET'])
@login_required
def expense_trends():
    """
    تقرير اتجاهات المصروفات عبر الزمن
    """
    # الحصول على المشاريع التي يمكن للمستخدم الوصول إليها
    projects = get_user_projects()
    
    # تاريخ البداية والنهاية
    start_date_str = request.args.get('start_date', '')
    end_date_str = request.args.get('end_date', '')
    period = request.args.get('period', 'monthly')  # monthly, quarterly, yearly
    
    # تحويل التواريخ
    start_date = None
    end_date = None
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        start_date = None
        end_date = None
    
    # إذا لم يتم تحديد تاريخ نهاية، استخدم اليوم
    if not end_date:
        end_date = date.today()
    
    # إذا لم يتم تحديد تاريخ بداية، استخدم بداية السنة الحالية
    if not start_date:
        if period == 'yearly':
            # للعرض السنوي، نعود 5 سنوات للخلف
            start_date = date(end_date.year - 5, 1, 1)
        elif period == 'quarterly':
            # للعرض الربع سنوي، نعود سنتين للخلف
            start_date = date(end_date.year - 2, 1, 1)
        else:
            # للعرض الشهري، نعود سنة واحدة للخلف
            start_date = date(end_date.year - 1, end_date.month, 1)
    
    # تجهيز بيانات الرسم البياني حسب الفترة المحددة
    if period == 'yearly':
        # إنشاء بيانات سنوية
        years_data = {}
        for year in range(start_date.year, end_date.year + 1):
            years_data[str(year)] = {
                'period': str(year),
                'purchase_orders': 0,
                'invoices': 0,
                'other_transactions': 0,
                'total': 0
            }
        
        # جمع بيانات أوامر الشراء
        po_data = db.session.query(
            func.extract('year', PurchaseOrder.order_date).label('year'),
            func.sum(PurchaseOrderItem.price * PurchaseOrderItem.quantity).label('amount')
        ).join(
            PurchaseOrderItem, PurchaseOrderItem.purchase_order_id == PurchaseOrder.id
        ).filter(
            PurchaseOrder.approval_status == 'معتمد',
            PurchaseOrder.order_date >= start_date,
            PurchaseOrder.order_date <= end_date
        ).group_by(
            func.extract('year', PurchaseOrder.order_date)
        ).all()
        
        for year, amount in po_data:
            year_str = str(int(year))
            if year_str in years_data:
                years_data[year_str]['purchase_orders'] = float(amount) if amount else 0
                years_data[year_str]['total'] += float(amount) if amount else 0
        
        # جمع بيانات المستخلصات
        invoice_data = db.session.query(
            func.extract('year', Invoice.invoice_date).label('year'),
            func.sum(Invoice.invoice_amount).label('amount')
        ).filter(
            Invoice.approval_status == 'معتمد',
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date <= end_date
        ).group_by(
            func.extract('year', Invoice.invoice_date)
        ).all()
        
        for year, amount in invoice_data:
            year_str = str(int(year))
            if year_str in years_data:
                years_data[year_str]['invoices'] = float(amount) if amount else 0
                years_data[year_str]['total'] += float(amount) if amount else 0
        
        # جمع بيانات المعاملات الأخرى
        other_txn_data = db.session.query(
            func.extract('year', OtherTransaction.transaction_date).label('year'),
            func.sum(OtherTransaction.amount).label('amount')
        ).filter(
            OtherTransaction.approval_status == "معتمد",
            OtherTransaction.amount != None,  # استثناء المعاملات ذات القيمة الفارغة
            OtherTransaction.transaction_date >= start_date,
            OtherTransaction.transaction_date <= end_date
        ).group_by(
            func.extract('year', OtherTransaction.transaction_date)
        ).all()
        
        for year, amount in other_txn_data:
            year_str = str(int(year))
            if year_str in years_data:
                years_data[year_str]['other_transactions'] = float(amount) if amount else 0
                years_data[year_str]['total'] += float(amount) if amount else 0
        
        # تحويل إلى قائمة وترتيب
        chart_data = list(years_data.values())
        chart_data.sort(key=lambda x: x['period'])
        
    elif period == 'quarterly':
        # إنشاء بيانات ربع سنوية
        quarters_data = {}
        current_date = start_date.replace(day=1)
        
        while current_date <= end_date:
            quarter = (current_date.month - 1) // 3 + 1
            quarter_key = f"{current_date.year}-Q{quarter}"
            quarter_display = f"Q{quarter} {current_date.year}"
            
            if quarter_key not in quarters_data:
                quarters_data[quarter_key] = {
                    'period': quarter_display,
                    'period_key': quarter_key,
                    'purchase_orders': 0,
                    'invoices': 0,
                    'other_transactions': 0,
                    'total': 0
                }
            
            # الانتقال إلى الشهر التالي
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        # تحويل الربع السنوي إلى رقم (1, 2, 3, 4)
        def get_quarter(date_val):
            return (date_val.month - 1) // 3 + 1
        
        # 1. جمع بيانات أوامر الشراء
        purchase_orders = PurchaseOrder.query.filter(
            PurchaseOrder.approval_status == 'معتمد',
            PurchaseOrder.order_date >= start_date,
            PurchaseOrder.order_date <= end_date
        ).all()
        
        for po in purchase_orders:
            quarter = get_quarter(po.order_date)
            quarter_key = f"{po.order_date.year}-Q{quarter}"
            
            if quarter_key in quarters_data:
                po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
                amount = sum(item.price * item.quantity for item in po_items) if po_items else 0
                
                quarters_data[quarter_key]['purchase_orders'] += amount
                quarters_data[quarter_key]['total'] += amount
        
        # 2. جمع بيانات المستخلصات
        invoices = Invoice.query.filter(
            Invoice.approval_status == 'معتمد',
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date <= end_date
        ).all()
        
        for invoice in invoices:
            quarter = get_quarter(invoice.invoice_date)
            quarter_key = f"{invoice.invoice_date.year}-Q{quarter}"
            
            if quarter_key in quarters_data:
                quarters_data[quarter_key]['invoices'] += invoice.invoice_amount
                quarters_data[quarter_key]['total'] += invoice.invoice_amount
        
        # 3. جمع بيانات المعاملات الأخرى
        other_transactions = OtherTransaction.query.filter(
            OtherTransaction.approval_status == "معتمد",
            OtherTransaction.amount != None,  # استثناء المعاملات ذات القيمة الفارغة
            OtherTransaction.transaction_date >= start_date,
            OtherTransaction.transaction_date <= end_date
        ).all()
        
        for transaction in other_transactions:
            quarter = get_quarter(transaction.transaction_date)
            quarter_key = f"{transaction.transaction_date.year}-Q{quarter}"
            
            if quarter_key in quarters_data:
                # تحقق من أن transaction.amount ليس فارغاً (None)
                if transaction.amount is not None:
                    quarters_data[quarter_key]['other_transactions'] += transaction.amount
                    quarters_data[quarter_key]['total'] += transaction.amount
        
        # تحويل إلى قائمة وترتيب
        chart_data = list(quarters_data.values())
        chart_data.sort(key=lambda x: x['period_key'])
        
    else:  # monthly
        # إنشاء بيانات شهرية
        months_data = {}
        current_date = start_date.replace(day=1)
        
        while current_date <= end_date:
            month_key = current_date.strftime('%Y-%m')
            month_display = current_date.strftime('%m/%Y')
            
            months_data[month_key] = {
                'period': month_display,
                'period_key': month_key,
                'purchase_orders': 0,
                'invoices': 0,
                'other_transactions': 0,
                'total': 0
            }
            
            # الانتقال إلى الشهر التالي
            if current_date.month == 12:
                current_date = current_date.replace(year=current_date.year + 1, month=1)
            else:
                current_date = current_date.replace(month=current_date.month + 1)
        
        # 1. جمع بيانات أوامر الشراء
        purchase_orders = PurchaseOrder.query.filter(
            PurchaseOrder.approval_status == 'معتمد',
            PurchaseOrder.order_date >= start_date,
            PurchaseOrder.order_date <= end_date
        ).all()
        
        for po in purchase_orders:
            month_key = po.order_date.strftime('%Y-%m')
            if month_key in months_data:
                po_items = PurchaseOrderItem.query.filter_by(purchase_order_id=po.id).all()
                amount = sum(item.price * item.quantity for item in po_items) if po_items else 0
                
                months_data[month_key]['purchase_orders'] += amount
                months_data[month_key]['total'] += amount
        
        # 2. جمع بيانات المستخلصات
        invoices = Invoice.query.filter(
            Invoice.approval_status == 'معتمد',
            Invoice.invoice_date >= start_date,
            Invoice.invoice_date <= end_date
        ).all()
        
        for invoice in invoices:
            month_key = invoice.invoice_date.strftime('%Y-%m')
            if month_key in months_data:
                months_data[month_key]['invoices'] += invoice.invoice_amount
                months_data[month_key]['total'] += invoice.invoice_amount
        
        # 3. جمع بيانات المعاملات الأخرى
        other_transactions = OtherTransaction.query.filter(
            OtherTransaction.approval_status == "معتمد",
            OtherTransaction.amount != None,  # استثناء المعاملات ذات القيمة الفارغة
            OtherTransaction.transaction_date >= start_date,
            OtherTransaction.transaction_date <= end_date
        ).all()
        
        for transaction in other_transactions:
            month_key = transaction.transaction_date.strftime('%Y-%m')
            if month_key in months_data:
                # تحقق من أن transaction.amount ليس فارغاً (None)
                if transaction.amount is not None:
                    months_data[month_key]['other_transactions'] += transaction.amount
                    months_data[month_key]['total'] += transaction.amount
        
        # تحويل إلى قائمة وترتيب
        chart_data = list(months_data.values())
        chart_data.sort(key=lambda x: x['period_key'])
    
    # التحضير لعرض القالب
    return render_template(
        'reports/expense_trends.html',
        chart_data=json.dumps(chart_data),
        projects=projects,
        start_date=start_date,
        end_date=end_date,
        period=period
    )

@expense_reports_bp.route('/expense-comparison', methods=['GET'])
@login_required
def expense_comparison():
    """
    تقرير مقارنة المصروفات بين المشاريع
    """
    # الحصول على المشاريع التي يمكن للمستخدم الوصول إليها
    projects = get_user_projects()
    
    # التحقق من طلب التصدير إلى إكسيل
    export_format = request.args.get('export', '')
    
    # تحديد المشاريع المطلوب مقارنتها
    project_ids = request.args.getlist('project_ids', type=int)
    
    # تاريخ البداية والنهاية
    start_date_str = request.args.get('start_date', '')
    end_date_str = request.args.get('end_date', '')
    
    # تحويل التواريخ
    start_date = None
    end_date = None
    
    try:
        if start_date_str:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        if end_date_str:
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
    except ValueError:
        start_date = None
        end_date = None
    
    # إذا لم يتم تحديد تاريخ نهاية، استخدم اليوم
    if not end_date:
        end_date = date.today()
    
    # إذا لم يتم تحديد تاريخ بداية، استخدم بداية السنة الحالية
    if not start_date:
        start_date = date(end_date.year, 1, 1)
    
    # إذا لم يتم تحديد مشاريع، استخدم جميع المشاريع المتاحة
    if not project_ids and projects:
        project_ids = [p.id for p in projects]
    
    # تجهيز بيانات المقارنة
    comparison_data = []
    selected_projects = []
    
    for project_id in project_ids:
        project = Project.query.get(project_id)
        if not project:
            continue
        
        # التحقق من إمكانية الوصول
        if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
            if not has_access_to_project(current_user.id, project_id):
                continue
        
        selected_projects.append(project)
        
        # حساب المصروفات للمشروع
        expenses = calculate_project_expenses(project_id, start_date, end_date)
        
        # حساب نسبة الإنفاق من الميزانية
        budget_percentage = 0
        if project.estimated_budget and project.estimated_budget > 0:
            budget_percentage = (expenses['total'] / project.estimated_budget) * 100
        
        # المدة الزمنية للمشروع
        project_duration = None
        if project.start_date and project.expected_end_date:
            delta = project.expected_end_date - project.start_date
            project_duration = delta.days
        
        # حساب معدل الإنفاق اليومي
        daily_expense_rate = 0
        if project_duration and project_duration > 0:
            daily_expense_rate = expenses['total'] / project_duration
        
        # إضافة بيانات المشروع
        comparison_data.append({
            'id': project.id,
            'name': project.name,
            'code': project.code,
            'client': project.client_name,
            'status': project.status,
            'start_date': project.start_date,
            'end_date': project.expected_end_date,
            'duration': project_duration,
            'estimated_budget': project.estimated_budget or 0,
            'po_total': expenses['purchase_orders'],
            'invoice_total': expenses['invoices'],
            'other_txn_total': expenses['other_transactions'],
            'total_expenses': expenses['total'],
            'budget_percentage': budget_percentage,
            'daily_expense_rate': daily_expense_rate
        })
    
    # ترتيب البيانات حسب إجمالي المصروفات (تنازلياً)
    comparison_data.sort(key=lambda x: x['total_expenses'], reverse=True)
    
    # إذا كان هناك طلب تصدير إلى إكسيل
    if export_format == 'excel' and comparison_data:
        # تجهيز عناوين الأعمدة للتصدير
        headers = {
            'name': 'اسم المشروع',
            'code': 'كود المشروع',
            'client': 'العميل',
            'status': 'حالة المشروع',
            'start_date': 'تاريخ البداية',
            'end_date': 'تاريخ النهاية المتوقع',
            'duration': 'مدة المشروع (بالأيام)',
            'estimated_budget': 'الميزانية التقديرية',
            'po_total': 'إجمالي أوامر الشراء',
            'invoice_total': 'إجمالي المستخلصات',
            'other_txn_total': 'إجمالي المعاملات الأخرى',
            'total_expenses': 'إجمالي المصاريف',
            'budget_percentage': 'نسبة الإنفاق من الميزانية (%)',
            'daily_expense_rate': 'معدل الإنفاق اليومي'
        }
        
        # اسم الملف
        filename = f"projects_comparison_report_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}"
        
        # إعداد ملخص للتقرير
        report_summary = {
            'project_name': 'تقرير مقارنة المصروفات بين المشاريع',
            'period': f"من {start_date.strftime('%Y-%m-%d')} إلى {end_date.strftime('%Y-%m-%d')}",
            'projects_count': len(comparison_data),
            'currency': 'ريال سعودي'
        }
        
        # تصدير البيانات إلى إكسيل
        return export_to_excel(comparison_data, headers, filename, project_summary=report_summary)
    
    # استجابة عرض القالب
    return render_template(
        'reports/expense_comparison.html',
        comparison_data=comparison_data,
        projects=projects,
        selected_projects=selected_projects,
        start_date=start_date,
        end_date=end_date
    )