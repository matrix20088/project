from datetime import datetime
import json
from app import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

# الأدوار المتاحة في النظام
class UserRole:
    """
    الأدوار المتاحة للمستخدمين في النظام
    """
    EMPLOYEE = 'موظف'  # موظف عادي
    PROJECT_MANAGER = 'مدير مشاريع'  # مدير مشاريع
    EXECUTIVE_MANAGER = 'مدير تنفيذي'  # مدير تنفيذي
    PURCHASING_STAFF = 'موظف مشتريات'  # موظف مشتريات
    ENGINEERING_OFFICE_MANAGER = 'مدير مكتب هندسي'  # مدير المكتب الهندسي
    FINANCIAL_MANAGER = 'مدير مالي'  # مدير مالي
    
    # قائمة بجميع الأدوار المتوفرة
    ALL_ROLES = [
        EMPLOYEE,
        PROJECT_MANAGER,
        EXECUTIVE_MANAGER,
        PURCHASING_STAFF,
        ENGINEERING_OFFICE_MANAGER,
        FINANCIAL_MANAGER,
    ]
    
    # الأدوار التي لها وصول لجميع المشاريع
    ROLES_WITH_FULL_ACCESS = [
        PROJECT_MANAGER,
        EXECUTIVE_MANAGER,
        PURCHASING_STAFF,
        ENGINEERING_OFFICE_MANAGER,
        FINANCIAL_MANAGER,
    ]

# نموذج المستخدم
class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(64), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(20), nullable=False, default='موظف')  # مدير، موظف مشتريات، محاسب، إلخ
    job_title = db.Column(db.String(100), nullable=True)  # المسمى الوظيفي للمستخدم
    signature_path = db.Column(db.String(255), nullable=True)  # مسار ملف التوقيع
    created_at = db.Column(db.DateTime, default=datetime.now)
    
    @property
    def is_admin(self):
        """التحقق ما إذا كان المستخدم هو المسؤول (admin)"""
        return self.username == 'admin'

    def __repr__(self):
        return f'<User {self.username}>'

# نموذج المورد
class Supplier(db.Model):
    __tablename__ = 'suppliers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.String(200))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))
    category = db.Column(db.String(50))  # تصنيف المورد (رئيسي، ثانوي، إلخ)
    performance_rating = db.Column(db.String(20))  # تقييم الأداء (ممتاز، جيد، متوسط)
    created_at = db.Column(db.DateTime, default=datetime.now)

    # العلاقات
    contracts = db.relationship('Contract', backref='supplier', lazy=True)
    purchase_orders = db.relationship('PurchaseOrder', backref='supplier_backref', lazy=True)
    price_quotes = db.relationship('PriceQuote', backref='supplier', lazy=True)

    def __repr__(self):
        return f'<Supplier {self.name}>'

# نموذج العقد
class Contract(db.Model):
    __tablename__ = 'contracts'

    id = db.Column(db.Integer, primary_key=True)
    contract_number = db.Column(db.String(50), unique=True, nullable=False)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    start_date = db.Column(db.Date, nullable=False)
    end_date = db.Column(db.Date, nullable=False)
    terms = db.Column(db.Text)  # الشروط والأحكام
    created_at = db.Column(db.DateTime, default=datetime.now)

    def __repr__(self):
        return f'<Contract {self.contract_number}>'

# نموذج طلب الشراء
class PurchaseRequest(db.Model):
    __tablename__ = 'purchase_requests'

    id = db.Column(db.Integer, primary_key=True)
    request_number = db.Column(db.String(50), unique=True, nullable=False)

    @classmethod
    def generate_request_number(cls):
        """
        توليد رقم فريد لطلب الشراء يعتمد على إعدادات التسلسل
        
        Returns:
            str: رقم طلب الشراء الجديد
        """
        from db_utils import handle_db_connection_error
        
        @handle_db_connection_error(max_retries=3)
        def _generate():
            # الحصول على الرقم التالي من إعدادات التسلسل
            try:
                # استخدام نموذج إعدادات التسلسل للحصول على الرقم التالي
                next_number, prefix = SequenceSettings.get_next_number('purchase_request')
                
                # تنسيق الرقم مع البادئة إن وجدت
                if prefix:
                    new_number = f"{prefix}{next_number}"
                else:
                    new_number = str(next_number).zfill(4)
                    
                return new_number
            except Exception as e:
                # في حالة حدوث خطأ، استخدم الطريقة القديمة للحفاظ على التوافق
                import logging
                logging.error(f"خطأ في توليد رقم طلب الشراء: {str(e)}")
                
                # البحث عن آخر رقم معاملة
                last_request = cls.query.order_by(cls.request_number.desc()).first()
                if last_request:
                    try:
                        # إذا كان الرقم السابق رقماً فقط
                        if last_request.request_number.isdigit():
                            last_number = int(last_request.request_number)
                            new_number = str(last_number + 1).zfill(4)
                        else:
                            # إذا كان الرقم مركباً (مثلاً "PR-0001")
                            parts = last_request.request_number.split('-')
                            if len(parts) == 2 and parts[1].isdigit():
                                prefix = parts[0] + '-'
                                last_number = int(parts[1])
                                new_number = f"{prefix}{str(last_number + 1).zfill(4)}"
                            else:
                                # إذا كان التنسيق غير معروف، استخدم الوقت الحالي
                                new_number = f"PR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                    except Exception:
                        # في حالة حدوث أي خطأ، استخدم الوقت الحالي
                        new_number = f"PR-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                else:
                    # إذا لم يكن هناك طلبات شراء سابقة
                    new_number = "0001"
                
                return new_number
        
        return _generate()

    request_date = db.Column(db.Date, nullable=True)  # تاريخ الطلب
    project_name = db.Column(db.String(255), nullable=True)  # اسم المشروع
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)  # رقم المشروع
    purpose = db.Column(db.Text, nullable=True)  # الغرض من الطلب
    attachment_path = db.Column(db.String(255), nullable=True)  # مسار المرفق
    status = db.Column(db.String(20), default='جديد')  # حالة الطلب (جديد، قيد المراجعة، معتمد، مرفوض، مكتمل)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # المستخدم الذي أنشأ الطلب
    created_at = db.Column(db.DateTime, default=datetime.now)  # تاريخ الإنشاء
    
    # للحفاظ على التوافق مع الكود القديم (properties)
    @property
    def title(self):
        return f"طلب شراء رقم {self.request_number}"
        
    @property
    def description(self):
        return self.purpose or ""
        
    @property
    def requester_id(self):
        return self.created_by
        
    @property
    def department(self):
        return ""
        
    @property
    def priority(self):
        return "عادي"

    # العلاقات
    requester = db.relationship('User', foreign_keys=[created_by], backref=db.backref('purchase_requests', lazy=True))
    project = db.relationship('Project', backref=db.backref('purchase_requests', lazy=True))
    items = db.relationship('PurchaseRequestItem', backref='request', lazy=True, cascade="all, delete-orphan")
    purchase_quotes = db.relationship('PriceQuote', foreign_keys='PriceQuote.purchase_request_id', backref='purchase_request', lazy=True)

    def __repr__(self):
        return f'<PurchaseRequest {self.request_number}>'

