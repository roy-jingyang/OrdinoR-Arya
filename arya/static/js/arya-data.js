/***********************************************************************/
// class for organizing the execution context tree
class ECTree {
    // NOTE: each node records its children.
    constructor(ctxNodeIdList) {
        this.root = this.stringifyCtxTriple(['⊥', '⊥', '⊥']);
        this.nodes = [];
        for (var i = 0; i < 4; i++) {
            this.nodes.push(new Map());
        }
        this.nodes[0].set(this.root, new Set());

        this.buildTreeCaseFirst(ctxNodeIdList);

        return this;
    }

    parseCtxTriple(ctxNodeId) {
        var ctxStr = ctxNodeId.split(delim)[1];
        const [ct, at, tt] = ctxStr.slice(1, -1).split(',');
        return [ct, at, tt];
    }

    stringifyCtxTriple(ctxTriple) {
        return "context" + delim + '(' + ctxTriple.join(',') + ')';
    }

    buildTreeCaseFirst(ctxNodeIdList) {
        for (var ctxNodeId of ctxNodeIdList) {
            const [ct, at, tt] = this.parseCtxTriple(ctxNodeId);

            var ctXX = this.stringifyCtxTriple([ct, '⊥', '⊥']);
            var ctXtt = this.stringifyCtxTriple([ct, '⊥', tt]);
            var ctattt = this.stringifyCtxTriple([ct, at, tt]);

            this.nodes[0].get(this.root).add(ctXX);

            if (!this.nodes[1].has(ctXX))
                this.nodes[1].set(ctXX, new Set());
            this.nodes[1].get(ctXX).add(ctXtt);
                

            if (!this.nodes[2].has(ctXtt))
                this.nodes[2].set(ctXtt, new Set());
            this.nodes[2].get(ctXtt).add(ctattt);

            if (!this.nodes[3].has(ctattt))
                this.nodes[3].set(ctattt, new Set());
        }
    }

    // corresponding to first, second, and third -level nodes
    getNodeLevel(ctxNodeId) {
        const ctxTriple = this.parseCtxTriple(ctxNodeId);
        var count = 0;
        for (var type of ctxTriple) {
            if (type == '⊥')
                count += 1;
        }
        return (3 - count);
    }

    getChildNodes(ctxNodeId, isTraverse) {
        var nodeLevel = this.getNodeLevel(ctxNodeId);
        if (isTraverse == true && nodeLevel == 1) {
            // only effective for grandparent nodes
            var allSprings = [];
            var children = Array.from(this.nodes[nodeLevel].get(ctxNodeId))
                .sort();
            allSprings = allSprings.concat(children);
            for (var child of children) {
                allSprings = allSprings.concat(
                    this.getChildNodes(child, false));
            }
            return allSprings;
        } else {
            return Array.from(this.nodes[nodeLevel].get(ctxNodeId)).sort();
        }
    }

    getGrandParentNodeFromLeaf(ctxNodeId) {
        const [ct, at, tt] = this.parseCtxTriple(ctxNodeId);
        return this.stringifyCtxTriple([ct, '⊥', '⊥']);
    }

    getParentNodeFromLeaf(ctxNodeId) {
        const [ct, at, tt] = this.parseCtxTriple(ctxNodeId);
        return this.stringifyCtxTriple([ct, '⊥', tt]);
    }

}

