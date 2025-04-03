from datetime import datetime
from flask import Blueprint, render_template, redirect, url_for, request, flash, abort, jsonify, session
from flask_login import login_required, current_user
from werkzeug.utils import secure_filename
import os
from sqlalchemy import or_, desc

from models import Project, db, UserPermission, PurchaseOrder, Invoice, OtherTransaction, User, ProjectManager
from routes.auth_utils import requires_permission, check_permission, get_user_modules
from routes.route_utils import handle_db_error, handle_error

# تسجيل مسارات المشاريع
projects_bp = Blueprint('projects', __name__)

@projects_bp.route('/')
@login_required
@requires_permission('projects', 'can_read')
def list_projects():
    """
    عرض قائمة المشاريع
    """
    try:
        # التحقق من وجود معايير بحث
        search_query = request.args.get('search', '')
        status_filter = request.args.get('status', '')
        
        # بناء الاستعلام الأساسي
        query = Project.query
        
        # إضافة معايير البحث إذا كانت موجودة
        if search_query:
            query = query.filter(
                or_(
                    Project.name.ilike(f'%{search_query}%'),
                    Project.code.ilike(f'%{search_query}%'),
                    Project.client_name.ilike(f'%{search_query}%')
                )
            )
        
        # تصفية حسب الحالة
        if status_filter:
            query = query.filter(Project.status == status_filter)
        
        # ترتيب النتائج حسب تاريخ الإنشاء (الأحدث أولاً)
        projects = query.order_by(desc(Project.created_at)).all()
        
        # الحصول على صلاحيات المستخدم الحالي
        can_create = check_permission('projects', 'can_create')
        can_update = check_permission('projects', 'can_update')
        can_delete = check_permission('projects', 'can_delete')
        
        # حساب إحصائيات المشاريع
        stats = {
            'total': Project.query.count(),
            'active': Project.query.filter_by(status='نشط').count(),
            'completed': Project.query.filter_by(status='مكتمل').count(),
            'on_hold': Project.query.filter_by(status='متوقف').count(),
            'cancelled': Project.query.filter_by(status='ملغي').count()
        }
        
        # الحصول على قائمة بالوحدات المتاحة للمستخدم
        modules = get_user_modules()
        
        return render_template(
            'projects/index.html',
            projects=projects,
            search_query=search_query,
            status_filter=status_filter,
            can_create=can_create,
            can_update=can_update,
            can_delete=can_delete,
            stats=stats,
            modules=modules
        )
    except Exception as e:
        return handle_error(e, 'حدث خطأ أثناء عرض قائمة المشاريع')