# نموذج عناصر طلب الشراء
class PurchaseRequestItem(db.Model):
    __tablename__ = 'purchase_request_items'

    id = db.Column(db.Integer, primary_key=True)
    purchase_request_id = db.Column(db.Integer, db.ForeignKey('purchase_requests.id'), nullable=False)
    item_name = db.Column(db.String(255), nullable=False)  # اسم المادة
    quantity = db.Column(db.Float, nullable=False)  # الكمية
    unit = db.Column(db.String(20))  # الوحدة (قطعة، كيلوغرام، متر، إلخ)
    estimated_price = db.Column(db.Float)  # السعر التقديري
    created_at = db.Column(db.DateTime, default=datetime.now)
    
    # للحفاظ على التوافق مع الكود السابق
    @property
    def request_id(self):
        return self.purchase_request_id
        
    @request_id.setter
    def request_id(self, value):
        self.purchase_request_id = value
        
    @property
    def name(self):
        return self.item_name
        
    @name.setter
    def name(self, value):
        self.item_name = value
        
    @property
    def description(self):
        return None

    def __repr__(self):
        return f'<PurchaseRequestItem {self.item_name}>'

# نموذج عرض السعر
class PriceQuote(db.Model):
    __tablename__ = 'price_quotes'

    id = db.Column(db.Integer, primary_key=True)
    quote_number = db.Column(db.String(50), unique=True, nullable=False)
    purchase_request_id = db.Column(db.Integer, db.ForeignKey('purchase_requests.id'), nullable=False)
    
    @property
    def request_id(self):
        return self.purchase_request_id
        
    @request_id.setter
    def request_id(self, value):
        self.purchase_request_id = value
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'), nullable=False)
    quote_date = db.Column(db.Date, nullable=False)
    total_price = db.Column(db.Float, nullable=False)  # السعر الإجمالي
    currency = db.Column(db.String(5), default='SAR')  # العملة
    status = db.Column(db.String(20), default='جديد')  # حالة العرض (جديد، قيد المراجعة، معتمد، مرفوض)
    notes = db.Column(db.Text)  # ملاحظات
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.now)

    # العلاقات
    # تم تعديل العلاقة لتتوافق مع اسم العمود في قاعدة البيانات
    items = db.relationship('PriceQuoteItem', foreign_keys='PriceQuoteItem.price_quote_id', backref='quote', lazy=True, cascade="all, delete-orphan")
    creator = db.relationship('User', backref=db.backref('created_quotes', lazy=True))
    
    @property
    def quote_items(self):
        """للتوافق مع القالب يتم إرجاع نفس عناصر items"""
        return self.items

    def __repr__(self):
        return f'<PriceQuote {self.quote_number}>'

