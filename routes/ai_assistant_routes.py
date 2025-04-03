"""
تم إيقاف وحدة مساعد الذكاء الاصطناعي للتخفيف من موارد النظام

هذا الملف يحل محل ملف ai_assistant_routes.py الأصلي ويحتوي فقط على 
Blueprint فارغ للإشارة إلى أن الوظيفة معطلة.
"""

from flask import Blueprint, render_template
from flask_login import login_required

ai_assistant_bp = Blueprint('ai_assistant', __name__, url_prefix='/ai-assistant')

@ai_assistant_bp.route('/')
@login_required
def index():
    """
    الصفحة الرئيسية لمساعد الذكاء الاصطناعي - معطلة حالياً
    
    Returns:
        رسالة تفيد بأن الميزة معطلة
    """
    return render_template('disabled_feature.html', 
                          feature_name="مساعد الذكاء الاصطناعي",
                          message="تم تعطيل ميزة مساعد الذكاء الاصطناعي مؤقتاً للتخفيف من النظام وتحسين الأداء.")

@ai_assistant_bp.route('/supplier-recommendations/<int:request_id>')
@login_required
def supplier_recommendations(request_id):
    """
    توصيات الموردين - معطلة حالياً
    
    Args:
        request_id: معرف طلب الشراء
        
    Returns:
        رسالة تفيد بأن الميزة معطلة
    """
    return render_template('disabled_feature.html', 
                          feature_name="توصيات الموردين الذكية",
                          message="تم تعطيل ميزة توصيات الموردين الذكية مؤقتاً للتخفيف من النظام وتحسين الأداء.")

@ai_assistant_bp.route('/order-analysis/<int:order_id>')
@login_required
def order_analysis(order_id):
    """
    تحليل أمر الشراء - معطلة حالياً
    
    Args:
        order_id: معرف أمر الشراء
        
    Returns:
        رسالة تفيد بأن الميزة معطلة
    """
    return render_template('disabled_feature.html', 
                          feature_name="تحليل أوامر الشراء",
                          message="تم تعطيل ميزة تحليل أوامر الشراء مؤقتاً للتخفيف من النظام وتحسين الأداء.")

@ai_assistant_bp.route('/purchase-insights')
@login_required
def purchase_insights():
    """
    رؤى المشتريات - معطلة حالياً
    
    Returns:
        رسالة تفيد بأن الميزة معطلة
    """
    return render_template('disabled_feature.html', 
                          feature_name="رؤى المشتريات الذكية",
                          message="تم تعطيل ميزة رؤى المشتريات الذكية مؤقتاً للتخفيف من النظام وتحسين الأداء.")

@ai_assistant_bp.route('/ask-question', methods=['GET', 'POST'])
@login_required
def ask_question():
    """
    سؤال المساعد - معطلة حالياً
    
    Returns:
        رسالة تفيد بأن الميزة معطلة
    """
    return render_template('disabled_feature.html', 
                          feature_name="سؤال المساعد الذكي",
                          message="تم تعطيل ميزة سؤال المساعد الذكي مؤقتاً للتخفيف من النظام وتحسين الأداء.")

@ai_assistant_bp.route('/question-result/<int:question_id>')
@login_required
def question_result(question_id):
    """
    نتيجة السؤال - معطلة حالياً
    
    Args:
        question_id: معرف السؤال
        
    Returns:
        رسالة تفيد بأن الميزة معطلة
    """
    return render_template('disabled_feature.html', 
                          feature_name="نتيجة السؤال الذكي",
                          message="تم تعطيل ميزة نتيجة السؤال الذكي مؤقتاً للتخفيف من النظام وتحسين الأداء.")