@projects_bp.route('/new', methods=['GET', 'POST'])
@login_required
@requires_permission('projects', 'can_create')
def create_project():
    """
    إنشاء مشروع جديد
    """
    try:
        if request.method == 'POST':
            # الحصول على بيانات النموذج
            name = request.form.get('name')
            code = request.form.get('code')
            description = request.form.get('description')
            client_name = request.form.get('client_name')
            client_contact_person = request.form.get('client_contact_person')
            client_email = request.form.get('client_email')
            client_phone = request.form.get('client_phone')
            location = request.form.get('location')
            start_date_str = request.form.get('start_date')
            expected_end_date_str = request.form.get('expected_end_date')
            contract_value = request.form.get('contract_value')
            estimated_budget = request.form.get('estimated_budget')
            currency = request.form.get('currency')
            manager_id = request.form.get('manager_id')
            
            # الحصول على قائمة مديري المشروع المختارين
            project_manager_ids = request.form.getlist('project_managers[]')
            
            # التحقق من البيانات الإلزامية
            if not name or not code or not client_name:
                flash('الرجاء ملء جميع الحقول المطلوبة', 'danger')
                return redirect(url_for('projects.create_project'))
            
            # التحقق من عدم وجود مشروع بنفس الكود
            existing_project = Project.query.filter_by(code=code).first()
            if existing_project:
                flash('يوجد مشروع بنفس الكود، الرجاء استخدام كود آخر', 'danger')
                return redirect(url_for('projects.create_project'))
            
            # تحويل التواريخ
            start_date = None
            if start_date_str:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                
            expected_end_date = None
            if expected_end_date_str:
                expected_end_date = datetime.strptime(expected_end_date_str, '%Y-%m-%d').date()
            
            # تحويل قيمة العقد إلى رقم عشري
            contract_value_float = None
            if contract_value:
                try:
                    contract_value_float = float(contract_value)
                except ValueError:
                    flash('قيمة العقد يجب أن تكون رقمًا صحيحًا', 'danger')
                    return redirect(url_for('projects.create_project'))
            
            # تحويل الميزانية التقديرية إلى رقم عشري
            estimated_budget_float = None
            if estimated_budget:
                try:
                    estimated_budget_float = float(estimated_budget)
                except ValueError:
                    flash('الميزانية التقديرية يجب أن تكون رقمًا صحيحًا', 'danger')
                    return redirect(url_for('projects.create_project'))
            
            # إنشاء كائن المشروع الجديد
            new_project = Project(
                name=name,
                code=code,
                description=description,
                client_name=client_name,
                client_contact_person=client_contact_person,
                client_email=client_email,
                client_phone=client_phone,
                location=location,
                start_date=start_date,
                expected_end_date=expected_end_date,
                contract_value=contract_value_float,
                estimated_budget=estimated_budget_float,
                currency=currency,
                manager_id=manager_id if manager_id else None,
                created_by=current_user.id,
                status='نشط'  # الحالة الافتراضية للمشروع الجديد هي "نشط"
            )
            
            # حفظ المشروع في قاعدة البيانات
            db.session.add(new_project)
            db.session.commit()
            
            # إضافة مديري المشروع
            if project_manager_ids:
                for manager_id in project_manager_ids:
                    try:
                        manager_id = int(manager_id)
                        # التحقق من وجود المستخدم
                        user = User.query.get(manager_id)
                        if user:
                            # إنشاء علاقة مدير مشروع جديدة
                            project_manager = ProjectManager(
                                project_id=new_project.id,
                                user_id=manager_id,
                                role_description=f"مدير مشروع - {user.role}"
                            )
                            db.session.add(project_manager)
                    except (ValueError, TypeError):
                        # تجاهل القيم غير الصالحة
                        pass
                
                # حفظ مديري المشروع
                db.session.commit()
            
            flash('تم إضافة المشروع بنجاح', 'success')
            return redirect(url_for('projects.list_projects'))
        
        # إذا كانت الطلب GET، نعرض صفحة إنشاء مشروع جديد
        from models import User
        # الحصول على قائمة جميع المستخدمين الذين يمكن تعيينهم كمدراء للمشروع
        managers = User.query.all()
        
        # الحصول على قائمة بالوحدات المتاحة للمستخدم
        modules = get_user_modules()
        
        return render_template(
            'projects/create.html',
            managers=managers,
            modules=modules
        )
    except Exception as e:
        return handle_error(e, 'حدث خطأ أثناء إنشاء المشروع')

@projects_bp.route('/<int:project_id>', methods=['GET'])
@login_required
@requires_permission('projects', 'can_read')
def view_project(project_id):
    """
    عرض تفاصيل مشروع محدد
    """
    try:
        # الحصول على المشروع من قاعدة البيانات
        project = Project.query.get_or_404(project_id)
        
        # الحصول على المعاملات المرتبطة بالمشروع
        purchase_orders = PurchaseOrder.query.filter_by(project_id=project_id).order_by(desc(PurchaseOrder.created_at)).all()
        invoices = Invoice.query.filter_by(project_id=project_id).order_by(desc(Invoice.created_at)).all()
        other_transactions = OtherTransaction.query.filter_by(project_id=project_id).order_by(desc(OtherTransaction.created_at)).all()
        
        # الحصول على صلاحيات المستخدم
        can_update = check_permission('projects', 'can_update')
        can_delete = check_permission('projects', 'can_delete')
        
        # الحصول على معلومات مدير المشروع (القديم)
        manager = None
        if project.manager_id:
            from models import User
            manager = User.query.get(project.manager_id)
        
        # الحصول على قائمة مديري المشروع من الجدول الجديد
        project_managers = []
        for pm in project.project_managers:
            user = User.query.get(pm.user_id)
            if user:
                project_managers.append({
                    'user': user,
                    'role_description': pm.role_description
                })
        
        # الحصول على معلومات منشئ المشروع
        from models import User
        creator = User.query.get(project.created_by)
        
        # الحصول على قائمة بالوحدات المتاحة للمستخدم
        modules = get_user_modules()
        
        # عرض صفحة تفاصيل المشروع
        return render_template(
            'projects/view.html',
            project=project,
            purchase_orders=purchase_orders,
            invoices=invoices,
            other_transactions=other_transactions,
            can_update=can_update,
            can_delete=can_delete,
            manager=manager,
            creator=creator,
            project_managers=project_managers,
            modules=modules
        )
    except Exception as e:
        return handle_error(e, 'حدث خطأ أثناء عرض تفاصيل المشروع')