# نموذج عناصر عرض السعر
class PriceQuoteItem(db.Model):
    __tablename__ = 'price_quote_items'

    id = db.Column(db.Integer, primary_key=True)
    price_quote_id = db.Column(db.Integer, db.ForeignKey('price_quotes.id'), nullable=False)
    request_item_id = db.Column(db.Integer, db.ForeignKey('purchase_request_items.id'), nullable=True)
    price = db.Column(db.Float)  # السعر (للتوافق مع الجدول الحالي)
    created_at = db.Column(db.DateTime, default=datetime.now)  # تاريخ الإنشاء
    
    # العلاقات
    request_item = db.relationship('PurchaseRequestItem', backref=db.backref('quote_items', lazy=True))
    # ملاحظة: quote=relationship تمت إزالتها لتجنب التعارض مع العلاقة في نموذج PriceQuote
    
    # للحفاظ على التوافق مع الكود القديم والمستقبلي
    @property
    def quote_id(self):
        return self.price_quote_id
        
    @quote_id.setter
    def quote_id(self, value):
        self.price_quote_id = value
        
    @property
    def name(self):
        if self.request_item:
            return self.request_item.item_name
        return "غير محدد"
        
    @property
    def description(self):
        return ""
        
    @property
    def quantity(self):
        if self.request_item:
            return self.request_item.quantity
        return 0
        
    @property
    def unit(self):
        if self.request_item:
            return self.request_item.unit
        return ""
        
    @property
    def unit_price(self):
        return self.price or 0
        
    @property
    def total_price(self):
        return self.quantity * self.unit_price if self.quantity and self.unit_price else 0

    def __repr__(self):
        return f'<PriceQuoteItem {self.name}>'

# نموذج أمر الشراء
class PurchaseOrder(db.Model):
    __tablename__ = 'purchase_orders'

    id = db.Column(db.Integer, primary_key=True)
    order_number = db.Column(db.String(50), unique=True, nullable=False)

    @classmethod
    def generate_order_number(cls):
        """
        توليد رقم فريد لأمر الشراء يعتمد على إعدادات التسلسل
        
        Returns:
            str: رقم أمر الشراء الجديد
        """
        from db_utils import handle_db_connection_error
        
        @handle_db_connection_error(max_retries=3)
        def _generate():
            # الحصول على الرقم التالي من إعدادات التسلسل
            try:
                # استخدام نموذج إعدادات التسلسل للحصول على الرقم التالي
                next_number, prefix = SequenceSettings.get_next_number('purchase_order')
                
                # تنسيق الرقم مع البادئة إن وجدت
                if prefix:
                    new_number = f"{prefix}{next_number}"
                else:
                    new_number = str(next_number).zfill(4)
                    
                return new_number
            except Exception as e:
                # في حالة حدوث خطأ، استخدم الطريقة القديمة للحفاظ على التوافق
                import logging
                logging.error(f"خطأ في توليد رقم أمر الشراء: {str(e)}")
                
                # البحث عن آخر رقم أمر شراء
                last_order = cls.query.order_by(cls.order_number.desc()).first()
                if last_order:
                    try:
                        # إذا كان الرقم السابق رقماً فقط
                        if last_order.order_number.isdigit():
                            last_number = int(last_order.order_number)
                            new_number = str(last_number + 1).zfill(4)
                        else:
                            # إذا كان الرقم مركباً (مثلاً "PO-0001")
                            parts = last_order.order_number.split('-')
                            if len(parts) == 2 and parts[1].isdigit():
                                prefix = parts[0] + '-'
                                last_number = int(parts[1])
                                new_number = f"{prefix}{str(last_number + 1).zfill(4)}"
                            else:
                                # إذا كان التنسيق غير معروف، استخدم الوقت الحالي
                                new_number = f"PO-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                    except Exception:
                        # في حالة حدوث أي خطأ، استخدم الوقت الحالي
                        new_number = f"PO-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                else:
                    # إذا لم يكن هناك أوامر شراء سابقة
                    new_number = "0001"
                
                return new_number
        
        return _generate()

    order_date = db.Column(db.Date, nullable=False)  # تاريخ الأمر
    purchase_request_id = db.Column(db.Integer, db.ForeignKey('purchase_requests.id'), nullable=True)  # رقم طلب الشراء المرتبط (اختياري)
    supplier_id = db.Column(db.Integer, db.ForeignKey('suppliers.id'))  # المورد
    delivery_date = db.Column(db.Date)  # تاريخ التسليم
    total_price = db.Column(db.Float)  # المبلغ الإجمالي
    attachment_path = db.Column(db.String(255))  # مسار المرفق
    
    # حالات الاعتماد المختلفة
    engineering_approval = db.Column(db.String(20), default='قيد الانتظار')  # اعتماد المكتب الهندسي
    projects_approval = db.Column(db.String(20), default='قيد الانتظار')  # اعتماد مدير المشاريع
    executive_approval = db.Column(db.String(20), default='قيد الانتظار')  # اعتماد المدير التنفيذي
    
    approval_status = db.Column(db.String(20), default='قيد الانتظار')  # حالة الاعتماد العامة
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # المستخدم الذي أنشأ الأمر
    created_at = db.Column(db.DateTime, default=datetime.now)  # وقت الإنشاء
    purpose = db.Column(db.Text)  # الغرض من الأمر
    
    # ربط المشروع (اختياري)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)
    
    # للتوافق مع الكود القديم
    @property
    def title(self):
        # إرجاع رقم الأمر كعنوان إذا لم يكن هناك غرض محدد
        return self.purpose or f"أمر شراء رقم {self.order_number}"
    
    @property
    def expected_delivery_date(self):
        return self.delivery_date
        
    @expected_delivery_date.setter
    def expected_delivery_date(self, value):
        self.delivery_date = value
        
    # إضافة خاصية status كاسم مستعار لـ approval_status للتوافق مع الكود القديم
    @property
    def status(self):
        return self.approval_status
        
    @status.setter
    def status(self, value):
        self.approval_status = value

    # العلاقات
    items = db.relationship('PurchaseOrderItem', backref='order', lazy=True, cascade="all, delete-orphan")
    creator = db.relationship('User', foreign_keys=[created_by], backref=db.backref('created_orders', lazy=True))
    purchase_request = db.relationship('PurchaseRequest', backref=db.backref('purchase_orders', lazy=True))

    def __repr__(self):
        return f'<PurchaseOrder {self.order_number}>'

