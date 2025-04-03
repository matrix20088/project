import logging
import os
from app import app
# تم تعطيل socketio مؤقتًا لحل مشاكل الاتصال
# from app import socketio
from scheduled_tasks import start_scheduler
import signatures
# استيراد نظام الهجرات التلقائية
from auto_migrate import run_auto_migration

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                   format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# لا داعي لتسجيل AI Assistant Blueprint هنا لأنه تم تسجيله في app.py
# تم حل مشكلة الـ URL من خلال تسجيل ai_assistant_bp في app.py

# Set OpenAI API Key
app.config['OPENAI_API_KEY'] = os.environ.get('OPENAI_API_KEY')

# تهيئة مجلد التوقيعات
signatures.init_signatures_directory()

# تعطيل الهجرات التلقائية مؤقتًا حتى يتم حل المشاكل
# with app.app_context():
#     try:
#         # حاول تشغيل الهجرات التلقائية فقط إذا كان التطبيق يعمل على الخادم الرئيسي
#         if os.environ.get('DATABASE_URL'):
#             run_auto_migration()
#     except Exception as e:
#         logger.error(f"خطأ أثناء تشغيل الهجرات التلقائية: {str(e)}")

# Log application startup
logger.info("Application started")

# Start the scheduler for approval notifications (مع تعطيل الإشعارات)
with app.app_context():
    # ملاحظة: تم تغيير الاستدعاء لتجنب استخدام SocketIO
    # كائن socketio المحدد في app.py هو كائن وهمي (dummy) لا يقوم بشيء
    start_scheduler(None)

# Unified execution method to work with Gunicorn
# This variable will be used in the .replit file and when called from gunicorn
# It's important to have only one app variable
# Use it in the execution line: gunicorn --bind 0.0.0.0:5000 main:app
# To ensure compatibility between server and application

if __name__ == "__main__":
    # Run the application in development mode
    # When executed directly as a Python script
    logger.info("Running application in development mode (without WebSockets)")
    app.run(host="0.0.0.0", port=5000, debug=True)
    
    # تم تعطيل تشغيل التطبيق بواسطة socketio مؤقتًا
    # socketio.run(app, host="0.0.0.0", port=5000, debug=True, allow_unsafe_werkzeug=True, use_reloader=True, log_output=True)
