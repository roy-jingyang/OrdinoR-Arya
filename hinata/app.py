from flask import *
app = Flask(__name__)

# TODO: remove the import by local relative path
import sys
sys.path.append('../OrgMiner/')

import pygraphviz as pgv

delim = '/::/'

@app.route('/')
def main():
    # load data
    dotstr_org_model = build_dot_strings_om()
    return render_template('index.html',
        dotstr_org_model=dotstr_org_model)

@app.route('/get_process_model/<case_type>/')
def get_process_model(case_type):
    return discover_process_model(case_type, [])

@app.route('/get_process_model/<case_type>/<hl_activity_types>')
def get_process_model_with_highlights(case_type, hl_activity_types):
    return discover_process_model(case_type, hl_activity_types.split(','))

def build_dot_strings_om():
    # TODO: hard-coded file for debugging
    fn = './hinata/static/demo/wabo_fullCA-AHC-CF.om'
    #fn = './hinata/static/demo/wabo_fullTC-MOC-CF.om' #TODO: tricky overlaps!

    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    with open(fn, 'r') as f:
        om = OrganizationalModel.from_file_csv(f)

    # construct organizational model DOT string
    graph = pgv.AGraph(strict=True, directed=True)

    # TODO: debug use
    N_groups = 3
    N_modes = 5
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
                _class='group-resource', _type='edge')

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

        i += 1 # TODO

    return graph.string()

#def discover_process_model(el, case_type=None, time_type=None):
def discover_process_model(case_type=None, hl_activity_types=None):
    # TODO: hard-coded file for debugging
    fn_log = './hinata/static/demo/wabo.csv'
    fn_log_xes = './hinata/static/demo/wabo.xes'

    from pm4py.objects.log.importer.xes import factory as xes_import_factory
    log = xes_import_factory.apply(fn_log_xes)

    from orgminer.IO.reader import read_disco_csv
    with open(fn_log, 'r') as f:
        el = read_disco_csv(f, mapping={'(case) channel': 6})

    from orgminer.ExecutionModeMiner.direct_groupby import FullMiner
    from orgminer.ExecutionModeMiner.informed_groupby import TraceClusteringFullMiner

    mode_miner = FullMiner(el, 
        case_attr_name='(case) channel', resolution='weekday')
    #mode_miner = TraceClusteringFullMiner(el,
    #    fn_partition='input/extra_knowledge/bpic12.bosek5.tcreport', resolution='weekday')

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
            # trim the count from DFG
            node.attr['label'] = _trim_activity_label_tail(
                node.attr['label'], r' \(\d+\)')
            if ('AT.' + node.attr['label']) in sel_activity_types:
                # highlight
                node.attr['style'] = 'bold'
                node.attr['fontcolor'] = 'red3'

    return graph.string()

def _trim_activity_label_tail(s, patt):
    from re import search as regex_search
    match = regex_search(patt, s)
    return s[:match.start()]