# نموذج عناصر أمر الشراء
class PurchaseOrderItem(db.Model):
    __tablename__ = 'purchase_order_items'

    id = db.Column(db.Integer, primary_key=True)
    purchase_order_id = db.Column(db.Integer, db.ForeignKey('purchase_orders.id'), nullable=False)
    item_name = db.Column(db.String(255), nullable=False)  # اسم المادة
    quantity = db.Column(db.Float, nullable=False)  # الكمية
    unit = db.Column(db.String(20))  # الوحدة
    price = db.Column(db.Float, nullable=False)  # سعر الوحدة
    created_at = db.Column(db.DateTime, default=datetime.now)
    request_item_id = db.Column(db.Integer, db.ForeignKey('purchase_request_items.id'), nullable=True)
    
    # للحفاظ على التوافق مع الكود السابق
    @property
    def order_id(self):
        return self.purchase_order_id
        
    @order_id.setter
    def order_id(self, value):
        self.purchase_order_id = value
        
    @property
    def name(self):
        return self.item_name
        
    @name.setter
    def name(self, value):
        self.item_name = value
        
    @property
    def unit_price(self):
        return self.price
        
    @unit_price.setter
    def unit_price(self, value):
        self.price = value
        
    @property
    def description(self):
        return None
        
    @property
    def total_price(self):
        if self.price and self.quantity:
            return self.price * self.quantity
        return 0

    def __repr__(self):
        return f'<PurchaseOrderItem {self.item_name}>'

# نموذج سجل تدفق الموافقات
class ApprovalFlow(db.Model):
    __tablename__ = 'approval_flows'

    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(50), nullable=False)  # نوع الكيان (أمر شراء، مستخلص، معاملة أخرى)
    entity_id = db.Column(db.Integer, nullable=False)  # رقم معرف الكيان
    current_level = db.Column(db.Integer, default=1)  # المستوى الحالي للموافقة
    status = db.Column(db.String(20), default='قيد الانتظار')  # حالة الموافقة (قيد الانتظار، معتمد، مرفوض)
    created_at = db.Column(db.DateTime, default=datetime.now)  # وقت الإنشاء
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)  # وقت التحديث

    def __repr__(self):
        return f'<ApprovalFlow {self.entity_type} {self.entity_id}>'

# نموذج تسجيل الاعتمادات
class ApprovalLog(db.Model):
    __tablename__ = 'approval_logs'

    id = db.Column(db.Integer, primary_key=True)
    approval_type = db.Column(db.String(50), nullable=False)  # نوع المعاملة (مستخلص، أمر شراء، معاملة أخرى)
    reference_id = db.Column(db.Integer, nullable=False)  # رقم المرجع
    action = db.Column(db.String(20), nullable=False)  # نوع الإجراء (اعتماد، رفض)
    comments = db.Column(db.Text, nullable=True)  # ملاحظات
    approved_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # المستخدم الذي قام بالإجراء
    approval_date = db.Column(db.DateTime, default=datetime.now)  # تاريخ الإجراء

    # العلاقات
    user = db.relationship('User', backref=db.backref('approval_logs', lazy=True))

    def __repr__(self):
        return f'<ApprovalLog {self.id}>'

# نموذج علاقة مديري المشروع (لدعم أكثر من مدير للمشروع الواحد)
class ProjectManager(db.Model):
    """
    نموذج لربط المشروع بمديريه - يدعم وجود أكثر من مدير للمشروع الواحد
    """
    __tablename__ = 'project_managers'
    
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    role_description = db.Column(db.String(100), nullable=True)  # وصف إضافي لدور المدير (اختياري)
    created_at = db.Column(db.DateTime, default=datetime.now)
    
    # العلاقات
    project = db.relationship('Project', back_populates='project_managers')
    user = db.relationship('User', backref=db.backref('project_management_roles', lazy=True))
    
    def __repr__(self):
        return f'<ProjectManager Project={self.project_id} User={self.user_id}>'

