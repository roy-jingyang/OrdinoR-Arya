from flask import *
app = Flask(__name__)
# NOTE: do NOT leak the secret key of the server!
app.secret_key = b'qut.edu.au_GP-Y606C-23'

# TODO: remove the import by local relative path
# TODO: check all path configuration

import sys
sys.path.append('../OrgMiner/')

from os.path import join
import pygraphviz as pgv

delim = '/::/'

####################### Handlers #######################################
@app.route('/demo')
def handler_view_demo():
    # load data
    dotstr_org_model = build_demo_org_model_dot_string()
    return render_template('visualize.html',
        dotstr_org_model=dotstr_org_model)


@app.route('/', methods=['GET'])
def index():
    return render_template('index.html',
        has_log=False,
        log_info=None)


@app.route('/', methods=['POST'])
def index_loaded():
    # if the post request does not have the file part, or
    if 'file_event_log' not in request.files:
        abort(400) # Bad Request
    else:
        fn = request.files['file_event_log'].filename 
        # if user does not select a file,
        # but the browser submits a null part;
        # or if the file extension is not supported
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
            fn_server = session['user_id']

            request.files['file_event_log'].save(
                join('./arya/tmp/', fn_server))

            # read log and fetch basic info
            with open(join('./arya/tmp/', fn_server)) as f:
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
            return render_template('index.html',
                has_log=True,
                log_info=log_info)


@app.route('/clear_reset', methods=['GET'])
def handler_clear_reset():
    fn_server = session['user_id']
    from os import remove
    remove(join('./arya/tmp/', fn_server))
    return redirect('/')


# Discover an organizational model with the approach as configured
# Show a discovered organizational model (and a process model if requested)
@app.route('/view', methods=['POST'])
def handler_view_results():
    configs = eval(str(request.get_json()))
    om = discover_org_model(
        join('./arya/tmp/', session['user_id']),
        session['last_upload_filetype'],
        configs
    )
    dotstr = build_org_model_dot_string(om)
    return render_template('visualize.html',
        dotstr_org_model=dotstr)


# Discover a process model correspondingly
@app.route('/mine_process_model/<case_type>/')
def handler_mine_process_model(case_type):
    case_type = None if case_type == 'None' else case_type
    return discover_process_model(
        join('./arya/tmp/', session['user_id']),
        session['last_upload_filetype'],
        case_type, [])


# Discover a process model correspondingly (with nodes highlighted)
@app.route('/mine_process_model/<case_type>/<hl_activity_types>')
def handler_mine_process_model_with_highlights(case_type, hl_activity_types):
    case_type = None if case_type == 'None' else case_type
    return discover_process_model(
        join('./arya/tmp/', session['user_id']),
        session['last_upload_filetype'],
        case_type, hl_activity_types.split(','))

####################### Helpers ########################################
def is_uploaded_file_allowed(fn_event_log):
    ALLOWED_EXT = {'csv', 'xes'}
    file_ext = '.' in fn_event_log and fn_event_log.rsplit('.', 1)[1].lower()
    if file_ext in ALLOWED_EXT:
        return file_ext
    else:
        return False


def create_user_id():
    from random import randrange
    return '{:x}'.format(randrange(10**32))[:64]


def _import_block(path_invoke):
    from importlib import import_module
    module = import_module('.'.join(path_invoke.split('.')[:-1]))
    foo = getattr(module, path_invoke.split('.')[-1])
    return foo

####################### Functions ######################################
def discover_org_model(path_server_event_log, filetype_server_event_log, 
    configs):
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
        configs[0]['method']) 
    params = configs[0]['params'] if len(configs[0]['params']) > 0 else None
    if params is None:
        exec_mode_miner = cls_exec_mode_miner(el)
    else:
        exec_mode_miner = cls_exec_mode_miner(el, **params)
    rl = exec_mode_miner.derive_resource_log(el)
    with open(path_server_event_log + '.mode_miner', 'w') as f:
        exec_mode_miner.to_file(f)

    # Phase 2
    from orgminer.ResourceProfiler.raw_profiler import count_execution_frequency
    profiles = count_execution_frequency(rl)

    group_discoverer = _import_block('orgminer.OrganizationalModelMiner.' +
        configs[1]['method'])
    params = configs[1]['params'] if len(configs[1]['params']) > 0 else None
    if params is None:
        ogs = group_discoverer(profiles)
    else:
        ogs = group_discoverer(profiles, **params)

    if type(ogs) is tuple:
        ogs = ogs[0]

    # Phase 3
    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    om = OrganizationalModel()
    mode_assigner = _import_block('orgminer.OrganizationalModelMiner.' +
        'mode_assignment.' + configs[2]['method'])
    params = configs[2]['params'] if len(configs[2]['params']) > 0 else None
    if params is None:
        om = mode_assigner(ogs, rl)
    else:
        om = mode_assigner(ogs, rl, **params)

    return om


