from flask import Flask, render_template, Blueprint, redirect, url_for
from flask_login import login_required, current_user

app = Flask(__name__)
app.secret_key = "secret_key"  # Replace with a strong secret key in production

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('auth.dashboard'))
    return render_template('brochure.html') # Redirect to brochure initially


@auth_bp.route('/brochure')
def brochure():
    """عرض البروشور التعريفي للنظام"""
    return render_template('brochure.html')

@auth_bp.route('/dashboard')
@login_required
def dashboard():
    return "Dashboard" # Placeholder


app.register_blueprint(auth_bp)

# Enhanced brochure.html template (Place this in a 'templates' folder)
# <!DOCTYPE html>
# <html>
# <head>
#   <title>Application Brochure</title>
# </head>
# <body>
#   <h1>Welcome to Our Application!</h1>
#   <p>This application offers a range of features to streamline your workflow and improve efficiency.  Learn more below.</p>
#   <h2>Key Features:</h2>
#   <ul>
#     <li>Feature 1: Detailed description of feature 1 and its benefits.</li>
#     <li>Feature 2: Detailed description of feature 2 and its benefits.</li>
#     <li>Feature 3: Detailed description of feature 3 and its benefits.</li>
#   </ul>
#   <p>To get started, <a href="/login">login</a> or <a href="/register">register</a> for an account.</p>
# </body>
# </html>

if __name__ == '__main__':
    app.run(debug=True)