# نموذج الإشعارات
class Notification(db.Model):
    """
    نموذج الإشعارات - يستخدم لإرسال وتخزين الإشعارات للمستخدمين
    """
    __tablename__ = 'notifications'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # المستخدم المستلم
    title = db.Column(db.String(100), nullable=False)  # عنوان الإشعار
    message = db.Column(db.Text, nullable=False)  # نص الإشعار
    category = db.Column(db.String(50), nullable=True)  # تصنيف الإشعار
    reference_type = db.Column(db.String(50), nullable=True)  # نوع الكيان المرتبط بالإشعار (اختياري)
    reference_id = db.Column(db.Integer, nullable=True)  # معرف الكيان المرتبط بالإشعار (اختياري)
    url = db.Column(db.String(255), nullable=True)  # رابط الإشعار (اختياري)
    read = db.Column(db.Boolean, default=False)  # حالة القراءة (مقروء / غير مقروء)
    dismissed = db.Column(db.Boolean, default=False)  # حالة الإغلاق (تم إغلاقه / لم يتم إغلاقه)
    extra_data = db.Column(db.Text, nullable=True)  # بيانات إضافية (يمكن تخزينها كـ JSON)
    created_at = db.Column(db.DateTime, default=datetime.now)  # وقت الإنشاء
    
    # للتوافق مع الكود القديم، نعرف خصائص مستعارة
    @property
    def entity_type(self):
        return self.reference_type
        
    @entity_type.setter
    def entity_type(self, value):
        self.reference_type = value
    
    @property
    def entity_id(self):
        return self.reference_id
        
    @entity_id.setter
    def entity_id(self, value):
        self.reference_id = value
    
    @property
    def is_read(self):
        return self.read
        
    @is_read.setter
    def is_read(self, value):
        self.read = value
    
    # العلاقات
    user = db.relationship('User', backref=db.backref('notifications', lazy=True))
    
    def __repr__(self):
        return f'<Notification {self.id}: {self.title}>'
    
    # توليد رابط الكيان المرتبط بالإشعار
    def get_entity_url(self):
        """
        توليد رابط الكيان المرتبط بالإشعار
        
        Returns:
            str: الرابط أو None إذا لم يكن هناك كيان مرتبط
        """
        # استخدام الرابط المخزن إذا كان موجودًا
        if self.url:
            return self.url
            
        # وإلا حاول توليد الرابط من نوع المرجع ومعرفه
        if not self.reference_type or not self.reference_id:
            return None
            
        if self.reference_type == 'purchase_order':
            return f'/purchase-orders/{self.reference_id}'
        elif self.reference_type == 'invoice':
            return f'/invoices/{self.reference_id}'
        elif self.reference_type == 'other_transaction':
            return f'/other-transactions/{self.reference_id}'
        elif self.reference_type == 'project':
            return f'/projects/{self.reference_id}'
        
        return None

# نموذج المعاملات الأخرى
class OtherTransaction(db.Model):
    __tablename__ = 'other_transactions'

    id = db.Column(db.Integer, primary_key=True)
    transaction_number = db.Column(db.String(50), unique=True, nullable=False)

    @classmethod
    def generate_transaction_number(cls):
        """
        توليد رقم فريد للمعاملة يعتمد على إعدادات التسلسل
        
        Returns:
            str: رقم المعاملة الجديد
        """
        from db_utils import handle_db_connection_error
        
        @handle_db_connection_error(max_retries=3)
        def _generate():
            # الحصول على الرقم التالي من إعدادات التسلسل
            try:
                # استخدام نموذج إعدادات التسلسل للحصول على الرقم التالي
                next_number, prefix = SequenceSettings.get_next_number('other_transaction')
                
                # تنسيق الرقم مع البادئة إن وجدت
                if prefix:
                    new_number = f"{prefix}{next_number}"
                else:
                    new_number = str(next_number).zfill(4)
                    
                return new_number
            except Exception as e:
                # في حالة حدوث خطأ، استخدم الطريقة القديمة للحفاظ على التوافق
                import logging
                logging.error(f"خطأ في توليد رقم المعاملة: {str(e)}")
                
                # البحث عن آخر رقم معاملة
                last_transaction = cls.query.order_by(cls.transaction_number.desc()).first()
                if last_transaction:
                    try:
                        # إذا كان الرقم السابق رقماً فقط
                        if last_transaction.transaction_number.isdigit():
                            last_number = int(last_transaction.transaction_number)
                            new_number = str(last_number + 1).zfill(4)
                        else:
                            # إذا كان الرقم مركباً (مثلاً "OT-0001")
                            parts = last_transaction.transaction_number.split('-')
                            if len(parts) == 2 and parts[1].isdigit():
                                prefix = parts[0] + '-'
                                last_number = int(parts[1])
                                new_number = f"{prefix}{str(last_number + 1).zfill(4)}"
                            else:
                                # إذا كان التنسيق غير معروف، استخدم الوقت الحالي
                                new_number = f"OT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                    except Exception:
                        # في حالة حدوث أي خطأ، استخدم الوقت الحالي
                        new_number = f"OT-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                else:
                    # إذا لم يكن هناك معاملات سابقة
                    new_number = "0001"
                
                return new_number
        
        return _generate()

    transaction_type = db.Column(db.String(50), nullable=False)  # نوع المعاملة (ضمان، تمديد، تذكرة، إلخ)
    transaction_date = db.Column(db.Date, nullable=False)  # تاريخ المعاملة
    description = db.Column(db.Text, nullable=False)  # وصف المعاملة
    amount = db.Column(db.Float, nullable=True)  # قيمة المعاملة
    vat_inclusive = db.Column(db.Boolean, default=True)  # هل المبلغ يشمل ضريبة القيمة المضافة
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)  # رقم المشروع
    project_name = db.Column(db.String(255), nullable=True)  # اسم المشروع
    attachment_path = db.Column(db.String(255), nullable=True)  # مسار المرفق
    approval_status = db.Column(db.String(20), default='قيد الانتظار')  # حالة الاعتماد (قيد الانتظار، معتمد، مرفوض)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # المستخدم الذي أنشأ المعاملة
    created_at = db.Column(db.DateTime, default=datetime.now)  # وقت الإنشاء
    
    # العلاقات
    creator = db.relationship('User', foreign_keys=[created_by], backref=db.backref('created_transactions', lazy=True))
    
    # خاصية user للتوافق مع الكود القديم (لأن بعض الكود يستخدم user بدلاً من creator)
    @property
    def user(self):
        return self.creator
    
    # للحفاظ على التوافق مع الكود القديم (properties)
    @property
    def title(self):
        return f"معاملة {self.transaction_type}"
        
    @property
    def status(self):
        return self.approval_status
        
    # تم التعليق على هذه الخاصية لأننا الآن نستخدم عمود amount بدلاً منها
    # @property
    # def amount(self):
    #     return None
        
    @property
    def currency(self):
        return 'SAR'
        
    @property
    def approval_notes(self):
        return None
        
    @property
    def approved_by(self):
        return None
        
    @property
    def approved_at(self):
        return None
        
    @property
    def notes(self):
        return None
        
    @property
    def attachments(self):
        return self.attachment_path
    
    # للتوافق مع الكود القديم - نستخدم الخصائص
    @property
    def supplier_id(self):
        return None
        
    @property
    def supplier(self):
        return None

    def __repr__(self):
        return f'<OtherTransaction {self.transaction_number}>'

