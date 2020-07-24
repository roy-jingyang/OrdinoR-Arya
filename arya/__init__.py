from flask import Flask
from flask_bootstrap import Bootstrap
from flask_cors import CORS
from flask_session import Session
import os

app = Flask(__name__)

APP_ROOT = os.path.dirname(os.path.abspath(__file__))
APP_STATIC = os.path.join(APP_ROOT, app.static_folder)

def create_app():
    app.debug = True
    app.config['SECRET_KEY'] = 'orgminer-arya'
    app.config['TEMP'] = os.path.join(os.path.dirname(APP_ROOT), '.tmp/')
    app.config['ID_DELIMITER'] = '|::|'

    bootstrap = Bootstrap(app)
    CORS(app)
    app.config['SESSION_TYPE'] = 'filesystem'
    app.config['SESSION_FILE_DIR'] = os.path.join(
        app.config['TEMP'], '.flask_session/'
    )
    Session(app)

    # register blueprints of routes
    from . import index, discovery, visualization
    app.register_blueprint(index.bp)
    app.register_blueprint(discovery.bp)
    app.register_blueprint(visualization.bp)

    return app


# HTTP error page
from flask import render_template
@app.errorhandler(404) 
# inbuilt function which takes error as parameter 
def not_found(e): 
    return render_template("404.html"), 404


@app.errorhandler(500)
def internal_error(e):
    return render_template("500.html"), 500
