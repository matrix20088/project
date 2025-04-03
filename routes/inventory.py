"""
تم إيقاف وحدة المخازن للتخفيف من موارد النظام

هذا الملف يحل محل ملف inventory.py الأصلي ويحتوي فقط على 
Blueprint فارغ للإشارة إلى أن الوظيفة معطلة.
"""

from flask import Blueprint, render_template
from flask_login import login_required

inventory_bp = Blueprint('inventory', __name__, url_prefix='/inventory')

@inventory_bp.route('/')
@login_required
def index():
    """
    الصفحة الرئيسية للمخازن - معطلة حالياً
    
    Returns:
        رسالة تفيد بأن الميزة معطلة
    """
    return render_template('disabled_feature.html', 
                          feature_name="إدارة المخازن",
                          message="تم تعطيل ميزة إدارة المخازن مؤقتاً للتخفيف من النظام وتحسين الأداء.")