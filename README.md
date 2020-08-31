# OrgMiner-Arya
A project based on [OrgMiner](https://pypi.org/project/orgminer) for the 
visualization of organizational models from the perspective of execution
modes, incorporating process knowledge.

See [here](https://orgminer.readthedocs.io/en/latest/examples/infsyst2020yang-arya.html)
for an instruction for how to use it.

Arya is built as a Python [Flask](https://flask.palletsprojects.com/) web
app, with its core based on the following software:

* [OrgMiner](https://pypi.org/project/orgminer/), for the discovery of
  execution modes and organizational models from an given event log)

* [pygraphviz](https://pygraphviz.github.io/), for handling the
  manipulation of graph objects

* [d3-graphviz](https://github.com/magjac/d3-graphviz), for visualization
