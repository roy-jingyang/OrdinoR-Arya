from flask import *
from os.path import join

from . import app

bp = Blueprint('discovery', __name__)

'''Request handlers
'''

@bp.route('/discover', methods=['GET'])
def index():
    # TODO: redirecting to org. model discovery before more entries are added
    return redirect(url_for('.index_discover_org_model'))


@bp.route('/discover_org_model', methods=['GET', 'POST'])
def index_discover_org_model():
    from .forms import LogUploadForm
    log_upload_form = LogUploadForm()

    if request.method == 'GET':
        if 'event_log' in session \
            and 'last_upload_event_log_name' in session:
            el = session['event_log']
        else:
            from .index import clear_session_data
            clear_session_data()

            return render_template('discovery.html',
                has_log=False,
                log_info=None,
                log_upload_form=LogUploadForm(),
                discovery_config_form=None
            )
    elif request.method == 'POST':
        if log_upload_form.validate_on_submit():
            from werkzeug.utils import secure_filename
            fn_client = secure_filename(log_upload_form.f_log.data.filename)
            session['last_upload_event_log_name'] = fn_client
            from .utilities import get_file_extension
            file_ext = get_file_extension(fn_client)

            fn_server = '{}.log.{}'.format(session.sid, file_ext)
            log_upload_form.f_log.data.save(
                join(app.config['TEMP'], fn_server)
            )

            # read log and fetch basic info
            with open(join(app.config['TEMP'], fn_server), 'r') as f:
                session['last_upload_event_log_filename'] = fn_server
                if file_ext == 'csv':
                    session['last_upload_event_log_filetype'] = 'csv'
                    from orgminer.IO.reader import read_disco_csv
                    el = read_disco_csv(f)
                elif file_ext == 'xes':
                    session['last_upload_event_log_filetype'] = 'xes'
                    from orgminer.IO.reader import read_xes
                    el = read_xes(f)
                else:
                    raise TypeError('Invalid event log filetype')
            session['event_log'] = el
        else:
            print(log_upload_form.errors)
            flash(log_upload_form.errors['f_log'].pop(), 
                category='warning')
            return redirect(url_for('.index_discover_org_model'))
    else:
        abort(405)
                
    log_info = {
        'filename': session['last_upload_event_log_name'],
        'num_events': len(el),
        'num_cases': len(set(el['case_id'])),
        'num_activities': len(set(el['activity'])),
        'num_resources': len(set(el['resource'])),
        'attributes': el.columns
    }

    if request.method == 'POST':
        flash('Successfully uploaded event log file ' + 
            '<mark>{}</mark>'.format(log_info['filename']),
            category='success')

    from .forms import DiscoveryConfigForm
    config_form = DiscoveryConfigForm.Form()
    config_form.param_FullMiner_case_attr_name.choices = [
        (attr, attr) for attr in log_info['attributes']
    ]

    from wtforms.validators import NumberRange
    config_form.param_n_groups.validators.append(
        NumberRange(2, log_info['num_resources'])
    )

    return render_template('discovery.html',
        has_log=True,
        log_info=log_info,
        log_upload_form=None,
        discovery_config_form=config_form
    )


@bp.route('/submit_discover_org_model', methods=['POST'])
def discover_org_model():
    from .forms import DiscoveryConfigForm
    config_form = DiscoveryConfigForm.Form()
    # disable the choice validation due to it being a dynamic list
    config_form.param_FullMiner_case_attr_name.validate_choice=False

    if config_form.validate_on_submit():
        fp_log = join(app.config['TEMP'], 
            session['last_upload_event_log_filename'])
        om, exec_mode_miner = _discover_org_model(
            fp_log,
            session['last_upload_event_log_filetype'],
            DiscoveryConfigForm.parse_form(config_form)
        )

        fn_server_om = '{}.om'.format(session.sid)
        fp_server_om = join(app.config['TEMP'], fn_server_om)
        with open(fp_server_om, 'w+') as fout:
            om.to_file_csv(fout) 

        session['exec_mode_miner'] = exec_mode_miner
        session['org_model'] = om

        return redirect(url_for('visualization.visualize'))
    else:
        flash(config_form.errors, category='warning')
        return redirect(url_for('.index_discover_org_model'))
    

@bp.route('/reset', methods=['GET'])
def reset():
    from .index import clear_session_data
    clear_session_data()
    return redirect(url_for('.index_discover_org_model'))


'''Functions
'''
from .utilities import _import_block
DELIM = app.config['ID_DELIMITER']

def _discover_org_model(
    path_server_event_log, filetype_server_event_log, configs):
    with open(path_server_event_log, 'r') as f:
        if filetype_server_event_log == 'csv':
            from orgminer.IO.reader import read_disco_csv
            el = read_disco_csv(f)
        elif filetype_server_event_log == 'xes':
            from orgminer.IO.reader import read_xes
            el = read_xes(f)
        else:
            pass

    # Phase 1
    cls_exec_mode_miner = _import_block('orgminer.ExecutionModeMiner.' +
        configs['learn_exec_modes']['method']) 
    params = configs['learn_exec_modes']['params'] \
        if len(configs['learn_exec_modes']['params']) > 0 else None
    if params is None:
        exec_mode_miner = cls_exec_mode_miner(el)
    else:
        exec_mode_miner = cls_exec_mode_miner(el, **params)
    rl = exec_mode_miner.derive_resource_log(el)

    # Phase 2
    from orgminer.ResourceProfiler.raw_profiler import count_execution_frequency
    profiles = count_execution_frequency(rl)

    group_discoverer = _import_block(
        'orgminer.OrganizationalModelMiner.' 
        + configs['discover_res_groupings']['method'])
    params = configs['discover_res_groupings']['params'] \
        if len(configs['discover_res_groupings']['params']) > 0 else None
    if params is None:
        ogs = group_discoverer(profiles)
    else:
        ogs = group_discoverer(profiles, **params)

    if type(ogs) is tuple:
        ogs = ogs[0]

    # Phase 3
    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    om = OrganizationalModel()
    mode_assigner = _import_block(
        'orgminer.OrganizationalModelMiner.mode_assignment.' +
        configs['assign_exec_modes']['method'])
    params = configs['assign_exec_modes']['params'] \
        if len(configs['assign_exec_modes']['params']) > 0 else None
    if params is None:
        om = mode_assigner(ogs, rl)
    else:
        om = mode_assigner(ogs, rl, **params)

    return om, exec_mode_miner
