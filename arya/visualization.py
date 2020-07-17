from flask import *
import pygraphviz as pgv

import sys
from os.path import join

from . import app, APP_STATIC

bp = Blueprint('visualization', __name__)

DELIM = app.config['ID_DELIMITER']

# Discover an organizational model with the approach as configured
# Show a discovered organizational model (and a process model if requested)
@bp.route('/visualize_demo')
def visualize_demo():
    fn = join('demo', 'toy_example.om')

    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    with open(join(APP_STATIC, fn), 'r') as f:
        demo_om = OrganizationalModel.from_file_csv(f)

    data_org_model = draw_org_model(demo_om)
    demo_fitness = 1.0
    demo_precision = 0.883
    demo_f1_score= (2 * (demo_fitness * demo_precision) / 
        (demo_fitness + demo_precision))

    return render_template('visualize.html',
        DELIM=DELIM,
        data_org_model=data_org_model,
        fitness_org_model=demo_fitness, 
        precision_org_model=demo_precision, 
        f1_score_org_model=demo_f1_score,
    )


@bp.route('/visualize', methods=['GET'])
def visualize():
    # retrieve organizational model
    fn_om = '{}.om'.format(session['user_id'])
    fp_om = join(app.config['TEMP'], fn_om)
    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    with open(fp_om, 'r') as f:
        om = OrganizationalModel.from_file_csv(f)
    
    # generate visualization data
    data_org_model = draw_org_model(om)

    # calculate global conformance data
    fp_log = join(app.config['TEMP'], session['last_upload_log_filename'])
    from orgminer.ExecutionModeMiner.base import BaseMiner 
    fn_mode_miner = session['last_upload_log_filename'] + '.mode_miner'
    fp_mode_miner = join(app.config['TEMP'], fn_mode_miner)

    with open(fp_log, 'r') as f_log, \
        open(fp_mode_miner, 'r') as f_mode_miner:
        if session['last_upload_log_filetype'] == 'csv':
            from orgminer.IO.reader import read_disco_csv
            el = read_disco_csv(f_log)
        elif session['last_upload_log_filetype'] == 'xes':
            from orgminer.IO.reader import read_xes
            el = read_xes(f_log)
        else:
            pass
        exec_mode_miner = BaseMiner.from_file(f_mode_miner)
        rl = exec_mode_miner.derive_resource_log(el)

    from orgminer.Evaluation.l2m.conformance import fitness, precision
    fitness = fitness(rl, om)
    precision = precision(rl, om)
    f1_score = 2 * (fitness * precision) / (fitness + precision)
    return render_template('visualize.html',
        DELIM=DELIM,
        data_org_model=data_org_model,
        fitness_org_model=fitness, 
        precision_org_model=precision, 
        f1_score_org_model=f1_score,
    )


# Discover a process model correspondingly
@bp.route('/mine_process_model/<case_type>/')
def handler_mine_process_model(case_type):
    case_type = None if case_type == 'None' else case_type
    return discover_draw_process_model(
        join(app.config['TEMP'], session['last_upload_log_filename']),
        session['last_upload_log_filetype'],
        case_type, [])


# Discover a process model correspondingly (with nodes highlighted)
@bp.route('/mine_process_model/<case_type>/<hl_activity_types>')
def handler_mine_process_model_with_highlights(case_type, hl_activity_types):
    case_type = None if case_type == 'None' else case_type
    return discover_draw_process_model(
        join(app.config['TEMP'], session['last_upload_log_filename']),
        session['last_upload_log_filetype'],
        case_type, hl_activity_types.split(','))


'''
Functions
'''
from .utilities import _trim_activity_label_tail

def draw_org_model(om):
    data_dict = dict()
    for og_id, og in om.find_all_groups():
        # groups
        group_node_id = 'group' + DELIM + '{}'.format(og_id)
        data_dict[group_node_id] = {
            '_type': 'node',
            'label': 'Group {}'.format(og_id),
            '_class': 'group'
        }

        # member resources, and connecting edges to groups
        for resource in og:
            resource_node_id = 'resource' + DELIM + '{}'.format(resource)
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
            mode_node_id = 'mode' + DELIM + '({},{},{})'.format(ct, at, tt)
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


def discover_draw_process_model(
    path_server_event_log, 
    filetype_server_event_log,
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
