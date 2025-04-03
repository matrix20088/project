"""
نظام إدارة الأرقام التسلسلية للمعاملات
يتيح هذا الملف للمديرين تعديل إعدادات التسلسل لمختلف أنواع المعاملات في النظام
"""

from flask import Blueprint, render_template, request, redirect, url_for, flash
from flask_login import login_required, current_user
from app import db
from models import SequenceSettings

# تعريف البلوبرنت الخاص بإعدادات التسلسل
sequence_settings_bp = Blueprint('sequence_settings', __name__, url_prefix='/sequence_settings')

@sequence_settings_bp.route('/')
@login_required
def index():
    """عرض جميع إعدادات التسلسل"""
    # التحقق من صلاحيات المستخدم
    if current_user.role != 'مدير':
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    # استرجاع جميع إعدادات التسلسل
    settings = SequenceSettings.query.all()
    
    # إذا لم توجد إعدادات، قم بإنشاء الإعدادات الافتراضية
    if not settings:
        # إنشاء إعدادات افتراضية
        default_settings = [
            {
                'entity_type': 'purchase_request',
                'entity_name': 'طلب شراء',
                'prefix': 'REQ-',
                'next_number': 1
            },
            {
                'entity_type': 'price_quote',
                'entity_name': 'عرض سعر',
                'prefix': 'QUO-',
                'next_number': 1
            },
            {
                'entity_type': 'purchase_order',
                'entity_name': 'أمر شراء',
                'prefix': 'PO-',
                'next_number': 1
            },
            {
                'entity_type': 'invoice',
                'entity_name': 'مستخلص',
                'prefix': 'INV-',
                'next_number': 1
            },
            {
                'entity_type': 'other_transaction',
                'entity_name': 'معاملة أخرى',
                'prefix': 'TX-',
                'next_number': 1
            }
        ]
        
        for setting in default_settings:
            new_setting = SequenceSettings(
                entity_type=setting['entity_type'],
                entity_name=setting['entity_name'],
                prefix=setting['prefix'],
                next_number=setting['next_number'],
                updated_by=current_user.id
            )
            db.session.add(new_setting)
        
        db.session.commit()
        settings = SequenceSettings.query.all()
    
    return render_template('sequence_settings/index.html', settings=settings)

@sequence_settings_bp.route('/edit/<int:id>', methods=['GET', 'POST'])
@login_required
def edit(id):
    """تعديل إعدادات التسلسل"""
    # التحقق من صلاحيات المستخدم
    if current_user.role != 'مدير':
        flash('ليس لديك صلاحية للوصول إلى هذه الصفحة', 'danger')
        return redirect(url_for('auth.dashboard'))
    
    # استرجاع إعدادات التسلسل
    setting = SequenceSettings.query.get_or_404(id)
    
    if request.method == 'POST':
        # استخراج البيانات من النموذج
        prefix = request.form.get('prefix')
        next_number = request.form.get('next_number')
        
        # التحقق من صحة البيانات
        if not next_number:
            flash('الرقم التالي مطلوب', 'danger')
            return redirect(url_for('sequence_settings.edit', id=id))
        
        try:
            next_number = int(next_number)
            if next_number < 1:
                flash('يجب أن يكون الرقم التالي أكبر من أو يساوي 1', 'danger')
                return redirect(url_for('sequence_settings.edit', id=id))
        except ValueError:
            flash('يجب أن يكون الرقم التالي عددًا صحيحًا', 'danger')
            return redirect(url_for('sequence_settings.edit', id=id))
        
        # تحديث إعدادات التسلسل
        setting.prefix = prefix
        setting.next_number = next_number
        setting.updated_by = current_user.id
        
        db.session.commit()
        
        flash('تم تحديث إعدادات التسلسل بنجاح', 'success')
        return redirect(url_for('sequence_settings.index'))
    
    return render_template('sequence_settings/edit.html', setting=setting)