# نموذج المستخلص
class Invoice(db.Model):
    __tablename__ = 'invoices'

    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(50), unique=True, nullable=False)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    @classmethod
    def generate_invoice_number(cls):
        """
        توليد رقم فريد للمستخلص يعتمد على إعدادات التسلسل
        
        Returns:
            str: رقم المستخلص الجديد
        """
        from db_utils import handle_db_connection_error
        
        @handle_db_connection_error(max_retries=3)
        def _generate():
            # الحصول على الرقم التالي من إعدادات التسلسل
            try:
                # استخدام نموذج إعدادات التسلسل للحصول على الرقم التالي
                next_number, prefix = SequenceSettings.get_next_number('invoice')
                
                # تنسيق الرقم مع البادئة إن وجدت
                if prefix:
                    new_number = f"{prefix}{next_number}"
                else:
                    new_number = str(next_number).zfill(4)
                    
                return new_number
            except Exception as e:
                # في حالة حدوث خطأ، استخدم الطريقة القديمة للحفاظ على التوافق
                import logging
                logging.error(f"خطأ في توليد رقم المستخلص: {str(e)}")
                
                # البحث عن آخر رقم مستخلص
                last_invoice = cls.query.order_by(cls.invoice_number.desc()).first()
                if last_invoice:
                    try:
                        # إذا كان الرقم السابق رقماً فقط
                        if last_invoice.invoice_number.isdigit():
                            last_number = int(last_invoice.invoice_number)
                            new_number = str(last_number + 1).zfill(4)
                        else:
                            # إذا كان الرقم مركباً (مثلاً "INV-0001")
                            parts = last_invoice.invoice_number.split('-')
                            if len(parts) == 2 and parts[1].isdigit():
                                prefix = parts[0] + '-'
                                last_number = int(parts[1])
                                new_number = f"{prefix}{str(last_number + 1).zfill(4)}"
                            else:
                                # إذا كان التنسيق غير معروف، استخدم الوقت الحالي
                                new_number = f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                    except Exception:
                        # في حالة حدوث أي خطأ، استخدم الوقت الحالي
                        new_number = f"INV-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                else:
                    # إذا لم يكن هناك مستخلصات سابقة
                    new_number = "0001"
                
                return new_number
        
        return _generate()

    invoice_date = db.Column(db.Date)  # تاريخ المستخلص
    project_name = db.Column(db.String(255))  # اسم المشروع
    description = db.Column(db.Text, nullable=True)  # وصف المستخلص
    invoice_amount = db.Column(db.Float)  # المبلغ الإجمالي
    attachment_path = db.Column(db.String(255))  # مسار المرفق
    approval_status = db.Column(db.String(20), default='قيد الانتظار')  # حالة الاعتماد (قيد الانتظار، معتمد، مرفوض)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # المستخدم الذي أنشأ المستخلص
    created_at = db.Column(db.DateTime, default=datetime.now)  # وقت الإنشاء
    
    # ربط المشروع (مطلوب)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=True)

    # العلاقات
    creator = db.relationship('User', foreign_keys=[created_by], backref=db.backref('created_invoices', lazy=True))
    
    # خاصية user للتوافق مع الكود القديم (لأن بعض الكود يستخدم user بدلاً من creator)
    @property
    def user(self):
        return self.creator
    
    # للتوافق مع الكود القديم
    @property
    def title(self):
        return f"مستخلص رقم {self.invoice_number}"
        
    @property
    def project_description(self):
        """بديل لخاصية description السابقة للتوافق مع الكود القديم"""
        return self.project_name
        
    @property
    def amount(self):
        return self.invoice_amount
    
    @amount.setter
    def amount(self, value):
        self.invoice_amount = value

    def __repr__(self):
        return f'<Invoice {self.invoice_number}>'

