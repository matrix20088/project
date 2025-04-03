from flask import Blueprint, render_template, redirect, url_for, request, flash
from flask_login import login_required, current_user
from app import db
from models import Supplier, Contract
from datetime import datetime

suppliers_bp = Blueprint('suppliers', __name__, url_prefix='/suppliers')

# عرض جميع الموردين
@suppliers_bp.route('/')
@login_required
def index():
    suppliers = Supplier.query.all()
    return render_template('suppliers/index.html', suppliers=suppliers)

# إضافة مورد جديد
@suppliers_bp.route('/add', methods=['GET', 'POST'])
@login_required
def add():
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        name = request.form.get('name')
        address = request.form.get('address')
        phone = request.form.get('phone')
        email = request.form.get('email')
        category = request.form.get('category')
        performance_rating = request.form.get('performance_rating')
        
        # التحقق من صحة البيانات
        if not name:
            flash('اسم المورد مطلوب', 'danger')
            return redirect(url_for('suppliers.add'))
        
        # إنشاء مورد جديد
        supplier = Supplier(
            name=name,
            address=address,
            phone=phone,
            email=email,
            category=category,
            performance_rating=performance_rating
        )
        
        # حفظ المورد في قاعدة البيانات
        db.session.add(supplier)
        db.session.commit()
        
        flash('تم إضافة المورد بنجاح', 'success')
        return redirect(url_for('suppliers.index'))
    
    return render_template('suppliers/add.html')

# عرض تفاصيل المورد
@suppliers_bp.route('/view/<int:id>')
@login_required
def view(id):
    supplier = Supplier.query.get_or_404(id)
    contracts = Contract.query.filter_by(supplier_id=id).all()
    return render_template('suppliers/view.html', supplier=supplier, contracts=contracts)

