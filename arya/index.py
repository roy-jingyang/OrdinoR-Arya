from flask import *
from os.path import join

from . import app

bp = Blueprint('index', __name__)

@bp.route('/', methods=['GET'])
def index():
    # Default: the session will be deleted when the browser closes
    if app.demo:
        return redirect(url_for('visualization.visualize_demo'))
    else:
        # TODO: redirecting to discovery before more entries are added
        return redirect(url_for('discovery.index'))

'''Functions
'''
def clear_session_data():
    from os import walk, remove
    from os.path import isfile
    import re
    l_data_files_rm = list()
    patt = re.compile(session.sid[:32])
    for root, dirs, files in walk(app.config['TEMP']):
        l_data_files_rm.extend([
            join(app.config['TEMP'], fn) for fn in files if patt.match(fn)
        ])
    for fp in l_data_files_rm:
        if isfile(fp):
            remove(fp)

    if 'last_upload_event_log_name' in session:
        del session['last_upload_event_log_name']
    if 'last_upload_event_log_filename' in session:
        del session['last_upload_event_log_filename']
    if 'last_upload_event_log_filetype' in session:
        del session['last_upload_event_log_filetype']

    if 'event_log' in session:
        del session['event_log']
    if 'exec_mode_miner' in session:
        del session['exec_mode_miner']
    if 'org_model' in session:
        del session['org_model']