# نموذج عنصر المستخلص
class InvoiceItem(db.Model):
    __tablename__ = 'invoice_items'

    id = db.Column(db.Integer, primary_key=True)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoices.id'), nullable=False)
    description = db.Column(db.String(255), nullable=False)  # وصف البند
    quantity = db.Column(db.Float, nullable=False)  # الكمية
    unit = db.Column(db.String(20))  # الوحدة
    unit_price = db.Column(db.Float, nullable=False)  # سعر الوحدة
    total_price = db.Column(db.Float, nullable=False)  # السعر الإجمالي

    # العلاقات
    invoice = db.relationship('Invoice', backref=db.backref('items', lazy=True, cascade="all, delete-orphan"))

    def __repr__(self):
        return f'<InvoiceItem {self.description}>'

# نموذج المشروع
class Project(db.Model):
    """
    نموذج المشروع - يمثل مشروع يتم تنفيذه عن طريق الشركة
    يمكن ربط المعاملات المختلفة مثل أوامر الشراء والمستخلصات بمشروع محدد
    """
    __tablename__ = 'projects'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)  # اسم المشروع
    code = db.Column(db.String(50), unique=True, nullable=False)  # كود المشروع المميز
    description = db.Column(db.Text, nullable=True)  # وصف المشروع
    
    # معلومات العميل
    client_name = db.Column(db.String(255), nullable=False)  # اسم العميل
    client_contact_person = db.Column(db.String(255), nullable=True)  # الشخص المسؤول لدى العميل
    client_email = db.Column(db.String(120), nullable=True)  # البريد الإلكتروني للعميل
    client_phone = db.Column(db.String(20), nullable=True)  # رقم هاتف العميل
    
    # معلومات المشروع
    location = db.Column(db.String(255), nullable=True)  # موقع المشروع
    start_date = db.Column(db.Date, nullable=True)  # تاريخ بداية المشروع
    expected_end_date = db.Column(db.Date, nullable=True)  # تاريخ الانتهاء المتوقع
    actual_end_date = db.Column(db.Date, nullable=True)  # تاريخ الانتهاء الفعلي
    
    # القيمة المالية للمشروع
    contract_value = db.Column(db.Float, nullable=True)  # قيمة العقد
    estimated_budget = db.Column(db.Float, nullable=True)  # الميزانية التقديرية للمشروع
    currency = db.Column(db.String(5), default='SAR')  # العملة
    
    # حالة المشروع
    status = db.Column(db.String(50), default='نشط')  # حالة المشروع (نشط، متوقف، مكتمل، ملغي)
    
    # المعلومات الإدارية
    manager_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # مدير المشروع
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)  # المستخدم الذي أنشأ المشروع
    created_at = db.Column(db.DateTime, default=datetime.now)  # تاريخ إنشاء السجل
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)  # تاريخ تحديث السجل
    
    # بيانات إضافية
    extra_data = db.Column(db.Text, nullable=True)  # بيانات إضافية بتنسيق JSON
    
    # العلاقات
    manager = db.relationship('User', foreign_keys=[manager_id], backref=db.backref('managed_projects', lazy=True))
    creator = db.relationship('User', foreign_keys=[created_by], backref=db.backref('created_projects', lazy=True))
    
    # علاقة مديري المشروع - العديد من المديرين للمشروع الواحد
    project_managers = db.relationship('ProjectManager', back_populates='project', lazy=True, cascade="all, delete-orphan")
    
    # قائمة أوامر الشراء المرتبطة بالمشروع
    purchase_orders = db.relationship('PurchaseOrder', backref='project', lazy=True)
    
    # قائمة المستخلصات المرتبطة بالمشروع
    invoices = db.relationship('Invoice', backref='project', lazy=True)
    
    # أعضاء المشروع
    members = db.relationship('ProjectMembership', back_populates='project', lazy=True, cascade="all, delete-orphan")
    
    # قائمة المعاملات الأخرى المرتبطة بالمشروع
    other_transactions = db.relationship('OtherTransaction', backref='project', lazy=True)

    def __repr__(self):
        return f'<Project {self.code}: {self.name}>'
    
    # حفظ البيانات الإضافية بتنسيق JSON
    def set_extra_data(self, data_dict):
        """
        تعيين البيانات الإضافية كـ JSON
        
        Args:
            data_dict: القاموس الذي يحتوي على البيانات الإضافية
        """
        self.extra_data = json.dumps(data_dict)
    
    # استرجاع البيانات الإضافية من JSON
    def get_extra_data(self):
        """
        استرجاع البيانات الإضافية من JSON
        
        Returns:
            dict: قاموس البيانات الإضافية
        """
        if self.extra_data:
            return json.loads(self.extra_data)
        return {}