/***********************************************************************/
// class for handling all data elements
// singleton class
class DataFactory {
    constructor(dataString) {
        // singleton: check existence
        if (!!DataFactory.instance)
            return DataFactory.instance;
        DataFactory.instance = this;

        this.nodeListResources = new Map();
        this.nodeListGroups = new Map();
        this.nodeListContexts = new Map();

        this.edgeListGroupsResources = new Map();
        this.edgeListGroupsContexts = new Map();

        var ctxNodeIdList = [];
        for (const [id, attrs] of Object.entries(JSON.parse(dataString))) {
            var elem = Object();
            for (const [attrName, attrValue] of Object.entries(attrs)) {
                elem[attrName] = attrValue;
            }

            if (elem["_type"] == "node" && elem["_class"] == "group") {
                this.nodeListGroups.set(id, elem);
            }
            else if (elem["_type"] == "node" && elem["_class"] == "resource") {
                this.nodeListResources.set(id, elem);
            }
            else if (elem["_type"] == "node" && elem["_class"] == "context") {
                this.nodeListContexts.set(id, elem);
                ctxNodeIdList.push(id);
            }
            else if (elem["_type"] == "edge" && elem["_class"] == "group-resource") {
                const [groupNodeId, resourceNodeId] = id.split(' -> ');
                if (!this.edgeListGroupsResources.has(groupNodeId))
                    this.edgeListGroupsResources.set(groupNodeId, new Map());
                this.edgeListGroupsResources.get(groupNodeId)
                    .set(resourceNodeId, elem);

                if (!this.edgeListGroupsResources.has(resourceNodeId))
                    this.edgeListGroupsResources.set(resourceNodeId, new Map());
                this.edgeListGroupsResources.get(resourceNodeId)
                    .set(groupNodeId, elem);
            }
            else if (elem["_type"] == "edge" && elem["_class"] == "group-context") {
                const [groupNodeId, ctxNodeId] = id.split(' -> ');
                if (!this.edgeListGroupsContexts.has(groupNodeId))
                    this.edgeListGroupsContexts.set(groupNodeId, new Map());
                this.edgeListGroupsContexts.get(groupNodeId)
                    .set(ctxNodeId, elem);

                if (!this.edgeListGroupsContexts.has(ctxNodeId))
                    this.edgeListGroupsContexts.set(ctxNodeId, new Map());
                this.edgeListGroupsContexts.get(ctxNodeId)
                    .set(groupNodeId, elem);
            }
            else {
                throw "Invalid data";
            }
        }

        // build the execution context tree
        this.ecTree = new ECTree(ctxNodeIdList);

        return this;
    }

    getAllGroupNodeIds() {
        return Array.from(this.nodeListGroups.keys()).sort();
    }

    getGroupNodes(nbunch) {
        var elems = [];
        for (var id of nbunch) {
            if (this.nodeListGroups.has(id)) {
                elems.push([id, this.nodeListGroups.get(id)]); 
            }
        }
        return elems;
    }

    getAllResourceNodeIds() {
        return Array.from(this.nodeListResources.keys()).sort();
    }

    getResourceNodes(nbunch) {
        var elems = [];
        for (var id of nbunch) {
            if (this.nodeListResources.has(id)) {
                elems.push([id, this.nodeListResources.get(id)]); 
            }
        }
        return elems;
    }

    getAllContextNodeIds() {
        return Array.from(this.nodeListContexts.keys()).sort();
    }

    getContextNodes(nbunch) {
        var elems = [];
        for (var id of nbunch) {
            if (this.nodeListContexts.has(id)) {
                elems.push([id, this.nodeListContexts.get(id)]); 
            }
        }
        return elems;
    }

    getMemberNodeIdsByGroup(groupNodeId) {
        const members = Array.from(
            this.edgeListGroupsResources.get(groupNodeId).keys());
        return members.sort();
    }

    getCapabilityNodeIdsByGroup(groupNodeId) {
        if (this.edgeListGroupsContexts.get(groupNodeId) === undefined) {
            return [];
        }
        const caps = Array.from(
            this.edgeListGroupsContexts.get(groupNodeId).keys());
        var firstLevelCapIds = new Set();
        var secondLevelCapIds = new Set();
        for (var capId of caps) {
            firstLevelCapIds.add(
                this.ecTree.getGrandParentNodeFromLeaf(capId));
            secondLevelCapIds.add(
                this.ecTree.getParentNodeFromLeaf(capId));
        }
        firstLevelCapIds = Array.from(firstLevelCapIds);
        secondLevelCapIds = Array.from(secondLevelCapIds);
        return (caps.concat(firstLevelCapIds, secondLevelCapIds)).sort();
    }

    getNumCapabilitiesByGroup(groupNodeId) {
        if (this.edgeListGroupsContexts.get(groupNodeId) === undefined) {
            return 0;
        }
        const caps = Array.from(
            this.edgeListGroupsContexts.get(groupNodeId).keys());
        return caps.length;
    }

    getGroupNodeIdsByResource(resourceNodeId) {
        const groups = Array.from(
            this.edgeListGroupsResources.get(resourceNodeId).keys());
        return groups.sort();
    }

    getGroupNodeIdsByContext(ctxNodeId) {
        const groups = Array.from(
            this.edgeListGroupsContexts.get(ctxNodeId).keys());
        return groups.sort();
    }

