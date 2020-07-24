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
    from .index import clear_session_data
    clear_session_data()

    fn_demo_log = join('demo', 'toy_example.xes')
    fn_demo_om = join('demo', 'toy_example.om')

    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    with open(join(APP_STATIC, fn_demo_log), 'r') as f_log, \
        open(join(APP_STATIC, fn_demo_om), 'r') as f_om:
        from orgminer.IO.reader import read_xes
        session['event_log'] = read_xes(f_log)
        session['org_model'] = OrganizationalModel.from_file_csv(f_om)

    data_org_model = _draw_org_model(session['org_model'])

    # Hard coding the toy execution mode mining results
    from orgminer.ExecutionModeMiner.base import BaseMiner
    exec_mode_miner = BaseMiner(session['event_log'])
    exec_mode_miner._ctypes['654423'] = 'normal'
    exec_mode_miner._ctypes['654424'] = 'normal'
    exec_mode_miner._ctypes['654425'] = 'VIP'

    exec_mode_miner._atypes['register request'] = 'register'
    exec_mode_miner._atypes['confirm request'] = 'register'
    exec_mode_miner._atypes['get missing info'] = 'contact'
    exec_mode_miner._atypes['pay claim'] = 'contact'
    exec_mode_miner._atypes['check insurance'] = 'check'
    exec_mode_miner._atypes['accept claim'] = 'decide'
    exec_mode_miner._atypes['reject claim'] = 'decide'

    exec_mode_miner._ttypes['2018/08/29 15:02:00.000000'] = 'afternoon' 
    exec_mode_miner._ttypes['2018/08/29 16:28:00.000000'] = 'afternoon'
    exec_mode_miner._ttypes['2018/08/29 16:45:00.000000'] = 'afternoon'
    exec_mode_miner._ttypes['2018/08/30 09:09:00.000000'] = 'morning'
    exec_mode_miner._ttypes['2018/08/30 11:32:00.000000'] = 'morning'
    exec_mode_miner._ttypes['2018/08/30 11:48:00.000000'] = 'morning'
    exec_mode_miner._ttypes['2018/08/29 16:08:00.000000'] = 'afternoon'
    exec_mode_miner._ttypes['2018/08/29 16:12:00.000000'] = 'afternoon'
    exec_mode_miner._ttypes['2018/08/30 09:22:00.000000'] = 'morning'
    exec_mode_miner._ttypes['2018/08/30 11:45:00.000000'] = 'morning'
    exec_mode_miner._ttypes['2018/08/30 10:07:00.000000'] = 'morning'
    exec_mode_miner._ttypes['2018/08/30 12:44:00.000000'] = 'afternoon'
    exec_mode_miner._ttypes['2018/08/30 13:32:00.000000'] = 'afternoon'
    exec_mode_miner._ttypes['2018/08/30 14:09:00.000000'] = 'afternoon'
    exec_mode_miner._ttypes['2018/08/30 14:14:00.000000'] = 'afternoon'

    session['exec_mode_miner'] = exec_mode_miner

    return redirect(url_for('.visualize'))


@bp.route('/visualize', methods=['GET'])
def visualize():
    # retrieve organizational model
    om = session['org_model']
    
    # generate visualization data
    data_org_model = _draw_org_model(om)

    # calculate global conformance data
    el = session['event_log']
    exec_mode_miner = session['exec_mode_miner']
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


# visualize a corresponding process model
@bp.route('/view_process_model', methods=['POST'])
def discover_process_model():
    data = request.get_json()
    case_type = None if data['case_type'] == '' else data['case_type']
    activity_types = [] if data['activity_types'] == '' \
        else data['activity_types'].split(',')

    return _discover_draw_process_model(
        join(app.config['TEMP'], session['last_upload_event_log_filename']),
        session['last_upload_event_log_filetype'],
        session['exec_mode_miner'],
        case_type, activity_types
    )


@bp.route('/query_group_event_number', methods=['POST'])
def query_group_event_number():
    group_id = int(request.get_json()['group_id'])
    el = session['event_log']
    exec_mode_miner = session['exec_mode_miner']
    rl = exec_mode_miner.derive_resource_log(el)

    om = session['org_model']
    group = om.find_group_members(group_id)

    group_event_number = len(rl.loc[rl['resource'].isin(group)])
    return str(group_event_number)


@bp.route('/query_mode_event_number', methods=['POST'])
def query_mode_event_number():
    req_params = request.get_json()
    ct = req_params.get('case_type', None)
    at = req_params.get('activity_type', None)
    tt = req_params.get('time_type', None)
    mode = tuple((ct, at, tt))
    group_id = req_params.get('group_id', None)
    group_id = int(group_id) if group_id is not None else None

    el = session['event_log']
    exec_mode_miner = session['exec_mode_miner']
    rl = exec_mode_miner.derive_resource_log(el)

    resp = dict()
    resp['mode_event_number'] = len(rl.groupby([
        'case_type', 'activity_type', 'time_type']).get_group(mode))

    if group_id is not None:
        om = session['org_model']
        group = om.find_group_members(group_id)
        if mode in om.find_group_execution_modes(group_id):
            rl = rl.loc[rl['resource'].isin(group)]
            resp['mode_group_event_number'] = len(rl.groupby([
                'case_type', 'activity_type', 'time_type']).get_group(mode))

    return json.jsonify(resp)


@bp.route('/query_local_diagnostic_measures', methods=['POST'])
def query_local_diagnostic_measures():
    req_params = request.get_json()

    group_id = req_params.get('group_id', None)
    group_id = int(group_id) if group_id is not None else None

    if group_id is not None:
        ct = req_params.get('case_type', None)
        at = req_params.get('activity_type', None)
        tt = req_params.get('time_type', None)
        mode = tuple((ct, at, tt))

        el = session['event_log']
        exec_mode_miner = session['exec_mode_miner']
        rl = exec_mode_miner.derive_resource_log(el)

        om = session['org_model']
        group = om.find_group_members(group_id)

        if mode in om.find_group_execution_modes(group_id):
            from orgminer.Evaluation.l2m.diagnostics import (
                group_relative_focus, group_relative_stake, 
                group_coverage, group_member_contribution
            )
                
            return json.jsonify({
                'group_relative_focus': \
                    group_relative_focus(group, mode, rl),
                'group_relative_stake': \
                    group_relative_stake(group, mode, rl),
                'group_coverage': \
                    group_coverage(group, mode, rl),
                'group_member_contribution': \
                    group_member_contribution(group, mode, rl)
            })

    return Response(status=204)


'''
Functions
'''
from .utilities import _trim_activity_label_tail

def _draw_org_model(om):
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


def _discover_draw_process_model(
    path_server_event_log, 
    filetype_server_event_log,
    exec_mode_miner,
    case_type, hl_activity_types):
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
            raise TypeError('Invalid event log filetype')

    sel_cases = exec_mode_miner.get_values_by_type(case_type) \
        if case_type != '' else set(el['case_id'])

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
        variant='frequency', 
        parameters={'maxNoOfEdgesInDiagram': 30}
    )

    graph = pgv.AGraph(gviz.source)
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

