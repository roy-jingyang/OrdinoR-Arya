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
@app.route('/index')
def index():
    return render_template('index2.html',
        has_log=False,
        log_info=None)


@app.route('/upload_event_log', methods=['POST'])
def import_event_log():
    if request.method == 'POST':
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
                session['upload_time'] = time()
                fn_id = str(session['upload_time']).replace('.', '-')

                request.files['file_event_log'].save(join(
                    './arya/tmp/', 
                    fn + '.' + fn_id
                ))

                # read log and fetch basic info
                if is_uploaded_file_allowed(fn) == 'csv':
                    from orgminer.IO.reader import read_disco_csv
                    with open(join('./arya/tmp/', fn + '.' + fn_id)) as f:
                        el = read_disco_csv(f)
                elif is_uploaded_file_allowed(fn) == 'xes':
                    pass
                else:
                    pass
                    
                log_info = {
                    'filename': fn,
                    #'fileid': fn_id,
                    'num_events': len(el),
                    'num_cases': len(set(el['case_id'])),
                    'num_activities': len(set(el['activity'])),
                    'num_resources': len(set(el['resource']))
                }
                return render_template('index2.html',
                    has_log=True,
                    log_info=log_info)

    abort(405) # Method Not Allowed


# Discover an organizational model with the approach as configured
@app.route('/mine_org_model', methods=['POST'])
def get_org_model():
    pass


# Show a discovered organizational model (and a process model if requested)
#@app.route('/view')
@app.route('/')
def view_results():
    # load data
    dotstr_org_model = build_dot_strings_om()
    return render_template('index.html',
        dotstr_org_model=dotstr_org_model)


# Discover a process model correspondingly
@app.route('/mine_process_model/<case_type>/')
def get_process_model(case_type):
    return discover_process_model(case_type, [])


# Discover a process model correspondingly (with nodes highlighted)
@app.route('/mine_process_model/<case_type>/<hl_activity_types>')
def get_process_model_with_highlights(case_type, hl_activity_types):
    return discover_process_model(case_type, hl_activity_types.split(','))

####################### Helpers ########################################
def is_uploaded_file_allowed(fn_event_log):
    ALLOWED_EXT = {'csv', 'xes'}
    file_ext = '.' in fn_event_log and fn_event_log.rsplit('.', 1)[1].lower()
    if file_ext in ALLOWED_EXT:
        return file_ext
    else:
        return False

####################### Functions ######################################
def build_dot_strings_om():
    # TODO: hard-coded file for debugging
    #fn = './arya/static/demo/wabo_fullTC-MOC-CF.om' #TODO: tricky overlaps!

    fn = './arya/static/demo/toy_example.om'
    #fn = './arya/static/demo/models/wabo_best.om'
    #fn = './arya/static/demo/models/bpic17_best.om'

    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    with open(fn, 'r') as f:
        om = OrganizationalModel.from_file_csv(f)

    '''
    fn_log = './arya/static/demo/logs/wabo.csv'
    #fn_log = './arya/static/demo/logs/bpic17.csv'

    # TODO: calculate the diagnostic measures
    from orgminer.IO.reader import read_disco_csv
    with open(fn_log, 'r') as f:
        el = read_disco_csv(f, mapping={'(case) channel': 6})

    # TODO: convert to resource log
    from orgminer.ExecutionModeMiner.direct_groupby import FullMiner
    from orgminer.ExecutionModeMiner.informed_groupby import TraceClusteringFullMiner

    #mode_miner = FullMiner(el, 
    #    case_attr_name='(case) channel', resolution='weekday')
    mode_miner = TraceClusteringFullMiner(el,
        fn_partition='./arya/static/demo/extra_knowledge/wabo.bosek5.tcreport', 
        #fn_partition='./arya/static/demo/extra_knowledge/bpic17.bosek5.tcreport', 
        resolution='weekday')

    rl = mode_miner.derive_resource_log(el)

    from orgminer.Evaluation.l2m.diagnostics import test_measure
    member_load_distribution = test_measure(rl, om) 
    '''

    # construct organizational model DOT string
    graph = pgv.AGraph(strict=True, directed=True)

    # TODO: debug use, show only part of the model
    N_groups = 3
    N_modes = 3
    i = 0

    for og_id, og in om.find_all_groups():
        if i < N_groups:
            pass
        else:
            break

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
        exec_modes = om.find_group_execution_modes(og_id)[:] # TODO
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

        #i += 1 # TODO

    return graph.string()


#def discover_process_model(el, case_type=None, time_type=None):
def discover_process_model(case_type=None, hl_activity_types=None):
    # TODO: hard-coded file for debugging
    fn_log = './arya/static/demo/logs/wabo.csv'
    fn_log_xes = './arya/static/demo/logs/wabo.xes'
    #fn_log = './arya/static/demo/logs/bpic17.csv'
    #fn_log_xes = './arya/static/demo/logs/bpic17.xes'

    from pm4py.objects.log.importer.xes import factory as xes_import_factory
    log = xes_import_factory.apply(fn_log_xes)

    from orgminer.IO.reader import read_disco_csv
    with open(fn_log, 'r') as f:
        el = read_disco_csv(f, mapping={'(case) channel': 6})

    from orgminer.ExecutionModeMiner.direct_groupby import FullMiner
    from orgminer.ExecutionModeMiner.informed_groupby import TraceClusteringFullMiner

    #mode_miner = FullMiner(el, 
    #    case_attr_name='(case) channel', resolution='weekday')
    mode_miner = TraceClusteringFullMiner(el,
        fn_partition='./arya/static/demo/extra_knowledge/wabo.bosek5.tcreport', 
        #fn_partition='./arya/static/demo/extra_knowledge/bpic17.bosek5.tcreport', 
        resolution='weekday')

    sel_cases = mode_miner.get_values_by_type(case_type)
    # trim the additional markings appended by Disco
    sel_activity_types = [_trim_activity_label_tail(x, r'-complete')
        for x in hl_activity_types]

    # filter event log
    from pm4py.objects.log.log import EventLog, Trace
    filtered_log = EventLog()
    for trace in log:
        if trace.attributes['concept:name'] in sel_cases:
            filtered_log.append(trace)

    from pm4py.algo.discovery.dfg import factory as dfg_miner
    dfg = dfg_miner.apply(filtered_log)
    from pm4py.visualization.dfg import factory as dfg_vis_factory
    gviz = dfg_vis_factory.apply(dfg, log=filtered_log, variant="frequency")

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

