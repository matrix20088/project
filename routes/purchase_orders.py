from flask import Blueprint, render_template, redirect, url_for, request, flash, current_app
from flask_login import login_required, current_user
from app import db
from models import (PurchaseRequest, PurchaseRequestItem, PurchaseOrder, PurchaseOrderItem,
                   Supplier, PriceQuote, PriceQuoteItem, User, ApprovalLog, SequenceSettings, Project)
from datetime import datetime
import uuid
import os
import logging
from werkzeug.utils import secure_filename
import signatures
from permissions import filter_query_by_project_access, has_access_to_project, get_accessible_projects

# دالة حساب السعر الإجمالي شامل ضريبة القيمة المضافة
def calculate_total_with_vat(total_price):
    """حساب السعر الإجمالي بعد إضافة ضريبة القيمة المضافة (15%)"""
    return float(total_price) * 1.15

# دالة حساب إجمالي سعر الصنف (السعر × الكمية)
def calculate_item_total(price, quantity):
    """حساب إجمالي سعر الصنف (السعر × الكمية)"""
    return float(price) * float(quantity)

# دالة حساب إجمالي أمر الشراء من بنود الأمر
def calculate_order_total(order_items):
    """حساب إجمالي أمر الشراء من بنود الأمر (مجموع السعر × الكمية لكل بند)"""
    total = 0
    for item in order_items:
        total += calculate_item_total(item.price, item.quantity)
    return total

# تعريف أنواع الملفات المسموح بها للرفع
ALLOWED_EXTENSIONS = {'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'}

