from flask import *

import sys
from os.path import join

from pandas import Timestamp as dt

from ordinor.constants import (
    CASE_ID, ACTIVITY, TIMESTAMP, RESOURCE,
    CASE_TYPE, ACTIVITY_TYPE, TIME_TYPE
)

from . import app, APP_STATIC

bp = Blueprint('visualization', __name__)

DELIM = app.config['ID_DELIMITER']

# Discover an organizational model with the approach as configured
# Show a discovered organizational model (and a process model if requested)
@bp.route('/visualize_demo')
def visualize_demo():
    from .index import clear_session_data
    clear_session_data()

    session['demo'] = True
    fn_demo_log = 'toy_example.xes'
    session['last_upload_event_log_filename'] = fn_demo_log
    session['last_upload_event_log_filetype'] = 'xes'

    # shorthands (they are filepaths rather)
    fn_demo_log = join('demo', 'toy_example.xes')
    fn_demo_om = join('demo', 'toy_example.om')

    # make a copy of the demo log file
    from shutil import copyfile
    copyfile(
        join(APP_STATIC, fn_demo_log), 
        join(app.config['TEMP'], '{}.log.xes'.format(session.sid[:32]))
    )

    from ordinor.io import read_xes
    session['event_log'] = read_xes(join(APP_STATIC, fn_demo_log))
    from ordinor.org_model_miner import OrganizationalModel
    with open(join(APP_STATIC, fn_demo_om), 'r') as f_om:
        session['org_model'] = OrganizationalModel.from_file_csv(f_om)

    data_org_model = _draw_org_model(session['org_model'])

    # Hard coding the toy execution contexts
    from ordinor.execution_context.base import BaseMiner
    ec_miner = BaseMiner(session['event_log'])

    ec_miner._ctypes['654423'] = 'CT.normal'
    ec_miner._ctypes['654424'] = 'CT.normal'
    ec_miner._ctypes['654425'] = 'CT.VIP'

    ec_miner._atypes['register request'] = 'AT.register'
    ec_miner._atypes['confirm request'] = 'AT.register'
    ec_miner._atypes['get missing info'] = 'AT.contact'
    ec_miner._atypes['pay claim'] = 'AT.contact'
    ec_miner._atypes['check insurance'] = 'AT.check'
    ec_miner._atypes['accept claim'] = 'AT.decide'
    ec_miner._atypes['reject claim'] = 'AT.decide'

    ec_miner._ttypes[dt('2018-08-29 15:02:00+10:00')] = 'TT.afternoon' 
    ec_miner._ttypes[dt('2018-08-29 16:28:00+10:00')] = 'TT.afternoon'
    ec_miner._ttypes[dt('2018-08-29 16:45:00+10:00')] = 'TT.afternoon'
    ec_miner._ttypes[dt('2018-08-30 09:09:00+10:00')] = 'TT.morning'
    ec_miner._ttypes[dt('2018-08-30 11:32:00+10:00')] = 'TT.morning'
    ec_miner._ttypes[dt('2018-08-30 11:48:00+10:00')] = 'TT.morning'
    ec_miner._ttypes[dt('2018-08-29 16:08:00+10:00')] = 'TT.afternoon'
    ec_miner._ttypes[dt('2018-08-29 16:12:00+10:00')] = 'TT.afternoon'
    ec_miner._ttypes[dt('2018-08-30 09:22:00+10:00')] = 'TT.morning'
    ec_miner._ttypes[dt('2018-08-30 11:45:00+10:00')] = 'TT.morning'
    ec_miner._ttypes[dt('2018-08-30 10:07:00+10:00')] = 'TT.morning'
    ec_miner._ttypes[dt('2018-08-30 12:44:00+10:00')] = 'TT.afternoon'
    ec_miner._ttypes[dt('2018-08-30 13:32:00+10:00')] = 'TT.afternoon'
    ec_miner._ttypes[dt('2018-08-30 14:09:00+10:00')] = 'TT.afternoon'
    ec_miner._ttypes[dt('2018-08-30 14:14:00+10:00')] = 'TT.afternoon'

    session['ec_miner'] = ec_miner

    return redirect(url_for('.visualize'))


