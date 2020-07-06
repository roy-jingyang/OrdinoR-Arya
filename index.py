from flask import *
import pygraphviz as pgv

import sys
from os.path import join

from . import app

bp = Blueprint('index', __name__)

@bp.route('/', methods=['GET'])
def index():
    return render_template('discovery.html',
        has_log=False,
        log_info=None)


@bp.route('/', methods=['POST'])
def index_loaded():
    # if the post request does not have the file part, or
    if 'file_event_log' not in request.files:
        abort(400) # Bad Request
    else:
        fn = request.files['file_event_log'].filename 
        # if user does not select a file,
        # but the browser submits a null part;
        # or if the file extension is not supported
        from .utilities import is_uploaded_file_allowed
        from .utilities import create_user_id
        if fn == '' or is_uploaded_file_allowed(fn) is False:
            abort(400) # Bad Request
        else:
            from werkzeug.utils import secure_filename
            fn = secure_filename(fn)
            from time import time
            if 'user_id' in session:
                pass
            else:
                session['user_id'] = create_user_id()

            session['last_upload_time'] = time()
            fp_server = join(app.config['UPLOAD_FOLDER'], 
                session['user_id'])

            with open(fp_server, 'w+') as f:
                request.files['file_event_log'].save(fp_server)

            # read log and fetch basic info
            with open(fp_server, 'r') as f:
                if is_uploaded_file_allowed(fn) == 'csv':
                    session['last_upload_filetype'] = 'csv'
                    from orgminer.IO.reader import read_disco_csv
                    el = read_disco_csv(f)
                elif is_uploaded_file_allowed(fn) == 'xes':
                    session['last_upload_filetype'] = 'xes'
                    from orgminer.IO.reader import read_xes
                    el = read_xes(f)
                else:
                    pass
                
            log_info = {
                'filename': fn,
                'num_events': len(el),
                'num_cases': len(set(el['case_id'])),
                'num_activities': len(set(el['activity'])),
                'num_resources': len(set(el['resource'])),
                'attributes': el.columns
            }
            return render_template('discovery.html',
                has_log=True,
                log_info=log_info)


@bp.route('/reset', methods=['GET'])
def reset():
    from os import remove
    remove(join(app.config['UPLOAD_FOLDER'], session['user_id']))
    return redirect(url_for('config.index'))
