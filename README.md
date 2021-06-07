# OrgMining-Arya
A project based on [OrgMining](https://pypi.org/project/orgmining) for the 
visualization of organizational models.

See [here](https://orgmining.readthedocs.io/en/latest/examples/infsyst2020yang-arya.html)
for an instruction for how to use it.

Arya is built as a Python [Flask](https://flask.palletsprojects.com/) web
app, with its core based on the following software:

* [OrgMining](https://pypi.org/project/orgmining/), for the discovery of
  execution contexts and organizational models from an given event log)

* [pygraphviz](https://pygraphviz.github.io/), for handling the
  manipulation of graph objects

* [d3-graphviz](https://github.com/magjac/d3-graphviz), for visualization
