"""
معالج التهيئة التفاعلي
---------------------
هذا الملف يحتوي على وظائف معالج التهيئة التفاعلي الذي يقدم دليلاً خطوة بخطوة
لعملية المشتريات في النظام
"""

from flask import Blueprint, render_template, redirect, url_for, session, request, flash
from flask_login import login_required, current_user
import logging

# إعداد التسجيل
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

onboarding_bp = Blueprint('onboarding', __name__)

# عدد خطوات المعالج
TOTAL_STEPS = 5

@onboarding_bp.route('/wizard')
@login_required
def wizard_index():
    """الصفحة الرئيسية للمعالج التفاعلي"""
    # إعادة ضبط حالة المعالج
    session['wizard_step'] = 1
    session['wizard_completed'] = False
    
    return render_template('onboarding/wizard_index.html')

@onboarding_bp.route('/wizard/step/<int:step_num>', methods=['GET', 'POST'])
@login_required
def wizard_step(step_num):
    """خطوة محددة في المعالج التفاعلي"""
    
    # التحقق من صحة رقم الخطوة
    if step_num < 1 or step_num > TOTAL_STEPS:
        flash('رقم الخطوة غير صحيح', 'danger')
        return redirect(url_for('onboarding.wizard_index'))
    
    # حفظ الخطوة الحالية في الجلسة
    session['wizard_step'] = step_num
    
    # عند إرسال النموذج (الانتقال للخطوة التالية)
    if request.method == 'POST':
        next_step = step_num + 1
        
        # التحقق مما إذا كانت هذه هي الخطوة الأخيرة
        if next_step > TOTAL_STEPS:
            # اكتمال المعالج
            session['wizard_completed'] = True
            flash('تم اكتمال معالج التهيئة بنجاح!', 'success')
            return redirect(url_for('onboarding.wizard_complete'))
        
        # الانتقال إلى الخطوة التالية
        return redirect(url_for('onboarding.wizard_step', step_num=next_step))
    
    # تحديد قالب الخطوة المناسب
    templates = {
        1: 'onboarding/step1_overview.html',       # نظرة عامة على عملية المشتريات
        2: 'onboarding/step2_request.html',        # إنشاء طلب شراء
        3: 'onboarding/step3_approval.html',       # عملية الموافقة
        4: 'onboarding/step4_order.html',          # تحويل الطلب إلى أمر شراء
        5: 'onboarding/step5_delivery.html',       # استلام الطلبية وإغلاق أمر الشراء
    }
    
    return render_template(
        templates[step_num],
        current_step=step_num,
        total_steps=TOTAL_STEPS,
        next_step=step_num + 1 if step_num < TOTAL_STEPS else None,
        prev_step=step_num - 1 if step_num > 1 else None
    )

@onboarding_bp.route('/wizard/complete')
@login_required
def wizard_complete():
    """صفحة إكمال المعالج"""
    # التحقق مما إذا كان المعالج قد تم إكماله فعلاً
    if not session.get('wizard_completed', False):
        return redirect(url_for('onboarding.wizard_index'))
    
    return render_template('onboarding/wizard_complete.html')

@onboarding_bp.route('/wizard/skip')
@login_required
def wizard_skip():
    """تخطي المعالج والعودة إلى لوحة التحكم"""
    # وضع علامة على أن المستخدم قد تخطى المعالج
    session['wizard_skipped'] = True
    flash('تم تخطي معالج التهيئة', 'info')
    return redirect(url_for('auth.dashboard'))