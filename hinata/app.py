from flask import *
app = Flask(__name__)

# TODO: remove the import by local relative path
import sys
sys.path.append('../OrgMiner/')

import pygraphviz as pgv

@app.route('/')
def main():
    # load data
    dotstr_org_model = build_dot_strings_om()
    return render_template('index.html',
        dotstr_org_model=dotstr_org_model)

def build_dot_strings_om():
    # TODO: hard-coded file for debugging
    #fn = './hinata/static/demo/wabo_fullCA-AHC-CF.om'
    fn = './hinata/static/demo/wabo_fullTC-MOC-CF.om'

    from orgminer.OrganizationalModelMiner.base import OrganizationalModel
    with open(fn, 'r') as f:
        om = OrganizationalModel.from_file_csv(f)

    # construct organizational model DOT string
    graph = pgv.AGraph(strict=True, directed=True)

    length = 2
    i = 0

    id_delim = '/::/'
    for og_id, og in om.find_all_groups():
        if i < length:
            pass
        else:
            break

        # groups
        group_node_id = 'group' + id_delim + '{}'.format(og_id)
        graph.add_node(group_node_id, 
            label='Group {}'.format(og_id),
            color='cadetblue1', shape='house', 
            fontname='Helvetica',
            _class='group', _type='node')

        # member resources, and connecting edges to groups
        for resource in og:
            resource_node_id = 'resource' + id_delim + '{}'.format(resource)
            graph.add_node(resource_node_id,
                label='{}'.format(resource),
                color='gold', shape='ellipse',
                fontname="Helvetica",
                _class='resource', _type='node')
            graph.add_edge(
                group_node_id,
                resource_node_id,
                _class='group-resource', _type='edge')

        # capable execution modes, and connecting edges to groups
        exec_modes = om.find_group_execution_modes(og_id)[:3] # TODO
        for em in exec_modes:
            ct, at, tt = em[0], em[1], em[2]
            mode_node_id = 'mode' + id_delim + '({},{},{})'.format(ct, at, tt)
            graph.add_node(mode_node_id,
                label='{}, {}, {}'.format(em[0], em[1], em[2]),
                color='gainsboro', shape='octagon',
                fontname="Helvetica", fontsize="10",
                _class='mode', _type='node')
            graph.add_edge(
                group_node_id,
                mode_node_id,
                _class='group-mode', _type='edge')

        i += 1 # TODO

    return graph.string()

