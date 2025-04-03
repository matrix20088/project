# Import required libraries
import os
import logging
import sqlalchemy
from sqlalchemy import func, exc as sqlalchemy_exc
from datetime import datetime
from flask import Flask, render_template
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.orm import DeclarativeBase
from flask_login import LoginManager, current_user
from flask_migrate import Migrate


# Configure logging for debugging
logging.basicConfig(level=logging.DEBUG)

# إنشاء فلتر nl2br لتحويل أسطر النص إلى علامات <br>
def nl2br(value):
    if value:
        return value.replace('\n', '<br>\n')
    return value

# Create the base class for database models
class Base(DeclarativeBase):
    pass


# Create database object
db = SQLAlchemy(model_class=Base)

# Create Flask application
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default_secret_key_for_development")
# Set session expiration time - expires when browser closes (permanent=False)
app.config["SESSION_PERMANENT"] = False
app.config["PERMANENT_SESSION_LIFETIME"] = 1800  # 30 minutes
# لمنع بقاء الجلسة عند إعادة تشغيل التطبيق
app.config["SESSION_REFRESH_EACH_REQUEST"] = True
app.config["REMEMBER_COOKIE_DURATION"] = 1800  # 30 minutes

# إضافة فلتر nl2br إلى Jinja2
app.jinja_env.filters['nl2br'] = nl2br

# تم إلغاء SocketIO تماماً
# هذا الكائن لن يقوم بأي شيء، ولكنه موجود فقط لتجنب الأخطاء في الأماكن التي تستخدمه
class DummySocketIO:
    def emit(self, *args, **kwargs):
        pass
    def on(self, *args, **kwargs):
        def dummy_decorator(f):
            return f
        return dummy_decorator

# نستخدم كائن وهمي بدلاً من SocketIO الحقيقي
socketio = DummySocketIO()

# Configure database
database_url = os.environ.get("DATABASE_URL", "sqlite:///instance/procurement_system.db")
if database_url and database_url.startswith("postgres://"):
    database_url = database_url.replace("postgres://", "postgresql://")
app.config["SQLALCHEMY_DATABASE_URI"] = database_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_recycle": 180,  # تقليل وقت إعادة تدوير الاتصالات
    "pool_pre_ping": True,  # التأكد من أن الاتصال لا يزال نشطًا قبل استخدامه
    "pool_size": 20,  # حجم تجمع الاتصالات
    "max_overflow": 10,  # زيادة العدد الأقصى للاتصالات الإضافية
    "pool_timeout": 30,  # مهلة انتظار الاتصال
    "connect_args": {
        "connect_timeout": 10,  # مهلة إنشاء الاتصال
        "keepalives": 1,  # تفعيل keepalive
        "keepalives_idle": 30,  # وقت الخمول قبل إرسال keepalive
        "keepalives_interval": 10,  # الفاصل الزمني بين رسائل keepalive
        "keepalives_count": 5  # عدد محاولات keepalive قبل اعتبار الاتصال مقطوعًا
    }
}
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_RECORD_QUERIES"] = False  # تعطيل تسجيل الاستعلامات لتحسين الأداء

# Initialize database with application
db.init_app(app)
migrate = Migrate(app, db)

# Initialize database
with app.app_context():
    # Import models to ensure all tables are defined
    import models
    
    try:
        # Create tables if they don't exist
        db.create_all()
        db.session.commit()
        print("Database verified successfully")
    except Exception as e:
        print(f"Error verifying database: {str(e)}")
        db.session.rollback()

# Setup login manager
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'auth.login'
login_manager.login_message = 'الرجاء تسجيل الدخول للوصول إلى هذه الصفحة'
login_manager.session_protection = "strong"

# Import and register blueprints
from auth import auth_bp
from routes.suppliers import suppliers_bp
from routes.purchase_orders import purchase_orders_bp
from routes.inventory import inventory_bp
from routes.approvals import approvals_bp
from routes.users import users_bp
# تعطيل التقارير القديمة
# from routes.reports import reports_bp
# استخدام وحدة التقارير الجديدة
from routes.expense_reports import expense_reports_bp
from routes.notifications import notifications_bp
from routes.ai_assistant_routes import ai_assistant_bp
from routes.invoices import invoices_bp
from routes.other_transactions import other_transactions_bp
from routes.sequence_settings import sequence_settings_bp
from routes.projects import projects_bp
from routes.admin import admin_bp
from onboarding import onboarding_bp

