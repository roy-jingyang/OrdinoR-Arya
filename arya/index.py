from flask import *
from . import app

bp = Blueprint('index', __name__)

@bp.route('/', methods=['GET'])
def index():
    # TODO: redirecting to discovery before more entries are added
    return redirect(url_for('discovery.index'))