def build_org_model_dot_string(om):
    graph = pgv.AGraph(strict=True, directed=True)

    for og_id, og in om.find_all_groups():
        # groups
        group_node_id = 'group' + delim + '{}'.format(og_id)
        graph.add_node(group_node_id, 
            label='Group {}'.format(og_id),
            _class='group', _type='node')

        # member resources, and connecting edges to groups
        for resource in og:
            resource_node_id = 'resource' + delim + '{}'.format(resource)
            graph.add_node(resource_node_id,
                label='{}'.format(resource),
                _class='resource', _type='node')
            graph.add_edge(
                group_node_id,
                resource_node_id,
                _class='group-resource', _type='edge',
                #contribution='{:.0%}'.format(
                #    member_load_distribution[og_id][resource])
                )

        # capable execution modes, and connecting edges to groups
        exec_modes = om.find_group_execution_modes(og_id)
        for em in exec_modes:
            ct, at, tt = em[0], em[1], em[2]
            mode_node_id = 'mode' + delim + '({},{},{})'.format(ct, at, tt)
            graph.add_node(mode_node_id,
                label='{}, {}, {}'.format(em[0], em[1], em[2]),
                _class='mode', _type='node')
            graph.add_edge(
                group_node_id,
                mode_node_id,
                _class='group-mode', _type='edge')

    return graph.string()


def build_demo_org_model_dot_string():
    fn = './arya/static/demo/toy_example.om'
    #fn = './arya/static/demo/toy_example_overlapped.om'
    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    with open(fn, 'r') as f:
        demo_om = OrganizationalModel.from_file_csv(f)
    
    return build_org_model_dot_string(demo_om)


def discover_process_model(path_server_event_log, filetype_server_event_log,
    case_type=None, hl_activity_types=None):
    with open(path_server_event_log, 'r') as f:
        if filetype_server_event_log == 'csv':
            # TODO: handle process model discovery for CSV inputs
            return None
        elif filetype_server_event_log == 'xes':
            from orgminer.IO.reader import read_xes
            el = read_xes(f)
            from pm4py.objects.log.importer.xes import factory
            pm4py_log = factory.apply(path_server_event_log)
        else:
            pass

    from orgminer.ExecutionModeMiner.base import BaseMiner
    with open(path_server_event_log + '.mode_miner', 'r') as f:
        mode_miner = BaseMiner.from_file(f) 

    print(type(mode_miner))
    sel_cases = mode_miner.get_values_by_type(case_type) \
        if case_type is not None else set(el['case_id'])
    # NOTE: CSV only - trim the additional markings appended by Disco
    '''
    sel_activity_types = [_trim_activity_label_tail(x, r'-complete')
        for x in hl_activity_types]
    '''
    sel_activity_types = hl_activity_types

    # filter event log
    from pm4py.objects.log.log import EventLog, Trace
    pm4py_log_filtered = EventLog()
    for trace in pm4py_log:
        if trace.attributes['concept:name'] in sel_cases:
            pm4py_log_filtered.append(trace)

    from pm4py.algo.discovery.dfg import factory as dfg_miner
    dfg = dfg_miner.apply(pm4py_log_filtered)
    from pm4py.visualization.dfg import factory as dfg_vis_factory
    gviz = dfg_vis_factory.apply(dfg, log=pm4py_log_filtered, 
        variant="frequency")

    import pygraphviz as pgv
    graph = pgv.AGraph(gviz.source)
    for node in graph.nodes_iter():
        if node.attr['shape'] == 'box' and node.attr['label'] != '':
            # trim the count in the labels from DFG
            node.attr['label'] = _trim_activity_label_tail(
                node.attr['label'], r' \(\d+\)')
            node.attr['fontname'] = 'Helvetica'
            if ('AT.' + node.attr['label']) in sel_activity_types:
                # highlight
                node.attr['style'] = 'bold'
                node.attr['fontcolor'] = 'red3'
            else:
                node.attr['style'] = 'filled'
                node.attr['fillcolor'] = 'gainsboro'

    return graph.string()


def _trim_activity_label_tail(s, patt):
    from re import search as regex_search
    match = regex_search(patt, s)
    return s[:match.start()]