@bp.route('/visualize', methods=['GET'])
def visualize():
    # retrieve organizational model
    om = session['org_model']
    
    # generate visualization data
    data_org_model = _draw_org_model(om)

    # calculate global conformance data
    el = session['event_log']

    print(el)
    for ts in el['time:timestamp']:
        print(type(ts))
    ec_miner = session['ec_miner']
    rl = ec_miner.derive_resource_log(el)
    print(rl)

    from ordinor.conformance import fitness, precision
    fitness = fitness(rl, om)
    precision = precision(rl, om)
    f1_score = 2 * (fitness * precision) / (fitness + precision)
    return render_template('panel/visualize.html',
        DELIM=DELIM,
        data_org_model=data_org_model,
        fitness_org_model=fitness, 
        precision_org_model=precision, 
        f1_score_org_model=f1_score,
    )


# visualize a corresponding process model
@bp.route('/visualize_process_model', methods=['POST'])
def discover_process_model():
    req_params = request.get_json()
    case_type = None if req_params['case_type'] == '' \
        else req_params['case_type']
    activity_types = [] if req_params['activity_types'] == '' \
        else req_params['activity_types'].split(',')
    time_type = None if req_params['time_type'] == '' \
        else req_params['time_type']
    
    dotsrc_proc_model, hl_activities = _discover_draw_process_model(
        case_type, activity_types, time_type
    )

    resp = dict()
    resp['dotsrc'] = dotsrc_proc_model
    resp['hl_activities'] = hl_activities

    return json.jsonify(resp)


@bp.route('/query_group_event_number', methods=['POST'])
def query_group_event_number():
    group_id = int(request.get_json()['group_id'])
    el = session['event_log']
    ec_miner = session['ec_miner']
    rl = ec_miner.derive_resource_log(el)

    om = session['org_model']
    group = om.find_group_members(group_id)

    group_event_number = len(rl.loc[rl[RESOURCE].isin(group)])
    return str(group_event_number)


@bp.route('/query_ctx_event_number', methods=['POST'])
def query_ctx_event_number():
    req_params = request.get_json()
    ct = req_params.get('case_type', None)
    at = req_params.get('activity_type', None)
    tt = req_params.get('time_type', None)
    ctx = tuple((ct, at, tt))
    group_id = req_params.get('group_id', None)
    group_id = int(group_id) if group_id is not None else None

    el = session['event_log']
    ec_miner = session['ec_miner']
    rl = ec_miner.derive_resource_log(el)

    resp = dict()
    resp['ctx_event_number'] = len(rl.groupby([
        CASE_TYPE, ACTIVITY_TYPE, TIME_TYPE]).get_group(ctx))

    if group_id is not None:
        om = session['org_model']
        group = om.find_group_members(group_id)
        if ctx in om.find_group_execution_contexts(group_id):
            rl = rl.loc[rl[RESOURCE].isin(group)]
            resp['ctx_group_event_number'] = len(rl.groupby([
                CASE_TYPE, ACTIVITY_TYPE, TIME_TYPE]).get_group(ctx))

    return json.jsonify(resp)


@bp.route('/query_model_analysis_measures', methods=['POST'])
def query_model_analysis_measures():
    req_params = request.get_json()

    group_id = req_params.get('group_id', None)
    group_id = int(group_id) if group_id is not None else None

    if group_id is not None:
        ct = req_params.get('case_type', None)
        at = req_params.get('activity_type', None)
        tt = req_params.get('time_type', None)
        ctx = tuple((ct, at, tt))

        el = session['event_log']
        ec_miner = session['ec_miner']
        rl = ec_miner.derive_resource_log(el)

        om = session['org_model']
        group = om.find_group_members(group_id)

        if ctx in om.find_group_execution_contexts(group_id):
            from ordinor.analysis.group_profiles import (
                group_relative_focus, group_relative_stake,
                group_coverage, group_member_contribution
            )
                
            return json.jsonify({
                'group_relative_focus': \
                    group_relative_focus(group, ctx, rl),
                'group_relative_stake': \
                    group_relative_stake(group, ctx, rl),
                'group_coverage': \
                    group_coverage(group, ctx, rl),
                'group_member_contribution': \
                    group_member_contribution(group, ctx, rl)
            })

    return Response(status=204)