    hasEdge(nodeUId, nodeVId) {
        if (nodeUId.indexOf("group") == 0) {
            if (nodeVId.indexOf("group") == 0) {
                return false;
            }
            else if (nodeVId.indexOf("resource") == 0) {
                return this.getMemberNodeIdsByGroup(nodeUId)
                    .includes(nodeVId);
            }
            else if (nodeVId.indexOf("context") == 0) {
                return this.getCapabilityNodeIdsByGroup(nodeUId)
                    .includes(nodeVId);
            }
            else {
                return false;
            }
        }
        else if (nodeVId.indexOf("group") == 0) {
            return this.hasEdge(nodeVId, nodeUId);
        }
        else {
            return false;
        }
    }

    getEdgeAttr(nodeUId, nodeVId) {
        if (this.hasEdge(nodeUId, nodeVId)) {
            if (nodeUId.indexOf("group") == 0) {
                if (nodeVId.indexOf("group") == 0) {
                    return undefined;
                }
                else if (nodeVId.indexOf("resource") == 0) {
                    return this.edgeListGroupsResources
                        .get(nodeUId).get(nodeVId);
                }
                else if (nodeVId.indexOf("context") == 0) {
                    return this.edgeListGroupsContexts
                        .get(nodeUId).get(nodeVId);
                }
                else {
                    return undefined;
                }
            }
            else if (nodeVId.indexOf("group") == 0) {
                return this.getEdgeAttr(nodeVId, nodeUId);
            }
            else {
                return undefined;
            }
        } else {
            return undefined;
        }
    }

    removeNodes(nodeList, nodeId) {
        if (Array.isArray(nodeId)) {
            return nodeList.filter(function(value, index, array) {
                return !(nodeId.includes(value[0]));
            });
        } else {
            return nodeList.filter(function(value, index, array) {
                return value[0] != nodeId;
            });
        }
    }

    removeEdges(edgeList, nodeUId, nodeVId) {
        if (nodeVId === undefined) {
            if (Array.isArray(nodeUId)) {
                return edgeList.filter(function(value, index, array) {
                    return (
                        !nodeUId.includes(value[0][0]) && 
                        !nodeUId.includes(value[0][1]));
                });
            } else {
                return edgeList.filter(function(value, index, array) {
                    return (value[0][0] != nodeUId && value[0][1] != nodeUId);
                });
            }

        } else {
            if (Array.isArray(nodeVId) && Array.isArray(nodeUId)) {
                throw new Error("Cannot determine edges with two parameters" +
                    " being lists at the same time.");
            } else if (Array.isArray(nodeUId)) {
                //console.log("1: only isArray(nodeUId)");
                var edgesToFiltered = [];
                for (var nodeId of nodeUId) {
                    // both nodeId, nodeVId refer to nodes
                    edgesToFiltered.push([nodeVId, nodeId].sort()
                        .join(" -- "));
                }
                return edgeList.filter(function(value, index, array) {
                    return !edgesToFiltered
                        .includes(value[0].sort().join(" -- "));
                });
            } else if (Array.isArray(nodeVId)) {
                //console.log("2: only isArray(nodeVId)");
                return this.removeEdges(edgeList, nodeVId, nodeUId);
            } else {
                //console.log("3: neither is an Array");
                return edgeList.filter(function(value, index, array) {
                    return (
                        value[0].sort().join(" -- ") != 
                        [nodeUId, nodeVId].sort().join(" -- "));
                });
            }
        }
    }

    // Helper: remove duplicates and keep only unique elements in a nodeList
    removeDuplicateNodes(nodeList) {
        var uniqueNodeIdList = new Set();
        var uniqueNodeList = [];
        for (var node of nodeList) {
            if (!uniqueNodeIdList.has(node[0]))
                uniqueNodeList.push(node);
            uniqueNodeIdList.add(node[0]);
        }
        return uniqueNodeList;
    }

    // Helper: remove duplicates and keep only unique elements in a edgeList
    removeDuplicateEdges(edgeList) {
        var uniques = new Set();
        var uniqueEdgeList = [];
        for (var edge of edgeList) {
            if (!uniques.has(edge[0].join('-')))
                uniqueEdgeList.push(edge);
            uniques.add(edge[0].join('-'));
        }
        return uniqueEdgeList;
    }

    // Helper: sort a nodeList by an order of "resources > groups > contexts"
    compareNodeList(a, b) {
        var order = ["context", "group", "resource"];
        var order_a = order.indexOf(a[0].split(delim)[0]);
        var order_b = order.indexOf(b[0].split(delim)[0]);

        if (order_a == -1 || order_b == -1)
            return;

        if (order_a < order_b)
            return 1;
        else if (order_a == order_b)
            return 0;
        else
            return -1;

    }

