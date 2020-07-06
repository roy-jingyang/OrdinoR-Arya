from flask import *
import pygraphviz as pgv

import sys
from os.path import join

from . import app

bp = Blueprint('main', __name__)

# Discover an organizational model with the approach as configured
# Show a discovered organizational model (and a process model if requested)
@bp.route('/demo')
def handler_view_demo():
    fn = 'demo/toy_example.om'
    #fn = 'demo/toy_example_overlapped.om'

    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    with open(url_for('static', ), 'r') as f:
        demo_om = OrganizationalModel.from_file_csv(f)

    data_org_model = build_org_model_data(demo_om)

    return render_template('visualize.html',
        data_org_model=data_org_model)


@bp.route('/view', methods=['POST'])
def handler_view_results():
    configs = eval(str(request.get_json()))
    om = discover_org_model(
        join(app.config['UPLOAD_FOLDER'], session['user_id']),
        session['last_upload_filetype'],
        configs
    )
    data_org_model = build_org_model_data(om)
    return render_template('visualize.html',
        data_org_model=data_org_model)


# Discover a process model correspondingly
@bp.route('/mine_process_model/<case_type>/')
def handler_mine_process_model(case_type):
    case_type = None if case_type == 'None' else case_type
    return discover_process_model(
        join(app.config['UPLOAD_FOLDER'], session['user_id']),
        session['last_upload_filetype'],
        case_type, [])


# Discover a process model correspondingly (with nodes highlighted)
@bp.route('/mine_process_model/<case_type>/<hl_activity_types>')
def handler_mine_process_model_with_highlights(case_type, hl_activity_types):
    case_type = None if case_type == 'None' else case_type
    return discover_process_model(
        join(app.config['UPLOAD_FOLDER'], session['user_id']),
        session['last_upload_filetype'],
        case_type, hl_activity_types.split(','))


'''
Functions
'''
from .utilities import _import_block
from .utilities import _trim_activity_label_tail

delim = '/::/'

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


def build_org_model_data(om):
    data_dict = dict()
    for og_id, og in om.find_all_groups():
        # groups
        group_node_id = 'group' + delim + '{}'.format(og_id)
        data_dict[group_node_id] = {
            '_type': 'node',
            'label': 'Group {}'.format(og_id),
            '_class': 'group'
        }

        # member resources, and connecting edges to groups
        for resource in og:
            resource_node_id = 'resource' + delim + '{}'.format(resource)
            data_dict[resource_node_id] = {
                '_type': 'node',
                'label': '{}'.format(resource),
                '_class': 'resource'
            }
            data_dict[group_node_id + ' -> ' + resource_node_id] = {
                '_type': 'edge',
                'source': group_node_id,
                'target': resource_node_id,
                '_class': 'group-resource'
            }

        # capable execution modes, and connecting edges to groups
        exec_modes = om.find_group_execution_modes(og_id)
        for em in exec_modes:
            ct, at, tt = em[0], em[1], em[2]
            mode_node_id = 'mode' + delim + '({},{},{})'.format(ct, at, tt)
            data_dict[mode_node_id] = {
                '_type': 'node',
                'label': '{}, {}, {}'.format(em[0], em[1], em[2]),
                '_class': 'mode'
            }
            data_dict[group_node_id + ' -> ' + mode_node_id] = {
                '_type': 'edge',
                '_class': 'group-mode'
            }

    from json import dumps
    return dumps(data_dict)


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
        variant="frequency", 
        parameters={'maxNoOfEdgesInDiagram': 30}
    )
    print(gviz.source)
    print('=' * 80)

    graph = pgv.AGraph(gviz.source)
    print(graph)
    for node in graph.nodes():
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