'''
Functions
'''
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

        # capable execution contexts, and connecting edges to groups
        exec_ctxs = om.find_group_execution_contexts(og_id)
        for co in exec_ctxs:
            ct, at, tt = co[0], co[1], co[2]
            ctx_node_id = 'context' + DELIM + '({},{},{})'.format(ct, at, tt)
            data_dict[ctx_node_id] = {
                '_type': 'node',
                'label': '{}, {}, {}'.format(ct, at, tt),
                '_class': 'context'
            }
            data_dict[group_node_id + ' -> ' + ctx_node_id] = {
                '_type': 'edge',
                '_class': 'group-context'
            }

    from json import dumps
    return dumps(data_dict)


# TODO
def _discover_draw_process_model(
    case_type, hl_activity_types, time_type):
    from .utilities import _trim_activity_label_tail

    # TODO: handle process model discovery for CSV inputs
    el = session['event_log']
    fn_server = '{}.log.{}'.format(
        session.sid[:32], session['last_upload_event_log_filetype']
    )
    from pm4py.objects.log.importer.xes import importer as xes_importer
    pm4py_log = xes_importer.apply(join(
        app.config['TEMP'], fn_server
    ))
    print(type(pm4py_log))

    ec_miner = session['ec_miner']
    sel_cases = ec_miner.get_values_by_type(case_type) \
        if case_type != '' else set(el[CASE_TYPE])

    '''
    # NOTE: CSV only - trim the additional markings appended by Disco
    hl_activity_types = [_trim_activity_label_tail(x, r'-complete')
        for x in hl_activity_types]
    '''

    # filter event log
    from pm4py.objects.log.log import EventLog
    pm4py_log_filtered = EventLog()
    # filter event log: keep selected cases only
    for trace in pm4py_log:
        if trace.attributes['concept:name'] in sel_cases:
            pm4py_log_filtered.append(trace)

    from pm4py.algo.discovery.dfg import algorithm as dfg_discovery
    dfg = dfg_discovery.apply(pm4py_log_filtered)
    from pm4py.visualization.dfg import visualizer as dfg_visualization
    gviz = dfg_visualization.apply(dfg, log=pm4py_log_filtered, 
        variant=dfg_visualization.Variants.FREQUENCY, 
        parameters={'maxNoOfEdgesInDiagram': 30}
    )
    gv_source = gviz.source

    # find activity labels that should be highlighted
    hl_activities = []
    for at in hl_activity_types:
        hl_activities.extend(ec_miner.get_values_by_type(at))

    # TODO: delegate to front-end: edit and annotate the graph
    """
    import pygraphviz as pgv
    graph = pgv.AGraph(gviz.source)
    for node in graph.nodes():
        if node.attr['shape'] == 'box' and node.attr['label'] != '':
            # trim the count in the labels from DFG
            node.attr['label'] = _trim_activity_label_tail(
                node.attr['label'], r' \(\d+\)')
            node.attr['fontname'] = 'Helvetica'

            # TODO: NOT an elegant solution for highlighting purpose - need rev.
            if ec_miner._atypes[node.attr['label']] \
                in hl_activity_types:
                # highlight
                node.attr['style'] = 'bold'
                node.attr['fontcolor'] = 'red3'
            else:
                node.attr['style'] = 'filled'
                node.attr['fillcolor'] = 'gainsboro'

    gv_source = graph.string()
    return gv_source, hl_activities
    """