@projects_bp.route('/<int:project_id>/edit', methods=['GET', 'POST'])
@login_required
@requires_permission('projects', 'can_update')
def edit_project(project_id):
    """
    تعديل مشروع موجود
    """
    try:
        # الحصول على المشروع من قاعدة البيانات
        project = Project.query.get_or_404(project_id)
        
        if request.method == 'POST':
            # الحصول على بيانات النموذج
            name = request.form.get('name')
            code = request.form.get('code')
            description = request.form.get('description')
            client_name = request.form.get('client_name')
            client_contact_person = request.form.get('client_contact_person')
            client_email = request.form.get('client_email')
            client_phone = request.form.get('client_phone')
            location = request.form.get('location')
            start_date_str = request.form.get('start_date')
            expected_end_date_str = request.form.get('expected_end_date')
            actual_end_date_str = request.form.get('actual_end_date')
            contract_value = request.form.get('contract_value')
            estimated_budget = request.form.get('estimated_budget')
            currency = request.form.get('currency')
            status = request.form.get('status')
            manager_id = request.form.get('manager_id')
            
            # الحصول على قائمة مديري المشروع المختارين
            project_manager_ids = request.form.getlist('project_managers[]')
            
            # التحقق من البيانات الإلزامية
            if not name or not code or not client_name:
                flash('الرجاء ملء جميع الحقول المطلوبة', 'danger')
                return redirect(url_for('projects.edit_project', project_id=project_id))
            
            # التحقق من عدم وجود مشروع آخر بنفس الكود
            existing_project = Project.query.filter(Project.code == code, Project.id != project_id).first()
            if existing_project:
                flash('يوجد مشروع آخر بنفس الكود، الرجاء استخدام كود آخر', 'danger')
                return redirect(url_for('projects.edit_project', project_id=project_id))
            
            # تحويل التواريخ
            start_date = None
            if start_date_str:
                start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
                
            expected_end_date = None
            if expected_end_date_str:
                expected_end_date = datetime.strptime(expected_end_date_str, '%Y-%m-%d').date()
                
            actual_end_date = None
            if actual_end_date_str:
                actual_end_date = datetime.strptime(actual_end_date_str, '%Y-%m-%d').date()
            
            # تحويل قيمة العقد إلى رقم عشري
            contract_value_float = None
            if contract_value:
                try:
                    contract_value_float = float(contract_value)
                except ValueError:
                    flash('قيمة العقد يجب أن تكون رقمًا صحيحًا', 'danger')
                    return redirect(url_for('projects.edit_project', project_id=project_id))
                    
            # تحويل الميزانية التقديرية إلى رقم عشري
            estimated_budget_float = None
            if estimated_budget:
                try:
                    estimated_budget_float = float(estimated_budget)
                except ValueError:
                    flash('الميزانية التقديرية يجب أن تكون رقمًا صحيحًا', 'danger')
                    return redirect(url_for('projects.edit_project', project_id=project_id))
            
            # تحديث بيانات المشروع
            project.name = name
            project.code = code
            project.description = description
            project.client_name = client_name
            project.client_contact_person = client_contact_person
            project.client_email = client_email
            project.client_phone = client_phone
            project.location = location
            project.start_date = start_date
            project.expected_end_date = expected_end_date
            project.actual_end_date = actual_end_date
            project.contract_value = contract_value_float
            project.estimated_budget = estimated_budget_float
            project.currency = currency
            project.status = status
            project.manager_id = manager_id if manager_id else None
            project.updated_at = datetime.now()
            
            # حفظ التغييرات في قاعدة البيانات
            db.session.commit()
            
            # تحديث مديري المشروع
            if project_manager_ids:
                # حذف العلاقات القديمة
                ProjectManager.query.filter_by(project_id=project_id).delete()
                
                # إضافة العلاقات الجديدة
                for manager_id in project_manager_ids:
                    try:
                        manager_id = int(manager_id)
                        # التحقق من وجود المستخدم
                        user = User.query.get(manager_id)
                        if user:
                            # إنشاء علاقة مدير مشروع جديدة
                            project_manager = ProjectManager(
                                project_id=project_id,
                                user_id=manager_id,
                                role_description=f"مدير مشروع - {user.role}"
                            )
                            db.session.add(project_manager)
                    except (ValueError, TypeError):
                        # تجاهل القيم غير الصالحة
                        pass
                
                # حفظ التغييرات الجديدة
                db.session.commit()
            
            flash('تم تحديث المشروع بنجاح', 'success')
            return redirect(url_for('projects.view_project', project_id=project_id))
        
        # إذا كانت الطلب GET، نعرض صفحة تعديل المشروع
        from models import User
        # الحصول على قائمة جميع المستخدمين الذين يمكن تعيينهم كمدراء للمشروع
        managers = User.query.all()
        
        # الحصول على قائمة بالوحدات المتاحة للمستخدم
        modules = get_user_modules()
        
        return render_template(
            'projects/edit.html',
            project=project,
            managers=managers,
            modules=modules
        )
    except Exception as e:
        return handle_error(e, 'حدث خطأ أثناء تعديل المشروع')