# نموذج إعدادات التسلسل
class SequenceSettings(db.Model):
    """
    نموذج إعدادات تسلسل الأرقام للمعاملات المختلفة
    يسمح بتخصيص بادئة ورقم بداية لكل نوع من المعاملات
    """
    __tablename__ = 'sequence_settings'
    
    id = db.Column(db.Integer, primary_key=True)
    entity_type = db.Column(db.String(50), nullable=False, unique=True)  # نوع الكيان (purchase_order, invoice, etc)
    prefix = db.Column(db.String(10), nullable=True)  # البادئة الاختيارية (PO-, INV-, etc)
    next_number = db.Column(db.Integer, nullable=False, default=1)  # الرقم التالي
    created_at = db.Column(db.DateTime, default=datetime.now)  # تاريخ الإنشاء
    updated_at = db.Column(db.DateTime, default=datetime.now, onupdate=datetime.now)  # تاريخ التحديث
    
    @classmethod
    def get_next_number(cls, entity_type):
        """
        الحصول على الرقم التالي لنوع كيان معين
        
        Args:
            entity_type: نوع الكيان (مثل 'purchase_order', 'invoice', إلخ)
            
        Returns:
            tuple: (الرقم التالي, البادئة)
        """
        from db_utils import safe_commit
        from app import db
        
        # البحث عن إعدادات التسلسل لهذا النوع
        setting = cls.query.filter_by(entity_type=entity_type).with_for_update().first()
        
        if not setting:
            # إذا لم يتم العثور على الإعدادات، أنشئ واحدة جديدة
            if entity_type == 'purchase_order':
                prefix = 'PO-'
            elif entity_type == 'invoice':
                prefix = 'INV-'
            elif entity_type == 'purchase_request':
                prefix = 'PR-'
            elif entity_type == 'other_transaction':
                prefix = 'OT-'
            else:
                prefix = ''
                
            setting = cls(entity_type=entity_type, prefix=prefix, next_number=1)
            db.session.add(setting)
        
        # حفظ الرقم الحالي
        current_number = setting.next_number
        
        # زيادة الرقم التالي
        setting.next_number += 1
        
        # حفظ التغييرات
        if not safe_commit():
            # في حالة فشل الحفظ
            db.session.rollback()
            raise Exception("فشل في حفظ الرقم التالي للتسلسل")
        
        return current_number, setting.prefix
    
    @classmethod
    def reset_sequence(cls, entity_type, new_starting_number=1, new_prefix=None):
        """
        إعادة تعيين تسلسل الأرقام لنوع معين من الكيانات
        
        Args:
            entity_type: نوع الكيان
            new_starting_number: رقم البداية الجديد (القيمة الافتراضية: 1)
            new_prefix: البادئة الجديدة (اختياري، إذا كانت None، سيتم الاحتفاظ بالبادئة الحالية)
            
        Returns:
            bool: هل تمت العملية بنجاح
        """
        from db_utils import safe_commit
        
        setting = cls.query.filter_by(entity_type=entity_type).first()
        if setting:
            # إذا وجدت الإعدادات، حدثها
            setting.next_number = new_starting_number
            if new_prefix is not None:
                setting.prefix = new_prefix
        else:
            # إذا لم توجد، أنشئ واحدة جديدة
            setting = cls(
                entity_type=entity_type,
                prefix=new_prefix if new_prefix is not None else '',
                next_number=new_starting_number
            )
            db.session.add(setting)
        
        # حفظ التغييرات
        return safe_commit()

# نموذج صلاحيات المستخدم
class UserPermission(db.Model):
    """
    نموذج صلاحيات المستخدمين - يسمح بتخصيص صلاحيات مخصصة للمستخدمين بالإضافة إلى الصلاحيات الافتراضية التي تعتمد على دورهم
    """
    __tablename__ = 'user_permissions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    module = db.Column(db.String(50), nullable=False)  # اسم الوحدة
    can_read = db.Column(db.Boolean, default=False)  # صلاحية العرض
    can_create = db.Column(db.Boolean, default=False)  # صلاحية الإنشاء
    can_update = db.Column(db.Boolean, default=False)  # صلاحية التعديل
    can_delete = db.Column(db.Boolean, default=False)  # صلاحية الحذف
    can_approve = db.Column(db.Boolean, default=False)  # صلاحية الاعتماد
    
    # هذه الأعمدة غير موجودة في قاعدة البيانات، تمت إزالتها من النموذج
    # created_at = db.Column(db.DateTime, default=datetime.now)  # تاريخ الإنشاء
    # created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)  # المستخدم الذي قام بإنشاء الصلاحية
    
    # للتوافق مع الكود القديم
    @property
    def module_name(self):
        return self.module
        
    @module_name.setter
    def module_name(self, value):
        self.module = value
        
    @property
    def can_view(self):
        return self.can_read
        
    @can_view.setter
    def can_view(self, value):
        self.can_read = value
        
    @property
    def can_edit(self):
        return self.can_update
        
    @can_edit.setter
    def can_edit(self, value):
        self.can_update = value
    
    # العلاقات
    user = db.relationship('User', foreign_keys=[user_id], backref=db.backref('permissions', lazy=True))
    # تمت إزالة علاقة creator لأن عمود created_by غير موجود في قاعدة البيانات
    
    def __repr__(self):
        return f'<UserPermission {self.user_id}:{self.module_name}>'
        
# نموذج عضوية المشروع
class ProjectMembership(db.Model):
    """
    نموذج عضوية المستخدمين في المشاريع - يستخدم لإدارة المستخدمين المرتبطين بكل مشروع
    """
    __tablename__ = 'project_memberships'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='عضو')  # دور المستخدم في المشروع (مدير، عضو، مراقب، إلخ)
    created_at = db.Column(db.DateTime, default=datetime.now)  # تاريخ الإضافة للمشروع
    
    # العلاقات
    user = db.relationship('User', backref=db.backref('project_memberships', lazy=True))
    project = db.relationship('Project', back_populates='members')
    
    def __repr__(self):
        return f'<ProjectMembership {self.user.username} - {self.project.name}>'