# تعديل بيانات المورد
@suppliers_bp.route('/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit(id):
    supplier = Supplier.query.get_or_404(id)
    
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        supplier.name = request.form.get('name')
        supplier.address = request.form.get('address')
        supplier.phone = request.form.get('phone')
        supplier.email = request.form.get('email')
        supplier.category = request.form.get('category')
        supplier.performance_rating = request.form.get('performance_rating')
        
        # حفظ التغييرات
        db.session.commit()
        
        flash('تم تحديث بيانات المورد بنجاح', 'success')
        return redirect(url_for('suppliers.view', id=id))
    
    return render_template('suppliers/edit.html', supplier=supplier)

# حذف المورد
@suppliers_bp.route('/delete/<int:id>')
@login_required
def delete(id):
    supplier = Supplier.query.get_or_404(id)
    
    # التحقق من عدم وجود عقود أو طلبات شراء مرتبطة بالمورد
    if supplier.contracts or supplier.purchase_orders:
        flash('لا يمكن حذف المورد لأنه مرتبط بعقود أو طلبات شراء', 'danger')
        return redirect(url_for('suppliers.view', id=id))
    
    # حذف المورد
    db.session.delete(supplier)
    db.session.commit()
    
    flash('تم حذف المورد بنجاح', 'success')
    return redirect(url_for('suppliers.index'))

# إضافة عقد جديد للمورد
@suppliers_bp.route('/add_contract/<int:supplier_id>', methods=['GET', 'POST'])
@login_required
def add_contract(supplier_id):
    supplier = Supplier.query.get_or_404(supplier_id)
    
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        contract_number = request.form.get('contract_number')
        start_date_str = request.form.get('start_date')
        end_date_str = request.form.get('end_date')
        terms = request.form.get('terms')
        
        # التحقق من صحة البيانات
        if not contract_number or not start_date_str or not end_date_str:
            flash('جميع الحقول المطلوبة يجب ملؤها', 'danger')
            return redirect(url_for('suppliers.add_contract', supplier_id=supplier_id))
        
        # تحويل التواريخ من النص إلى كائنات تاريخ
        try:
            start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            flash('صيغة التاريخ غير صحيحة', 'danger')
            return redirect(url_for('suppliers.add_contract', supplier_id=supplier_id))
        
        # التحقق من أن تاريخ البدء يسبق تاريخ الانتهاء
        if start_date >= end_date:
            flash('يجب أن يكون تاريخ البدء قبل تاريخ الانتهاء', 'danger')
            return redirect(url_for('suppliers.add_contract', supplier_id=supplier_id))
        
        # إنشاء عقد جديد
        contract = Contract(
            contract_number=contract_number,
            supplier_id=supplier_id,
            start_date=start_date,
            end_date=end_date,
            terms=terms
        )
        
        # حفظ العقد في قاعدة البيانات
        db.session.add(contract)
        db.session.commit()
        
        flash('تم إضافة العقد بنجاح', 'success')
        return redirect(url_for('suppliers.view', id=supplier_id))
    
    return render_template('suppliers/add_contract.html', supplier=supplier)

# عرض تفاصيل العقد
@suppliers_bp.route('/view_contract/<int:id>')
@login_required
def view_contract(id):
    contract = Contract.query.get_or_404(id)
    return render_template('suppliers/view_contract.html', contract=contract)

# تعديل بيانات العقد
@suppliers_bp.route('/edit_contract/<int:id>', methods=['GET', 'POST'])
@login_required
def edit_contract(id):
    contract = Contract.query.get_or_404(id)
    
    if request.method == 'POST':
        # الحصول على البيانات من النموذج
        contract.contract_number = request.form.get('contract_number')
        start_date_str = request.form.get('start_date')
        end_date_str = request.form.get('end_date')
        contract.terms = request.form.get('terms')
        
        # تحويل التواريخ من النص إلى كائنات تاريخ
        try:
            contract.start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
            contract.end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date()
        except ValueError:
            flash('صيغة التاريخ غير صحيحة', 'danger')
            return redirect(url_for('suppliers.edit_contract', id=id))
        
        # التحقق من أن تاريخ البدء يسبق تاريخ الانتهاء
        if contract.start_date >= contract.end_date:
            flash('يجب أن يكون تاريخ البدء قبل تاريخ الانتهاء', 'danger')
            return redirect(url_for('suppliers.edit_contract', id=id))
        
        # حفظ التغييرات
        db.session.commit()
        
        flash('تم تحديث بيانات العقد بنجاح', 'success')
        return redirect(url_for('suppliers.view_contract', id=id))
    
    return render_template('suppliers/edit_contract.html', contract=contract)

# حذف العقد
@suppliers_bp.route('/delete_contract/<int:id>')
@login_required
def delete_contract(id):
    contract = Contract.query.get_or_404(id)
    supplier_id = contract.supplier_id
    
    # حذف العقد
    db.session.delete(contract)
    db.session.commit()
    
    flash('تم حذف العقد بنجاح', 'success')
    return redirect(url_for('suppliers.view', id=supplier_id))

@suppliers_bp.route('/import_excel', methods=['GET', 'POST'])
@login_required
def import_excel():
    if request.method == 'POST':
        if 'file' not in request.files:
            flash('لم يتم تحميل أي ملف', 'danger')
            return redirect(request.url)
        
        file = request.files['file']
        if file.filename == '':
            flash('لم يتم اختيار ملف', 'danger')
            return redirect(request.url)
        
        if file and file.filename.endswith('.xlsx'):
            try:
                import pandas as pd
                # قراءة ملف Excel
                df = pd.read_excel(file)
                
                # التحقق من وجود الأعمدة المطلوبة
                required_columns = ['name', 'address', 'phone', 'email', 'category', 'performance_rating']
                if not all(col in df.columns for col in required_columns):
                    flash('الملف لا يحتوي على جميع الأعمدة المطلوبة', 'danger')
                    return redirect(request.url)
                
                success_count = 0
                for _, row in df.iterrows():
                    # التحقق من عدم وجود المورد مسبقاً
                    if not Supplier.query.filter_by(name=row['name']).first():
                        supplier = Supplier(
                            name=row['name'],
                            address=row['address'],
                            phone=row['phone'],
                            email=row['email'],
                            category=row['category'],
                            performance_rating=row['performance_rating']
                        )
                        db.session.add(supplier)
                        success_count += 1
                
                db.session.commit()
                flash(f'تم استيراد {success_count} مورد بنجاح', 'success')
                return redirect(url_for('suppliers.index'))
                
            except Exception as e:
                flash(f'حدث خطأ أثناء معالجة الملف: {str(e)}', 'danger')
                return redirect(request.url)
        else:
            flash('يجب أن يكون الملف بصيغة xlsx.', 'danger')
            return redirect(request.url)
            
    return render_template('suppliers/import_excel.html')
