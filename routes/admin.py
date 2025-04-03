"""
وحدة إدارة النظام للمسؤول
تحتوي على وظائف إدارية متقدمة مثل تنظيف قاعدة البيانات وإعادة تعيين البيانات
"""

from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app, jsonify
from flask_login import login_required, current_user
from sqlalchemy import text

from app import db
from db_utils import safe_commit
from models import User, UserRole
from permissions import admin_required


# تعريف البلوبرنت
admin_bp = Blueprint('admin', __name__, url_prefix='/admin')


@admin_bp.route('/system')
@login_required
@admin_required
def system_management():
    """صفحة إدارة النظام المتقدمة - متاحة فقط للمسؤول"""
    return render_template('admin/system.html')


@admin_bp.route('/delete-all-transactions', methods=['POST'])
@login_required
@admin_required
def delete_all_transactions():
    """
    حذف جميع بيانات المعاملات من قاعدة البيانات
    يتم حذف:
    - طلبات الشراء وعناصرها
    - عروض الأسعار وعناصرها
    - أوامر الشراء وعناصرها
    - المستخلصات وعناصرها
    - المعاملات الأخرى
    - التوقيعات
    
    مع الحفاظ على:
    - بيانات المستخدمين والصلاحيات
    - المشاريع
    - الموردين
    - إعدادات النظام
    
    متطلبات الصلاحية: مسؤول النظام فقط (admin)
    """
    try:
        # حذف التوقيعات المرتبطة بالمعاملات
        db.session.execute(text("DELETE FROM signatures"))
        
        # حذف أصناف عروض الأسعار
        db.session.execute(text("DELETE FROM quote_items"))
        
        # حذف عروض الأسعار
        db.session.execute(text("DELETE FROM price_quotes"))
        
        # حذف أصناف أوامر الشراء
        db.session.execute(text("DELETE FROM purchase_order_items"))
        
        # حذف أوامر الشراء
        db.session.execute(text("DELETE FROM purchase_orders"))
        
        # حذف أصناف طلبات الشراء
        db.session.execute(text("DELETE FROM request_items"))
        
        # حذف طلبات الشراء
        db.session.execute(text("DELETE FROM purchase_requests"))
        
        # حذف المستخلصات وعناصرها
        db.session.execute(text("DELETE FROM invoice_items"))
        db.session.execute(text("DELETE FROM invoices"))
        
        # حذف المعاملات الأخرى
        db.session.execute(text("DELETE FROM other_transactions"))
        
        # إعادة تعيين تسلسل المعرفات (اختياري - إذا كنت تريد البدء من 1 مرة أخرى)
        tables = [
            "signatures", "quote_items", "price_quotes", "purchase_order_items",
            "purchase_orders", "request_items", "purchase_requests", 
            "invoice_items", "invoices", "other_transactions"
        ]
        
        # إعادة تعيين التسلسل لكل جدول (PostgreSQL)
        for table in tables:
            db.session.execute(text(f"ALTER SEQUENCE IF EXISTS {table}_id_seq RESTART WITH 1"))
        
        # حفظ التغييرات
        if safe_commit():
            return jsonify({"status": "success", "message": "تم حذف جميع بيانات المعاملات بنجاح"})
        else:
            return jsonify({"status": "error", "message": "حدث خطأ أثناء حفظ التغييرات"})
    
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"خطأ أثناء حذف البيانات: {str(e)}")
        return jsonify({"status": "error", "message": f"فشل في حذف البيانات: {str(e)}"})