def allowed_file(filename):
    """التحقق من أن نوع الملف مسموح به"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

purchase_orders_bp = Blueprint('purchase_orders', __name__, url_prefix='/purchase_orders')

# عرض جميع طلبات الشراء
# وظيفة طباعة طلب الشراء موجودة في الأسفل

@purchase_orders_bp.route('/requests')
@login_required
def requests():
    # عرض طلبات الشراء مع تفاصيل الطلبات والمستخدم
    query = db.session.query(
        PurchaseRequest, User
    ).join(
        User, PurchaseRequest.created_by == User.id
    )
    
    # تطبيق فلتر الوصول حسب المشاريع إذا كان المستخدم ليس من الأدوار المستثناة
    # يستخدم المجال project_id إذا كان موجودًا، وإلا يعرض الطلبات بناءً على project_name
    # وهو سلوك مؤقت حتى يتم تحديث قاعدة البيانات لاستخدام project_id بشكل متسق
    
    # إذا كان المستخدم ليس له صلاحية الوصول إلى جميع المشاريع، يتم تصفية النتائج
    from models import UserRole
    accessible_projects = []
    
    # تحقق من هل المستخدم له دور خاص أو هو المشرف
    if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        # الحصول على المشاريع التي يمكن للمستخدم الوصول إليها
        accessible_projects = get_accessible_projects()
        
        # تطبيق التصفية بناءً على المشاريع المتاحة
        # نفلتر حسب project_id إذا كان الطلب مرتبط بمشروع موجود في قائمة المشاريع المتاحة
        # في حالة كانت project_id غير موجودة (استخدام project_name)، نفلتر بالطريقة القديمة
        
        # الحصول على أسماء المشاريع المتاحة
        accessible_project_names = []
        if accessible_projects:
            accessible_project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
        
        # تطبيق الفلتر
        query = query.filter(
            (PurchaseRequest.project_id.in_(accessible_projects)) | 
            (PurchaseRequest.project_id.is_(None) & PurchaseRequest.project_name.in_(accessible_project_names))
        )
    
    # تنفيذ الاستعلام بعد تطبيق الفلاتر
    all_purchase_requests = query.all()
    
    # استخراج المعلومات التفصيلية لكل طلب
    requests_list = []
    for pr, user in all_purchase_requests:
        # الحصول على مواد الطلب
        items = PurchaseRequestItem.query.filter_by(purchase_request_id=pr.id).all()
        
        # حساب إجمالي المواد
        total_items = len(items)
        
        # تحضير معلومات الطلب لعرضها في الجدول
        request_data = {
            'id': pr.id,
            'request_number': pr.request_number,
            'request_date': pr.request_date,
            'project_name': pr.project_name,
            'purpose': pr.purpose,  # إضافة الغرض من الطلب
            'username': user.username,
            'total_items': total_items,
            'items': items,
            'status': pr.status
        }
        requests_list.append(request_data)
    
    # الطلبات مرتبة حسب الحالة ثم التاريخ
    pending_requests = [r for r in requests_list if r['status'] == 'قيد الانتظار']
    processing_requests = [r for r in requests_list if r['status'] == 'قيد التنفيذ']
    completed_requests = [r for r in requests_list if r['status'] == 'تم التنفيذ']
    
    return render_template('purchase_orders/requests.html', 
                          all_requests=requests_list,
                          pending_requests=pending_requests,
                          processing_requests=processing_requests,
                          completed_requests=completed_requests)

# طباعة طلب الشراء - تم دمجها في وظيفة view_request

# إضافة طلب شراء جديد
@purchase_orders_bp.route('/requests/add', methods=['GET', 'POST'])
@login_required
def add_request():
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        project_id = request.form.get('project_id')
        purpose = request.form.get('purpose')
        
        # التحقق من صحة البيانات الأساسية للطلب
        if not project_id:
            flash('اختيار المشروع مطلوب', 'danger')
            return redirect(url_for('purchase_orders.add_request'))
            
        # الحصول على اسم المشروع من المعرف
        project = Project.query.get(project_id)
        project_name = project.name if project else "غير محدد"
            
        # معالجة الملف المرفق إذا تم تقديمه
        attachment_path = None
        if 'attachment' in request.files:
            attachment_file = request.files['attachment']
            if attachment_file and attachment_file.filename != '':
                if not allowed_file(attachment_file.filename):
                    flash('نوع الملف غير مسموح به. الأنواع المسموح بها: ' + ', '.join(ALLOWED_EXTENSIONS), 'danger')
                    return redirect(url_for('purchase_orders.add_request'))
                
                # حفظ الملف بإسم آمن مع إضافة timestamp لتجنب تكرار الأسماء
                filename = secure_filename(attachment_file.filename)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                new_filename = f"{timestamp}_{filename}"
                attachment_path = os.path.join('static/uploads/attachments', new_filename)
                
                # التأكد من وجود المجلد
                os.makedirs('static/uploads/attachments', exist_ok=True)
                
                # حفظ الملف
                attachment_file.save(attachment_path)
        
        # إنشاء رقم فريد للطلب باستخدام دالة توليد الأرقام من النموذج
        request_number = PurchaseRequest.generate_request_number()
        
        # إنشاء طلب شراء جديد
        purchase_request = PurchaseRequest(
            request_number=request_number,
            request_date=datetime.now().date(),
            project_name=project_name,
            project_id=project_id,
            purpose=purpose,
            attachment_path=attachment_path,
            status='قيد الانتظار',
            created_by=current_user.id
        )
        
        # حفظ طلب الشراء في قاعدة البيانات
        db.session.add(purchase_request)
        db.session.commit()
        
        # الآن نتعامل مع الأصناف من النموذج
        # الحصول على جميع الأصناف من النموذج الديناميكي
        item_names = request.form.getlist('item_name[]')
        quantities = request.form.getlist('quantity[]')
        units = request.form.getlist('unit[]')
        estimated_prices = request.form.getlist('estimated_price[]')
        
        # التحقق من أن هناك عنصر واحد على الأقل
        if not item_names or len(item_names) == 0:
            flash('يجب إدخال صنف واحد على الأقل', 'danger')
            db.session.delete(purchase_request)
            db.session.commit()
            return redirect(url_for('purchase_orders.add_request'))
        
        # إضافة الأصناف واحدة تلو الأخرى
        for i in range(len(item_names)):
            try:
                item_name = item_names[i]
                quantity = float(quantities[i]) if quantities[i] else 0
                unit = units[i]
                estimated_price = None
                
                if i < len(estimated_prices) and estimated_prices[i]:
                    estimated_price = float(estimated_prices[i])
                
                # التحقق من صحة بيانات الصنف
                if not item_name or not unit or quantity <= 0:
                    continue  # تخطي أي بنود فارغة أو غير صالحة
                
                # إنشاء بند طلب شراء
                request_item = PurchaseRequestItem(
                    purchase_request_id=purchase_request.id,
                    item_name=item_name,
                    quantity=quantity,
                    unit=unit,
                    estimated_price=estimated_price
                )
                
                # إضافة البند إلى قاعدة البيانات
                db.session.add(request_item)
                
            except (ValueError, IndexError) as e:
                flash(f'خطأ في بيانات الصنف رقم {i+1}: {str(e)}', 'danger')
                continue
        
        # حفظ جميع البنود
        db.session.commit()
        
        flash('تم إضافة طلب الشراء بنجاح', 'success')
        return redirect(url_for('purchase_orders.requests'))
    
    # الحصول على قائمة المشاريع لعرضها في القائمة المنسدلة
    projects = Project.query.order_by(Project.name).all()
    
    return render_template('purchase_orders/add_request.html', projects=projects)

# عرض تفاصيل طلب الشراء
@purchase_orders_bp.route('/requests/view/<int:id>')
@login_required
def view_request(id):
    # استخدام db.session.query بدلًا من query لتجنب مشاكل مع الخصائص
    purchase_request = db.session.query(PurchaseRequest).get_or_404(id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد، نستخدمه
    if purchase_request.project_id:
        if not has_access_to_project(purchase_request.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
            return redirect(url_for('purchase_orders.requests'))
    else:
        # إذا كان project_id غير محدد، نتحقق من الأدوار المستثناة
        # وإلا نتحقق إذا كان اسم المشروع مطابق لأحد مشاريع المستخدم
        from models import UserRole
        if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
            accessible_projects = get_accessible_projects()
            if accessible_projects:
                project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                if purchase_request.project_name not in project_names:
                    flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
                    return redirect(url_for('purchase_orders.requests'))
    
    # بمجرد التحقق من صلاحية الوصول، نستمر في عرض البيانات
    request_items = db.session.query(PurchaseRequestItem).filter(PurchaseRequestItem.purchase_request_id == id).all()
    
    # تحديد الحقول المطلوبة فقط عند استرجاع عروض الأسعار
    price_quotes = db.session.query(PriceQuote).filter(PriceQuote.purchase_request_id == id).all()
    suppliers = db.session.query(Supplier.id, Supplier.name).all()
    
    # التحقق مما إذا كان المستخدم يريد طباعة الطلب
    print_mode = request.args.get('print', '0') == '1'
    if print_mode:
        request_user = db.session.query(User).get(purchase_request.created_by)
        username = request_user.username if request_user else "غير معروف"
        return render_template('purchase_orders/print_request.html',
                             purchase_request=purchase_request,
                             request_items=request_items,
                             username=username,
                             print_layout=True)
    
    # التحقق من وجود أمر شراء مرتبط بهذا الطلب
    linked_purchase_order = db.session.query(PurchaseOrder).filter_by(purchase_request_id=id).first()
    
    # عرض الطلب بشكله الطبيعي
    return render_template('purchase_orders/view_request.html', 
                          purchase_request=purchase_request, 
                          request_items=request_items,
                          price_quotes=price_quotes, 
                          suppliers=suppliers,
                          linked_purchase_order=linked_purchase_order)

# تعديل طلب الشراء
@purchase_orders_bp.route('/requests/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_request(id):
    purchase_request = db.session.query(PurchaseRequest).get_or_404(id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد، نستخدمه
    if purchase_request.project_id:
        if not has_access_to_project(purchase_request.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
            return redirect(url_for('purchase_orders.requests'))
    else:
        # إذا كان project_id غير محدد، نتحقق من الأدوار المستثناة
        # وإلا نتحقق إذا كان اسم المشروع مطابق لأحد مشاريع المستخدم
        from models import UserRole
        if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
            accessible_projects = get_accessible_projects()
            if accessible_projects:
                project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                if purchase_request.project_name not in project_names:
                    flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
                    return redirect(url_for('purchase_orders.requests'))
    
    # بمجرد التحقق من صلاحية الوصول، نستمر في التعديل
    request_items = db.session.query(PurchaseRequestItem).filter(PurchaseRequestItem.purchase_request_id == id).all()
    
    # التحقق من أن الطلب لم يتم تنفيذه بعد
    if purchase_request.status == 'تم التنفيذ':
        flash('لا يمكن تعديل طلب تم تنفيذه بالفعل', 'danger')
        return redirect(url_for('purchase_orders.view_request', id=id))
    
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        project_id = request.form.get('project_id')
        purchase_request.purpose = request.form.get('purpose')
        
        # تحديث معرف واسم المشروع
        if project_id:
            project = Project.query.get(project_id)
            if project:
                purchase_request.project_id = project_id
                purchase_request.project_name = project.name
        
        # معالجة الملف المرفق إذا تم تقديمه
        if 'attachment' in request.files:
            attachment_file = request.files['attachment']
            if attachment_file and attachment_file.filename != '':
                if not allowed_file(attachment_file.filename):
                    flash('نوع الملف غير مسموح به. الأنواع المسموح بها: ' + ', '.join(ALLOWED_EXTENSIONS), 'danger')
                    return redirect(url_for('purchase_orders.edit_request', id=id))
                
                # حذف الملف القديم إذا وجد
                if purchase_request.attachment_path and os.path.exists(purchase_request.attachment_path):
                    try:
                        os.remove(purchase_request.attachment_path)
                    except:
                        pass
                
                # حفظ الملف الجديد
                filename = secure_filename(attachment_file.filename)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                new_filename = f"{timestamp}_{filename}"
                attachment_path = os.path.join('static/uploads/attachments', new_filename)
                
                # التأكد من وجود المجلد
                os.makedirs('static/uploads/attachments', exist_ok=True)
                
                # حفظ الملف
                attachment_file.save(attachment_path)
                purchase_request.attachment_path = attachment_path
        
        # حذف البنود الحالية
        for item in request_items:
            db.session.delete(item)
        
        # إضافة البنود الجديدة
        item_names = request.form.getlist('item_name[]')
        quantities = request.form.getlist('quantity[]')
        units = request.form.getlist('unit[]')
        estimated_prices = request.form.getlist('estimated_price[]')
        
        # التحقق من أن هناك عنصر واحد على الأقل
        if not item_names or len(item_names) == 0:
            flash('يجب إدخال صنف واحد على الأقل', 'danger')
            return redirect(url_for('purchase_orders.edit_request', id=id))
        
        # إضافة الأصناف واحدة تلو الأخرى
        for i in range(len(item_names)):
            try:
                item_name = item_names[i]
                quantity = float(quantities[i]) if quantities[i] else 0
                unit = units[i]
                estimated_price = None
                
                if i < len(estimated_prices) and estimated_prices[i]:
                    estimated_price = float(estimated_prices[i])
                
                # التحقق من صحة بيانات الصنف
                if not item_name or not unit or quantity <= 0:
                    continue  # تخطي أي بنود فارغة أو غير صالحة
                
                # إنشاء بند طلب شراء
                request_item = PurchaseRequestItem(
                    purchase_request_id=purchase_request.id,
                    item_name=item_name,
                    quantity=quantity,
                    unit=unit,
                    estimated_price=estimated_price
                )
                
                # إضافة البند إلى قاعدة البيانات
                db.session.add(request_item)
                
            except (ValueError, IndexError) as e:
                flash(f'خطأ في بيانات الصنف رقم {i+1}: {str(e)}', 'danger')
                continue
        
        # حفظ التغييرات
        db.session.commit()
        
        flash('تم تحديث طلب الشراء بنجاح', 'success')
        return redirect(url_for('purchase_orders.view_request', id=id))
    
    # الحصول على قائمة المشاريع لعرضها في القائمة المنسدلة
    projects = Project.query.order_by(Project.name).all()
    
    return render_template('purchase_orders/edit_request.html', 
                          purchase_request=purchase_request, 
                          request_items=request_items,
                          projects=projects)

# تغيير حالة طلب الشراء
@purchase_orders_bp.route('/requests/change_status/<int:id>', methods=['POST'])
@login_required
def change_request_status(id):
    purchase_request = db.session.query(PurchaseRequest).get_or_404(id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد، نستخدمه
    if purchase_request.project_id:
        if not has_access_to_project(purchase_request.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
            return redirect(url_for('purchase_orders.requests'))
    else:
        # إذا كان project_id غير محدد، نتحقق من الأدوار المستثناة
        # وإلا نتحقق إذا كان اسم المشروع مطابق لأحد مشاريع المستخدم
        from models import UserRole
        if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
            accessible_projects = get_accessible_projects()
            if accessible_projects:
                project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                if purchase_request.project_name not in project_names:
                    flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
                    return redirect(url_for('purchase_orders.requests'))
    
    status = request.form.get('status')
    if status in ['قيد الانتظار', 'قيد التنفيذ', 'تم التنفيذ']:
        purchase_request.status = status
        db.session.commit()
        flash('تم تغيير حالة الطلب بنجاح', 'success')
    else:
        flash('حالة غير صالحة', 'danger')
    
    return redirect(url_for('purchase_orders.view_request', id=id))

# إضافة عرض سعر لطلب الشراء
@purchase_orders_bp.route('/requests/add_quote/<int:request_id>', methods=['POST'])
@login_required
def add_quote(request_id):
    purchase_request = db.session.query(PurchaseRequest).get_or_404(request_id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد، نستخدمه
    if purchase_request.project_id:
        if not has_access_to_project(purchase_request.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
            return redirect(url_for('purchase_orders.requests'))
    else:
        # إذا كان project_id غير محدد، نتحقق من الأدوار المستثناة
        # وإلا نتحقق إذا كان اسم المشروع مطابق لأحد مشاريع المستخدم
        from models import UserRole
        if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
            accessible_projects = get_accessible_projects()
            if accessible_projects:
                project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                if purchase_request.project_name not in project_names:
                    flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
                    return redirect(url_for('purchase_orders.requests'))
    
    request_items = db.session.query(PurchaseRequestItem).filter(PurchaseRequestItem.purchase_request_id == request_id).all()
    
    # الحصول على البيانات من النموذج
    supplier_id = request.form.get('supplier_id')
    prices = request.form.getlist('item_price[]')
    item_ids = request.form.getlist('item_id[]')
    
    # التحقق من صحة البيانات
    if not supplier_id or not prices or not item_ids:
        flash('يجب اختيار المورد وإدخال سعر لكل صنف', 'danger')
        return redirect(url_for('purchase_orders.view_request', id=request_id))
    
    # إنشاء رقم فريد لعرض السعر باستخدام إعدادات التسلسل
    try:
        next_number, prefix = SequenceSettings.get_next_number('price_quote')
        quote_number = f"{prefix or 'QUO-'}{next_number}"
    except Exception as e:
        # في حالة حدوث خطأ، استخدم الطريقة القديمة كإجراء احتياطي
        import logging
        logging.error(f"خطأ في توليد رقم عرض السعر: {str(e)}")
        quote_number = f"QUO-{uuid.uuid4().hex[:6].upper()}"
    
    # حساب إجمالي السعر
    total_price = 0
    try:
        for price in prices:
            if price:
                total_price += float(price)
    except ValueError:
        flash('يجب أن تكون جميع الأسعار أرقاماً', 'danger')
        return redirect(url_for('purchase_orders.view_request', id=request_id))
    
    # إنشاء عرض سعر جديد
    price_quote = PriceQuote(
        quote_number=quote_number,
        purchase_request_id=request_id,
        supplier_id=supplier_id,
        total_price=total_price,
        quote_date=datetime.now().date()
    )
    
    # حفظ عرض السعر في قاعدة البيانات
    db.session.add(price_quote)
    db.session.commit()
    
    # إضافة بنود عرض السعر
    for i in range(len(item_ids)):
        try:
            item_id = int(item_ids[i])
            price = float(prices[i]) if prices[i] else 0
            
            if price <= 0:
                continue  # تخطي الأصناف بدون سعر
            
            # إنشاء بند عرض سعر جديد
            # استخدام طريقة بديلة لإنشاء الكائن ثم تعيين الخصائص
            quote_item = PriceQuoteItem()
            quote_item.price_quote_id = price_quote.id
            quote_item.request_item_id = item_id
            quote_item.price = price
            
            # حفظ بند عرض السعر
            db.session.add(quote_item)
            
        except (ValueError, IndexError) as e:
            flash(f'خطأ في معالجة الصنف رقم {i+1}: {str(e)}', 'danger')
            continue
    
    # حفظ البنود
    db.session.commit()
    
    flash('تم إضافة عرض السعر بنجاح', 'success')
    return redirect(url_for('purchase_orders.view_request', id=request_id))

# حذف عرض السعر
@purchase_orders_bp.route('/requests/delete_quote/<int:id>')
@login_required
def delete_quote(id):
    price_quote = db.session.query(PriceQuote).get_or_404(id)
    request_id = price_quote.purchase_request_id
    
    # البحث عن طلب الشراء المرتبط بعرض السعر للتحقق من صلاحية الوصول
    purchase_request = db.session.query(PurchaseRequest).get_or_404(request_id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد، نستخدمه
    if purchase_request.project_id:
        if not has_access_to_project(purchase_request.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
            return redirect(url_for('purchase_orders.requests'))
    else:
        # إذا كان project_id غير محدد، نتحقق من الأدوار المستثناة
        # وإلا نتحقق إذا كان اسم المشروع مطابق لأحد مشاريع المستخدم
        from models import UserRole
        if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
            accessible_projects = get_accessible_projects()
            if accessible_projects:
                project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                if purchase_request.project_name not in project_names:
                    flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
                    return redirect(url_for('purchase_orders.requests'))
    
    # حذف عرض السعر
    db.session.delete(price_quote)
    db.session.commit()
    
    flash('تم حذف عرض السعر بنجاح', 'success')
    return redirect(url_for('purchase_orders.view_request', id=request_id))

# إصدار أمر شراء من طلب
@purchase_orders_bp.route('/create_order/<int:request_id>/<int:quote_id>', methods=['GET', 'POST'])
@login_required
def create_order(request_id, quote_id):
    purchase_request = db.session.query(PurchaseRequest).get_or_404(request_id)
    
    # التحقق من وجود أمر شراء سابق لهذا الطلب
    existing_order = db.session.query(PurchaseOrder).filter_by(purchase_request_id=request_id).first()
    if existing_order:
        flash('يوجد بالفعل أمر شراء مرتبط بهذا الطلب. لا يمكن إنشاء أكثر من أمر شراء لنفس الطلب.', 'danger')
        return redirect(url_for('purchase_orders.view_request', id=request_id))
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد، نستخدمه
    if purchase_request.project_id:
        if not has_access_to_project(purchase_request.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
            return redirect(url_for('purchase_orders.requests'))
    else:
        # إذا كان project_id غير محدد، نتحقق من الأدوار المستثناة
        # وإلا نتحقق إذا كان اسم المشروع مطابق لأحد مشاريع المستخدم
        from models import UserRole
        if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
            accessible_projects = get_accessible_projects()
            if accessible_projects:
                project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                if purchase_request.project_name not in project_names:
                    flash('غير مصرح لك بالوصول إلى هذا الطلب', 'danger')
                    return redirect(url_for('purchase_orders.requests'))
    
    request_items = db.session.query(PurchaseRequestItem).filter(PurchaseRequestItem.purchase_request_id == request_id).all()
    price_quote = db.session.query(PriceQuote).get_or_404(quote_id)
    quote_items = db.session.query(PriceQuoteItem).filter(PriceQuoteItem.price_quote_id == quote_id).all()
    
    # قاموس يحتوي على أسعار الأصناف من عرض السعر
    items_prices = {}
    for quote_item in quote_items:
        items_prices[quote_item.request_item_id] = quote_item.price
    
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        delivery_date_str = request.form.get('delivery_date')
        project_id = request.form.get('project_id')
        selected_items = request.form.getlist('item_ids[]')
        
        # التحقق من صحة البيانات
        if not delivery_date_str or not selected_items:
            flash('تاريخ التسليم والأصناف مطلوبة', 'danger')
            return redirect(url_for('purchase_orders.create_order', request_id=request_id, quote_id=quote_id))
        
        try:
            delivery_date = datetime.strptime(delivery_date_str, '%Y-%m-%d').date()
        except ValueError:
            flash('صيغة التاريخ غير صحيحة', 'danger')
            return redirect(url_for('purchase_orders.create_order', request_id=request_id, quote_id=quote_id))
            
        # معالجة الملف المرفق إذا تم تقديمه
        attachment_path = None
        if 'attachment' in request.files:
            attachment_file = request.files['attachment']
            if attachment_file and attachment_file.filename != '':
                if not allowed_file(attachment_file.filename):
                    flash('نوع الملف غير مسموح به. الأنواع المسموح بها: ' + ', '.join(ALLOWED_EXTENSIONS), 'danger')
                    return redirect(url_for('purchase_orders.create_order', request_id=request_id, quote_id=quote_id))
                
                # حفظ الملف بإسم آمن مع إضافة timestamp لتجنب تكرار الأسماء
                filename = secure_filename(attachment_file.filename)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                new_filename = f"{timestamp}_{filename}"
                attachment_path = os.path.join('static/uploads/orders', new_filename)
                
                # التأكد من وجود المجلد
                os.makedirs('static/uploads/orders', exist_ok=True)
                
                # حفظ الملف
                attachment_file.save(attachment_path)
        
        # إنشاء رقم فريد لأمر الشراء باستخدام إعدادات التسلسل
        try:
            next_number, prefix = SequenceSettings.get_next_number('purchase_order')
            order_number = f"{prefix or 'PO-'}{next_number}"
        except Exception as e:
            # في حالة حدوث خطأ، استخدم الطريقة القديمة كإجراء احتياطي
            import logging
            logging.error(f"خطأ في توليد رقم أمر الشراء: {str(e)}")
            order_number = f"PO-{uuid.uuid4().hex[:6].upper()}"
        
        # حساب إجمالي القيمة للأصناف المختارة (السعر × الكمية)
        total_price = 0
        for item_id in selected_items:
            try:
                item_id = int(item_id)
                if item_id in items_prices:
                    # البحث عن الصنف والكمية
                    for item in request_items:
                        if item.id == item_id:
                            # حساب إجمالي القيمة = السعر × الكمية
                            price = items_prices[item_id]  # سعر الصنف من عرض السعر
                            quantity = item.quantity  # كمية الصنف من طلب الشراء
                            item_total = price * quantity
                            total_price += item_total
                            break
            except (ValueError, TypeError) as e:
                flash(f'خطأ في حساب إجمالي الصنف: {str(e)}', 'danger')
                continue
        
        # إنشاء أمر شراء واحد لكل الأصناف
        purchase_order = PurchaseOrder(
            order_number=order_number,
            order_date=datetime.now().date(),
            purchase_request_id=request_id,
            supplier_id=price_quote.supplier_id,
            total_price=total_price,
            purpose=purchase_request.purpose,  # إضافة الغرض من الطلب
            delivery_date=delivery_date,
            attachment_path=attachment_path,
            approval_status='قيد الانتظار',
            created_by=current_user.id,
            project_id=project_id if project_id else None  # ربط أمر الشراء بالمشروع
        )
        
        # حفظ أمر الشراء
        db.session.add(purchase_order)
        db.session.commit()
        
        # إضافة بنود أمر الشراء
        for item_id_str in selected_items:
            try:
                item_id = int(item_id_str)
                # البحث عن الصنف المحدد
                selected_item = None
                for item in request_items:
                    if item.id == item_id:
                        selected_item = item
                        break
                
                if not selected_item:
                    continue
                
                # البحث عن سعر الصنف من عرض السعر
                price = items_prices.get(item_id, 0)
                if price <= 0:
                    continue
                
                # إنشاء بند أمر شراء جديد
                order_item = PurchaseOrderItem(
                    purchase_order_id=purchase_order.id,
                    request_item_id=item_id,
                    item_name=selected_item.item_name,
                    quantity=selected_item.quantity,
                    unit=selected_item.unit,
                    price=price
                )
                
                # حفظ بند أمر الشراء
                db.session.add(order_item)
                
            except (ValueError, TypeError) as e:
                flash(f'خطأ في معالجة الصنف: {str(e)}', 'danger')
                continue
        
        # تغيير حالة طلب الشراء إلى قيد التنفيذ
        purchase_request.status = 'قيد التنفيذ'
        
        # حفظ التغييرات
        db.session.commit()
        
        flash('تم إصدار أمر الشراء بنجاح', 'success')
        return redirect(url_for('purchase_orders.orders'))
    
    # إعداد قاموس بأسعار كل صنف ليتم استخدامه في القالب
    item_prices = {}
    for quote_item in quote_items:
        item_prices[quote_item.request_item_id] = quote_item.price
    
    # طباعة معلومات التصحيح للمطور
    print(f"عدد بنود عرض الأسعار: {len(quote_items)}")
    print(f"أسعار البنود: {item_prices}")
    
    # الحصول على قائمة المشاريع
    projects = db.session.query(Project).order_by(Project.name).all()
    
    return render_template('purchase_orders/create_order.html', 
                          purchase_request=purchase_request, 
                          request_items=request_items,
                          price_quote=price_quote,
                          quote_items=quote_items,
                          item_prices=item_prices,
                          projects=projects)

# عرض جميع أوامر الشراء - العودة للإصدار المستقر
@purchase_orders_bp.route('/orders')
@login_required
def orders():
    # الحصول على أوامر الشراء مع بيانات المشروع
    query = db.session.query(
        PurchaseOrder, PurchaseRequest.project_name
    ).outerjoin(
        PurchaseRequest, PurchaseOrder.purchase_request_id == PurchaseRequest.id
    )
    
    # تطبيق فلتر الوصول حسب المشاريع إذا كان المستخدم ليس من الأدوار المستثناة
    from models import UserRole
    
    if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
        # الحصول على المشاريع التي يمكن للمستخدم الوصول إليها
        accessible_projects = get_accessible_projects()
        
        if accessible_projects:
            # تطبيق تصفية حسب المشاريع المتاحة
            # نفلتر إما باستخدام project_id في أمر الشراء (إذا كان متاحًا)
            # أو باستخدام project_id في طلب الشراء المرتبط، أو باستخدام project_name في طلب الشراء
            
            # الحصول على أسماء المشاريع المتاحة للمستخدم
            accessible_project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
            
            # تطبيق فلتر الوصول على الاستعلام
            query = query.filter(
                (PurchaseOrder.project_id.in_(accessible_projects)) |
                (PurchaseOrder.project_id.is_(None) &
                 ((PurchaseRequest.project_id.in_(accessible_projects)) | 
                  (PurchaseRequest.project_id.is_(None) & PurchaseRequest.project_name.in_(accessible_project_names))))
            )
    
    # تنفيذ الاستعلام مع الفلاتر
    purchase_orders = query.all()
    
    # تحويل النتائج إلى قائمة أوامر شراء مع إضافة حقل اسم المشروع
    all_orders = []
    pending_orders = []
    approved_orders = []
    rejected_orders = []
    
    for order, project_name in purchase_orders:
        order.project_name = project_name  # إضافة اسم المشروع كصفة مؤقتة
        # لا حاجة لإضافة خاصية purpose مؤقتة لأنها موجودة الآن في قاعدة البيانات
        all_orders.append(order)
        
        # تصنيف الأوامر حسب حالة الاعتماد
        if order.approval_status == 'قيد الانتظار':
            pending_orders.append(order)
        elif order.approval_status == 'معتمد':
            approved_orders.append(order)
        elif order.approval_status == 'مرفوض':
            rejected_orders.append(order)
    
    return render_template('purchase_orders/orders.html', 
                          all_orders=all_orders,
                          pending_orders=pending_orders,
                          approved_orders=approved_orders,
                          rejected_orders=rejected_orders,
                          calculate_total_with_vat=calculate_total_with_vat)

# عرض تفاصيل أمر الشراء - العودة للإصدار المستقر
@purchase_orders_bp.route('/orders/view/<int:id>')
@login_required
def view_order(id):
    purchase_order = db.session.query(PurchaseOrder).get_or_404(id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد في أمر الشراء، نستخدمه
    if purchase_order.project_id:
        if not has_access_to_project(purchase_order.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
            return redirect(url_for('purchase_orders.orders'))
    
    # البحث عن طلب الشراء المرتبط
    purchase_request = None
    if purchase_order.purchase_request_id:
        purchase_request = db.session.query(PurchaseRequest).get(purchase_order.purchase_request_id)
    
    # إذا لم يكن هناك project_id محدد في أمر الشراء، نتحقق من طلب الشراء المرتبط
    if not purchase_order.project_id and purchase_request:
        if purchase_request.project_id:
            if not has_access_to_project(purchase_request.project_id):
                flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
                return redirect(url_for('purchase_orders.orders'))
        else:
            # إذا لم يكن هناك project_id في طلب الشراء أيضًا، نتحقق من project_name
            from models import UserRole
            if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
                accessible_projects = get_accessible_projects()
                if accessible_projects:
                    project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                    if purchase_request.project_name not in project_names:
                        flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
                        return redirect(url_for('purchase_orders.orders'))
    
    # بمجرد التحقق من صلاحية الوصول، نستمر في عرض البيانات
    order_items = db.session.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == id).all()
    supplier = db.session.query(Supplier).get(purchase_order.supplier_id)
    
    # إضافة معلومات المشروع إذا كان موجودًا
    project = None
    if purchase_order.project_id:
        project = db.session.query(Project).get(purchase_order.project_id)
        purchase_order.project = project
    
    # إعادة حساب الإجمالي الصحيح (السعر × الكمية لكل صنف)
    correct_total = calculate_order_total(order_items)
        
    return render_template('purchase_orders/view_order.html', 
                           purchase_order=purchase_order,
                           order_items=order_items, 
                           supplier=supplier,
                           purchase_request=purchase_request,
                           correct_total=correct_total,
                           calculate_total_with_vat=calculate_total_with_vat,
                           calculate_item_total=calculate_item_total)

# طباعة أمر الشراء - العودة للإصدار المستقر
@purchase_orders_bp.route('/orders/print/<int:id>')
@login_required
def print_order(id):
    purchase_order = db.session.query(PurchaseOrder).get_or_404(id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد في أمر الشراء، نستخدمه
    if purchase_order.project_id:
        if not has_access_to_project(purchase_order.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
            return redirect(url_for('purchase_orders.orders'))
    
    # البحث عن طلب الشراء المرتبط
    purchase_request = None
    if purchase_order.purchase_request_id:
        purchase_request = db.session.query(PurchaseRequest).get(purchase_order.purchase_request_id)
    
    # إذا لم يكن هناك project_id محدد في أمر الشراء، نتحقق من طلب الشراء المرتبط
    if not purchase_order.project_id and purchase_request:
        if purchase_request.project_id:
            if not has_access_to_project(purchase_request.project_id):
                flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
                return redirect(url_for('purchase_orders.orders'))
        else:
            # إذا لم يكن هناك project_id في طلب الشراء أيضًا، نتحقق من project_name
            from models import UserRole
            if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
                accessible_projects = get_accessible_projects()
                if accessible_projects:
                    project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                    if purchase_request.project_name not in project_names:
                        flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
                        return redirect(url_for('purchase_orders.orders'))
    
    # بمجرد التحقق من صلاحية الوصول، نستمر في عرض البيانات
    order_items = db.session.query(PurchaseOrderItem).filter(PurchaseOrderItem.purchase_order_id == id).all()
    supplier = db.session.query(Supplier).get(purchase_order.supplier_id)
    
    # إضافة معلومات المشروع إذا كان موجودًا
    project = None
    if purchase_order.project_id:
        project = db.session.query(Project).get(purchase_order.project_id)
        purchase_order.project = project
        
    # إعادة حساب الإجمالي الصحيح (السعر × الكمية لكل صنف)
    correct_total = calculate_order_total(order_items)
    
    # الوقت الحالي للطباعة
    now = datetime.now()
    
    # استخدام وحدة التوقيعات الجديدة للحصول على المديرين مع توقيعاتهم
    # إنشاء قاموس التوقيعات للأدوار المختلفة
    signatures_dict = {
        'engineering_manager_signature': 'images/signature-placeholder.png',
        'projects_manager_signature': 'images/signature-placeholder.png',
        'executive_manager_signature': 'images/signature-placeholder.png'
    }
    
    # المدير الهندسي
    if purchase_order.engineering_approval == 'معتمد':
        try:
            # البحث أولاً في سجلات الاعتماد
            eng_user, eng_signature = signatures.get_approval_user_signature('engineering_approval', purchase_order.id)
            if eng_user:
                signatures_dict['engineering_manager'] = {
                    'id': eng_user.id,
                    'name': eng_user.name if hasattr(eng_user, 'name') else eng_user.username,
                    'role': eng_user.role
                }
                if eng_signature:
                    signatures_dict['engineering_manager_signature'] = eng_signature.replace('static/', '', 1) if 'static/' in eng_signature else eng_signature
            else:
                # البحث عن أي مستخدم له دور مدير مكتب هندسي
                eng_manager = db.session.query(User).filter(User.role == 'مدير مكتب هندسي').first()
                if eng_manager:
                    signatures_dict['engineering_manager'] = {
                        'id': eng_manager.id,
                        'name': eng_manager.name if hasattr(eng_manager, 'name') else eng_manager.username,
                        'role': eng_manager.role
                    }
                    sig_path = signatures.get_signature_path(eng_manager.id)
                    if sig_path:
                        signatures_dict['engineering_manager_signature'] = sig_path.replace('static/', '', 1) if 'static/' in sig_path else sig_path
        except Exception as e:
            logging.error(f"خطأ في الحصول على توقيع المدير الهندسي: {e}")
    
    # مدير المشاريع
    if purchase_order.projects_approval == 'معتمد':
        try:
            # البحث أولاً في سجلات الاعتماد
            proj_user, proj_signature = signatures.get_approval_user_signature('projects_approval', purchase_order.id)
            if proj_user:
                signatures_dict['projects_manager'] = {
                    'id': proj_user.id,
                    'name': proj_user.name if hasattr(proj_user, 'name') else proj_user.username,
                    'role': proj_user.role
                }
                if proj_signature:
                    signatures_dict['projects_manager_signature'] = proj_signature.replace('static/', '', 1) if 'static/' in proj_signature else proj_signature
            else:
                # البحث عن أي مستخدم له دور مدير مشاريع
                proj_manager = db.session.query(User).filter(User.role == 'مدير مشاريع').first()
                if proj_manager:
                    signatures_dict['projects_manager'] = {
                        'id': proj_manager.id,
                        'name': proj_manager.name if hasattr(proj_manager, 'name') else proj_manager.username,
                        'role': proj_manager.role
                    }
                    sig_path = signatures.get_signature_path(proj_manager.id)
                    if sig_path:
                        signatures_dict['projects_manager_signature'] = sig_path.replace('static/', '', 1) if 'static/' in sig_path else sig_path
        except Exception as e:
            logging.error(f"خطأ في الحصول على توقيع مدير المشاريع: {e}")
    
    # المدير التنفيذي
    if purchase_order.executive_approval == 'معتمد':
        try:
            # البحث أولاً في سجلات الاعتماد
            exec_user, exec_signature = signatures.get_approval_user_signature('executive_approval', purchase_order.id)
            if exec_user:
                signatures_dict['executive_manager'] = {
                    'id': exec_user.id,
                    'name': exec_user.name if hasattr(exec_user, 'name') else exec_user.username,
                    'role': exec_user.role
                }
                if exec_signature:
                    signatures_dict['executive_manager_signature'] = exec_signature.replace('static/', '', 1) if 'static/' in exec_signature else exec_signature
            else:
                # البحث عن أي مستخدم له دور مدير تنفيذي
                exec_manager = db.session.query(User).filter(User.role == 'مدير تنفيذي').first()
                if exec_manager:
                    signatures_dict['executive_manager'] = {
                        'id': exec_manager.id,
                        'name': exec_manager.name if hasattr(exec_manager, 'name') else exec_manager.username,
                        'role': exec_manager.role
                    }
                    sig_path = signatures.get_signature_path(exec_manager.id)
                    if sig_path:
                        signatures_dict['executive_manager_signature'] = sig_path.replace('static/', '', 1) if 'static/' in sig_path else sig_path
        except Exception as e:
            logging.error(f"خطأ في الحصول على توقيع المدير التنفيذي: {e}")
    
    # تسجيل معلومات التوقيعات للتأكد من صحتها
    # إضافة تسجيل تفصيلي لمعرفة المشكلة
    logging.info(f"معلومات التوقيعات لأمر الشراء {id}:")
    for key, value in signatures_dict.items():
        if key.endswith('_signature'):
            logging.info(f"{key}: {value}")
    
    # للتوافق مع القالب السابق
    engineering_manager = signatures_dict.get('engineering_manager')
    projects_manager = signatures_dict.get('projects_manager')
    executive_manager = signatures_dict.get('executive_manager')
        
    return render_template('purchase_orders/print_order.html', 
                           purchase_order=purchase_order,
                           order_items=order_items, 
                           supplier=supplier,
                           purchase_request=purchase_request,
                           correct_total=correct_total,
                           calculate_total_with_vat=calculate_total_with_vat,
                           calculate_item_total=calculate_item_total,
                           now=now,
                           # معلومات المستخدمين والتوقيعات
                           engineering_manager=engineering_manager,
                           projects_manager=projects_manager,
                           executive_manager=executive_manager,
                           signatures_dict=signatures_dict)

# تعديل أمر الشراء
@purchase_orders_bp.route('/orders/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_order(id):
    purchase_order = db.session.query(PurchaseOrder).get_or_404(id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد في أمر الشراء، نستخدمه
    if purchase_order.project_id:
        if not has_access_to_project(purchase_order.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
            return redirect(url_for('purchase_orders.orders'))
    
    # البحث عن طلب الشراء المرتبط
    purchase_request = None
    if purchase_order.purchase_request_id:
        purchase_request = db.session.query(PurchaseRequest).get(purchase_order.purchase_request_id)
    
    # إذا لم يكن هناك project_id محدد في أمر الشراء، نتحقق من طلب الشراء المرتبط
    if not purchase_order.project_id and purchase_request:
        if purchase_request.project_id:
            if not has_access_to_project(purchase_request.project_id):
                flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
                return redirect(url_for('purchase_orders.orders'))
        else:
            # إذا لم يكن هناك project_id في طلب الشراء أيضًا، نتحقق من project_name
            from models import UserRole
            if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
                accessible_projects = get_accessible_projects()
                if accessible_projects:
                    project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                    if purchase_request.project_name not in project_names:
                        flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
                        return redirect(url_for('purchase_orders.orders'))
    
    # التحقق من أن الأمر لم يتم اعتماده بعد
    if purchase_order.approval_status != 'قيد الانتظار':
        flash('لا يمكن تعديل أمر تم اعتماده أو رفضه', 'danger')
        return redirect(url_for('purchase_orders.view_order', id=id))
    
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        delivery_date_str = request.form.get('delivery_date')
        project_id = request.form.get('project_id')
        
        try:
            purchase_order.delivery_date = datetime.strptime(delivery_date_str, '%Y-%m-%d').date()
            # تحديث المشروع المرتبط بأمر الشراء
            purchase_order.project_id = project_id if project_id else None
        except ValueError:
            flash('صيغة التاريخ غير صحيحة', 'danger')
            return redirect(url_for('purchase_orders.edit_order', id=id))
        
        # معالجة الملف المرفق إذا تم تقديمه
        if 'attachment' in request.files:
            attachment_file = request.files['attachment']
            if attachment_file and attachment_file.filename != '':
                if not allowed_file(attachment_file.filename):
                    flash('نوع الملف غير مسموح به. الأنواع المسموح بها: ' + ', '.join(ALLOWED_EXTENSIONS), 'danger')
                    return redirect(url_for('purchase_orders.edit_order', id=id))
                
                # حفظ الملف بإسم آمن مع إضافة timestamp لتجنب تكرار الأسماء
                filename = secure_filename(attachment_file.filename)
                timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
                new_filename = f"{timestamp}_{filename}"
                attachment_path = os.path.join('static/uploads/orders', new_filename)
                
                # التأكد من وجود المجلد
                os.makedirs('static/uploads/orders', exist_ok=True)
                
                # حفظ الملف
                attachment_file.save(attachment_path)
                
                # تحديث مسار الملف المرفق في أمر الشراء
                purchase_order.attachment_path = attachment_path
        
        # حفظ التغييرات
        db.session.commit()
        
        flash('تم تحديث أمر الشراء بنجاح', 'success')
        return redirect(url_for('purchase_orders.view_order', id=id))
    
    # الحصول على قائمة المشاريع
    projects = db.session.query(Project).order_by(Project.name).all()
    
    return render_template('purchase_orders/edit_order.html', 
                            purchase_order=purchase_order,
                            calculate_total_with_vat=calculate_total_with_vat,
                            projects=projects)

# حذف أمر الشراء
@purchase_orders_bp.route('/orders/delete/<int:id>')
@login_required
def delete_order(id):
    purchase_order = db.session.query(PurchaseOrder).get_or_404(id)
    
    # التحقق من صلاحية الوصول للمشروع
    # إذا كان project_id محدد في أمر الشراء، نستخدمه
    if purchase_order.project_id:
        if not has_access_to_project(purchase_order.project_id):
            flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
            return redirect(url_for('purchase_orders.orders'))
    
    # البحث عن طلب الشراء المرتبط
    purchase_request = None
    if purchase_order.purchase_request_id:
        purchase_request = db.session.query(PurchaseRequest).get(purchase_order.purchase_request_id)
    
    # إذا لم يكن هناك project_id محدد في أمر الشراء، نتحقق من طلب الشراء المرتبط
    if not purchase_order.project_id and purchase_request:
        if purchase_request.project_id:
            if not has_access_to_project(purchase_request.project_id):
                flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
                return redirect(url_for('purchase_orders.orders'))
        else:
            # إذا لم يكن هناك project_id في طلب الشراء أيضًا، نتحقق من project_name
            from models import UserRole
            if current_user.role not in UserRole.ROLES_WITH_FULL_ACCESS and not current_user.is_admin:
                accessible_projects = get_accessible_projects()
                if accessible_projects:
                    project_names = [p.name for p in Project.query.filter(Project.id.in_(accessible_projects)).all()]
                    if purchase_request.project_name not in project_names:
                        flash('غير مصرح لك بالوصول إلى هذا الأمر', 'danger')
                        return redirect(url_for('purchase_orders.orders'))
    
    # التحقق من أن الأمر لم يتم اعتماده بعد
    if purchase_order.approval_status != 'قيد الانتظار':
        flash('لا يمكن حذف أمر تم اعتماده أو رفضه', 'danger')
        return redirect(url_for('purchase_orders.view_order', id=id))
    
    # حذف أمر الشراء
    db.session.delete(purchase_order)
    db.session.commit()
    
    flash('تم حذف أمر الشراء بنجاح', 'success')
    return redirect(url_for('purchase_orders.orders'))
