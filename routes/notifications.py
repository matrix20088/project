from datetime import datetime

from flask import Blueprint, render_template, flash, redirect, url_for, request, jsonify
from flask_login import login_required, current_user

from app import db
from models import Notification

# إنشاء blueprint للإشعارات
notifications_bp = Blueprint('notifications', __name__, url_prefix='/notifications')

@notifications_bp.route('/')
@login_required
def index():
    """عرض كل الإشعارات للمستخدم الحالي"""
    notifications = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).all()
    return render_template('notifications/index.html', notifications=notifications)

@notifications_bp.route('/unread')
@login_required
def unread():
    """عرض الإشعارات غير المقروءة للمستخدم الحالي"""
    notifications = Notification.query.filter_by(user_id=current_user.id, is_read=False, dismissed=False).order_by(Notification.created_at.desc()).all()
    return render_template('notifications/unread.html', notifications=notifications)

@notifications_bp.route('/count')
@login_required
def count():
    """إرجاع عدد الإشعارات غير المقروءة للمستخدم الحالي"""
    count = Notification.query.filter_by(user_id=current_user.id, is_read=False, dismissed=False).count()
    return jsonify({'count': count})

@notifications_bp.route('/mark-read/<int:id>', methods=['POST'])
@login_required
def mark_read(id):
    """تعليم إشعار كمقروء"""
    notification = Notification.query.filter_by(id=id, user_id=current_user.id).first_or_404()
    
    notification.is_read = True
    notification.read = True
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': 'تم تعليم الإشعار كمقروء'})

@notifications_bp.route('/mark-all-read', methods=['POST'])
@login_required
def mark_all_read():
    """تعليم كل الإشعارات كمقروءة"""
    unread_notifications = Notification.query.filter_by(user_id=current_user.id, is_read=False).all()
    
    for notification in unread_notifications:
        notification.is_read = True
        notification.read = True
    
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': 'تم تعليم كل الإشعارات كمقروءة'})

@notifications_bp.route('/dismiss/<int:id>', methods=['POST'])
@login_required
def dismiss(id):
    """إغلاق إشعار"""
    notification = Notification.query.filter_by(id=id, user_id=current_user.id).first_or_404()
    
    notification.dismissed = True
    db.session.commit()
    
    return jsonify({'status': 'success', 'message': 'تم حذف الإشعار'})

@notifications_bp.route('/view/<int:id>')
@login_required
def view(id):
    """عرض تفاصيل إشعار وتعليمه كمقروء"""
    notification = Notification.query.filter_by(id=id, user_id=current_user.id).first_or_404()
    
    # تعليم الإشعار كمقروء
    if not notification.is_read:
        notification.is_read = True
        notification.read = True
        db.session.commit()
    
    return render_template('notifications/view.html', notification=notification)