app.register_blueprint(auth_bp)
app.register_blueprint(suppliers_bp)
app.register_blueprint(purchase_orders_bp)
app.register_blueprint(inventory_bp)
app.register_blueprint(approvals_bp)
app.register_blueprint(users_bp)
# تسجيل التقارير الجديدة
app.register_blueprint(expense_reports_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(ai_assistant_bp)
app.register_blueprint(invoices_bp)
app.register_blueprint(other_transactions_bp)
app.register_blueprint(sequence_settings_bp)
app.register_blueprint(projects_bp, url_prefix='/projects')
app.register_blueprint(admin_bp)
app.register_blueprint(onboarding_bp, url_prefix='/onboarding')

# Import database models and create tables
with app.app_context():
    import models
    db.create_all()
    
    # تهيئة نظام التوقيعات
    import signatures
    signatures.init_signatures_directory()
    
    # Create default admin user if not exists
    from models import User
    from werkzeug.security import generate_password_hash
    
    admin = User.query.filter_by(username='admin').first()
    if not admin:
        admin_user = User(
            username='admin',
            email='admin@example.com',
            password_hash=generate_password_hash('admin123'),
            role='مدير',
            phone='1234567890'
        )
        db.session.add(admin_user)
        db.session.commit()
        logging.debug("Default admin user created")

# Load user in login manager
@login_manager.user_loader
def load_user(user_id):
    from models import User
    return User.query.get(int(user_id))

# Add global context variables for all templates
@app.context_processor
def inject_now():
    return {'now': datetime.now()}
    
# إضافة قيم صفرية للمتغيرات الضرورية للقوالب
@app.context_processor
def inject_notifications_count():
    # تم إلغاء وظيفة الإشعارات - لكن يجب إرجاع قيمة صفرية لتجنب أخطاء في القالب
    return {'notifications_count': 0}

# إضافة قيم صفرية لعدادات المعاملات
@app.context_processor
def inject_pending_approvals():
    # تم تبسيط الوظيفة لإرجاع قيم ثابتة دون الحاجة للاستعلام من قاعدة البيانات
    return {
        'pending_pos': 0,
        'pending_invoices': 0,
        'pending_transactions': 0
    }

# Error handling
@app.errorhandler(404)
def not_found_error(error):
    return render_template('errors/404.html'), 404

@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()
    logging.error(f"خطأ داخلي في الخادم: {error}")
    return render_template('errors/500.html'), 500

@app.errorhandler(sqlalchemy_exc.OperationalError)
def db_operational_error(error):
    """معالج أخطاء اتصال قاعدة البيانات"""
    db.session.rollback()
    logging.error(f"خطأ اتصال بقاعدة البيانات: {error}")
    
    try:
        # محاولة إعادة الاتصال بقاعدة البيانات
        from db_utils import reconnect_db
        reconnect_success = reconnect_db()
        if reconnect_success:
            logging.info("تم إعادة الاتصال بقاعدة البيانات بنجاح")
            # في حالة نجاح إعادة الاتصال، حاول إعادة توجيه المستخدم للصفحة الرئيسية
            from flask import redirect, url_for
            return redirect(url_for('auth.dashboard'))
    except Exception as e:
        logging.error(f"فشلت محاولة إعادة الاتصال بقاعدة البيانات: {e}")
    
    return render_template('errors/db_error.html'), 500

@app.errorhandler(sqlalchemy_exc.SQLAlchemyError)
def sqlalchemy_error(error):
    """معالج أخطاء SQLAlchemy العامة"""
    db.session.rollback()
    logging.error(f"خطأ SQLAlchemy: {error}")
    
    # تسجيل معلومات إضافية قد تساعد في التشخيص
    logging.error(f"نوع الخطأ: {type(error).__name__}")
    
    # خطأ مخصص لمشاكل قاعدة البيانات
    if isinstance(error, (sqlalchemy_exc.DatabaseError, sqlalchemy_exc.DBAPIError)):
        return render_template('errors/db_error.html'), 500
    
    return render_template('errors/500.html'), 500