    compileDotString(nodeList, edgeList) {
        var globalStyleString = 'node [style="filled",fontname="Helvetica"]\n'
            + 'edge[fontname="Helvetica",fontsize=8]\n';

        // node parts
        var nodeDotSrcString = "";
        // remove duplicates from nodeList
        nodeList = this.removeDuplicateNodes(nodeList);

        // sort nodeList by the customized order
        nodeList.sort(this.compareNodeList);

        // make subgraphs
        var nodeClusters = new Map();

        for (var node of nodeList) {
            var nodeType = node[0].split(delim)[0];
            if (nodeType == "context")
                nodeType += "_L" + this.ecTree.getNodeLevel(node[0]);

            if (!nodeClusters.has(nodeType))
                nodeClusters.set(nodeType, []);
            nodeClusters.get(nodeType).push(node);
        }

        // NOTE: append redundant invisible nodes to keep subgraphs ordered
        nodeClusters.forEach(function(nodeList, nodeType, map) {
            nodeList = nodeList
            var string = "\nsubgraph " + nodeType;

            string += " {\n";
            
            var nodeStyles = '\tnode [';
            switch(nodeType) {
                case "resource":
                    nodeStyles += 'color="gold",shape="ellipse",' 
                        + 'fontsize=10';
                    break;
                case "group":
                    nodeStyles += 'color="cadetblue1",shape="house",';
                    break;
                case "context_L1":
                case "context_L2":
                case "context_L3":
                    nodeStyles += 'color="gainsboro",shape="octagon",' 
                        + 'fontsize=10';
                    break;
                default:
                    // do nothing
            }
            string += nodeStyles + "]\n";

            string += '\trank="same";\n';
            
            string += '\t' + nodeType + "_invis" + ' [style=invis];\n';
            for (var node of nodeList) {
                string += '\t"' + node[0] + '"';
                string += ' [';
                for (const attr in node[1]) {
                    if (attr[0] != '_') {
                        string += attr + '=';
                        string += '"' + node[1][attr] + '",';
                    } else {
                        // specific style for highlighted nodes
                        switch (attr) {
                            case "_highlightcontext":
                                if (node[1][attr] == true)
                                    string += 'style="bold",fontcolor="red3",';
                                break;
                            case "_highlightgroup":
                                if (node[1][attr] == true)
                                    string += 'style="bold",fontcolor="red4",';
                                break;
                            default:
                                // do nothing
                        }
                    }
                }
                //string = string.slice(0, -1);
                string += "];\n";
            }
            string += "}";
            nodeDotSrcString = nodeDotSrcString.concat(string);
        });

        // edge parts
        var edgeDotSrcString = "";
        edgeList = this.removeDuplicateEdges(edgeList);
        // create edges based on current existing nodes
        for (const edge of edgeList) {
            const u = edge[0][0];
            const v = edge[0][1];

            var string = (
                '"' + u + '"' + 
                " -- " +
                '"' + v + '"'
            );

            string += ' [';
            for (const attr in edge[1]) {
                if (attr[0] != '_') {
                    if (attr == "contribution")
                        //string += "label" + '=';
                        string += attr + '=';
                    else
                        string += attr + '=';
                    string += '"' + edge[1][attr] + '",';
                } else {
                    // do nothing
                }
            }
            //string = string.slice(0, -1);
            string += "];\n";
            edgeDotSrcString = edgeDotSrcString.concat(string);
        }

        // NOTE: connect redundant invisible nodes to keep subgraphs ordered
        var invisEdgeHead = null;
        nodeClusters.forEach(function(nodeList, nodeType, map) {
            if (invisEdgeHead != null) {
                var invisEdgeTail = nodeType + "_invis";
                edgeDotSrcString += (
                    invisEdgeHead +
                    " -- " + 
                    invisEdgeTail + ' [style=invis];\n');
            }
            invisEdgeHead = nodeType + "_invis";
        });

        return ("strict graph {\n" + globalStyleString
            + nodeDotSrcString + "\n\n"
            + edgeDotSrcString + "\n}");
    }

    createAugmentedContextNode(ctxNodeId) {
        var ctxNodeElem = new Object();
        ctxNodeElem["label"] = ctxNodeId.split(delim)[1].slice(1, -1);
        return [ctxNodeId, ctxNodeElem];
    }
}