@projects_bp.route('/<int:project_id>/delete', methods=['POST'])
@login_required
@requires_permission('projects', 'can_delete')
def delete_project(project_id):
    """
    حذف مشروع
    """
    try:
        # الحصول على المشروع من قاعدة البيانات
        project = Project.query.get_or_404(project_id)
        
        # التحقق مما إذا كان المشروع مرتبطًا بمعاملات
        has_transactions = False
        
        # التحقق من وجود أوامر شراء مرتبطة بالمشروع
        purchase_orders_count = PurchaseOrder.query.filter_by(project_id=project_id).count()
        if purchase_orders_count > 0:
            has_transactions = True
        
        # التحقق من وجود مستخلصات مرتبطة بالمشروع
        invoices_count = Invoice.query.filter_by(project_id=project_id).count()
        if invoices_count > 0:
            has_transactions = True
        
        # التحقق من وجود معاملات أخرى مرتبطة بالمشروع
        other_transactions_count = OtherTransaction.query.filter_by(project_id=project_id).count()
        if other_transactions_count > 0:
            has_transactions = True
        
        if has_transactions:
            flash('لا يمكن حذف المشروع لأنه مرتبط بمعاملات أخرى', 'danger')
            return redirect(url_for('projects.view_project', project_id=project_id))
        
        # حذف مديري المشروع أولًا (العلاقات)
        ProjectManager.query.filter_by(project_id=project_id).delete()
        
        # حذف المشروع
        db.session.delete(project)
        db.session.commit()
        
        flash('تم حذف المشروع بنجاح', 'success')
        return redirect(url_for('projects.list_projects'))
    except Exception as e:
        return handle_error(e, 'حدث خطأ أثناء حذف المشروع')

@projects_bp.route('/filter')
@login_required
@requires_permission('projects', 'can_read')
def filter_projects():
    """
    تصفية المشاريع حسب الحالة (لتحديث الإحصائيات في الواجهة)
    """
    try:
        status = request.args.get('status', '')
        
        # بناء الاستعلام الأساسي
        query = Project.query
        
        # إضافة تصفية حسب الحالة إذا كانت متوفرة
        if status:
            query = query.filter(Project.status == status)
        
        # الحصول على المشاريع مع ترتيبها حسب تاريخ الإنشاء (الأحدث أولاً)
        projects = query.order_by(desc(Project.created_at)).all()
        
        # تحويل المشاريع إلى تنسيق JSON
        projects_data = []
        for project in projects:
            projects_data.append({
                'id': project.id,
                'name': project.name,
                'code': project.code,
                'client_name': project.client_name,
                'status': project.status,
                'contract_value': project.contract_value,
                'currency': project.currency,
                'created_at': project.created_at.strftime('%Y-%m-%d')
            })
        
        return jsonify({
            'projects': projects_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# مسارات التقارير المتعلقة بالمشاريع

@projects_bp.route('/reports')
@login_required
@requires_permission('projects', 'can_read')
def project_reports():
    """
    صفحة تقارير المشاريع
    """
    try:
        # الحصول على قائمة بالمشاريع النشطة
        projects = Project.query.filter_by(status='نشط').all()
        
        # الحصول على قائمة بالوحدات المتاحة للمستخدم
        modules = get_user_modules()
        
        return render_template(
            'projects/reports.html',
            projects=projects,
            modules=modules
        )
    except Exception as e:
        return handle_error(e, 'حدث خطأ أثناء عرض صفحة تقارير المشاريع')
