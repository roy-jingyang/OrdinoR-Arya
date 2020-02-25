/***********************************************************************/
// class for organizing the execution mode tree
class ModeTree {
    // NOTE: this is not a common tree --- each node records its children.
    // (not the other way around lol)
    constructor(modeNodeIdList, preference) {
        this.root = this.stringifyModeTriple(['*', '*', '*']);
        this.nodes = [];
        for (var i = 0; i < 4; i++) {
            this.nodes.push(new Map());
        }
        this.nodes[0].set(this.root, new Set());

        this.viewType = preference;

        switch(this.viewType) {
            case "case_first":
                this.buildTreeCaseFirst(modeNodeIdList);
                break;
            case "time_first":
                this.buildTreeTimeFirst(modeNodeIdList);
                break;
            default:
                // do nothing
        }

        return this;
    }

    parseModeTriple(modeNodeId) {
        var modeStr = modeNodeId.split(delim)[1];
        const [ct, at, tt] = modeStr.slice(1, -1).split(',');
        return [ct, at, tt];
    }

    stringifyModeTriple(modeTriple) {
        return "mode" + delim + '(' + modeTriple.join(',') + ')';
    }

    buildTreeCaseFirst(modeNodeIdList) {
        //console.log("case first building");

        for (var modeNodeId of modeNodeIdList) {
            const [ct, at, tt] = this.parseModeTriple(modeNodeId);

            var ctXX = this.stringifyModeTriple([ct, '*', '*']);
            var ctXtt = this.stringifyModeTriple([ct, '*', tt]);
            var ctattt = this.stringifyModeTriple([ct, at, tt]);

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

    buildTreeTimeFirst(modeNodeIdList) {
        //console.log("time first building");

        for (var modeNodeId of modeNodeIdList) {
            const [ct, at, tt] = this.parseModeTriple(modeNodeId);

            var XXtt = this.stringifyModeTriple(['*', '*', tt]);
            var ctXtt = this.stringifyModeTriple([ct, '*', tt]);
            var ctattt = this.stringifyModeTriple([ct, at, tt]);

            this.nodes[0].get(this.root).add(ctXX);

            if (!this.nodes[1].has(XXtt))
                this.nodes[1].set(XXtt, new Set());
            this.nodes[1].get(XXtt).add(ctXtt);

            if (!this.nodes[2].has(ctXtt))
                this.nodes[2].set(ctXtt, new Set());
            this.nodes[2].get(ctXtt).add(ctattt);

            if (!this.nodes[3].has(ctattt))
                this.nodes[3].set(ctattt, new Set());
        }
    }

    // corresponding to first, second, and third -level nodes
    getNodeLevel(modeNodeId) {
        const modeTriple = this.parseModeTriple(modeNodeId);
        var count = 0;
        for (var type of modeTriple) {
            if (type == '*')
                count += 1;
        }
        return (3 - count);
    }

    getChildNodes(modeNodeId, isTraverse) {
        var nodeLevel = this.getNodeLevel(modeNodeId);
        if (isTraverse == true && nodeLevel == 1) {
            // only effective for grandparent nodes
            var allSprings = [];
            var children = Array.from(this.nodes[nodeLevel].get(modeNodeId))
                .sort();
            allSprings = allSprings.concat(children);
            for (var child of children) {
                allSprings = allSprings.concat(
                    this.getChildNodes(child, false));
            }
            return allSprings;
        } else {
            return Array.from(this.nodes[nodeLevel].get(modeNodeId)).sort();
        }
    }

    getGrandParentNodeFromLeaf(modeNodeId) {
        const [ct, at, tt] = this.parseModeTriple(modeNodeId);
        switch (this.viewType) {
            case "case_first":
                return this.stringifyModeTriple([ct, '*', '*']);
                break;
            case "time_first":
                return this.stringifyModeTriple(['*', '*', tt]);
                break;
            default:
                // do nothing
        }
    }

    getParentNodeFromLeaf(modeNodeId) {
        const [ct, at, tt] = this.parseModeTriple(modeNodeId);
        return this.stringifyModeTriple([ct, '*', tt]);
    }

}

/***********************************************************************/
// class for handling all data elements
// singleton class
class DataFactory {
    constructor(dotSrcString) {
        // singleton: check existence
        if (!!DataFactory.instance)
            return DataFactory.instance;
        DataFactory.instance = this;

        this.nodeListResources = new Map();
        this.nodeListGroups = new Map();
        this.nodeListModes = new Map();

        this.edgeListGroupsResources = new Map();
        this.edgeListGroupsModes = new Map();


        // parse the dot source string
        var attrList_patt = /\[*\]/i;
        var cleanChar = function(str) {
            var newStr = str.replace(/"/g, '');
            newStr = newStr.replace(/\n/g, '');
            return newStr;
        }

        var lines = dotSrcString.split(";\n\t");
        var modeNodeIdList = [];
        //var strHead = lines[0];
        for (var i = 1; i < lines.length; i++) {
            const idStr = lines[i].split('\t')[0];
            var id = cleanChar(idStr);
            var elem = Object();
            
            const attrsStr = lines[i].replace(idStr + '\t', '').trim();
            var match = /\[*\]/g.exec(attrsStr);
            if (match)
                var attrList = attrsStr.slice(1, match.index);
            else
                throw "Invalid data";

            for (var key_val of attrList.split(',\n\t\t')) {
                //console.log(key_val.split('='));
                const [key, val] = key_val.split('=');
                elem[key] = cleanChar(val);
            }
            //console.log(elem);

            if (elem["_type"] == "node" && elem["_class"] == "group") {
                this.nodeListGroups.set(id, elem);
            }
            else if (elem["_type"] == "node" && elem["_class"] == "resource") {
                this.nodeListResources.set(id, elem);
            }
            else if (elem["_type"] == "node" && elem["_class"] == "mode") {
                this.nodeListModes.set(id, elem);

                modeNodeIdList.push(id);
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
            else if (elem["_type"] == "edge" && elem["_class"] == "group-mode") {
                const [groupNodeId, modeNodeId] = id.split(' -> ');
                if (!this.edgeListGroupsModes.has(groupNodeId))
                    this.edgeListGroupsModes.set(groupNodeId, new Map());
                this.edgeListGroupsModes.get(groupNodeId)
                    .set(modeNodeId, elem);

                if (!this.edgeListGroupsModes.has(modeNodeId))
                    this.edgeListGroupsModes.set(modeNodeId, new Map());
                this.edgeListGroupsModes.get(modeNodeId)
                    .set(groupNodeId, elem);
            }
            else {
                throw "Invalid data";
            }

        }

        // build the execution mode tree
        this.modeTree = new ModeTree(modeNodeIdList, "case_first");

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

    getAllModeNodeIds() {
        return Array.from(this.nodeListModes.keys()).sort();
    }

    getModeNodes(nbunch) {
        var elems = [];
        for (var id of nbunch) {
            if (this.nodeListModes.has(id)) {
                elems.push([id, this.nodeListModes.get(id)]); 
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
        const caps = Array.from(
            this.edgeListGroupsModes.get(groupNodeId).keys());
        var firstLevelCapIds = new Set();
        var secondLevelCapIds = new Set();
        for (var capId of caps) {
            firstLevelCapIds.add(
                this.modeTree.getGrandParentNodeFromLeaf(capId));
            secondLevelCapIds.add(
                this.modeTree.getParentNodeFromLeaf(capId));
        }
        firstLevelCapIds = Array.from(firstLevelCapIds);
        secondLevelCapIds = Array.from(secondLevelCapIds);
        return (caps.concat(firstLevelCapIds, secondLevelCapIds)).sort();
    }

    getGroupNodeIdsByResource(resourceNodeId) {
        const groups = Array.from(
            this.edgeListGroupsResources.get(resourceNodeId).keys());
        return groups.sort();
    }

    getGroupNodeIdsByMode(modeNodeId) {
        const groups = Array.from(
            this.edgeListGroupsModes.get(modeNodeId).keys());
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
            else if (nodeVId.indexOf("mode") == 0) {
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
                else if (nodeVId.indexOf("mode") == 0) {
                    return this.edgeListGroupsModes
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

    /*
     * DEPRECATED : no longer in use and should not be.
    findEdges(nodeIdList) {
        // return pairwise edges given a list of nodes (if they exist)
        var allEdges = [];
        for (var i = 0; i < nodeIdList.length - 1; i++) {
            var u = nodeIdList[i];
            for (var j = i + 1; j < nodeIdList.length; j++) {
                var v = nodeIdList[j];
                if (this.hasEdge(u, v)) {
                    allEdges.push([[u, v], {}])
                }
            }
        }
        return allEdges;
    }
    */

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
                return edgeList.filter(function(value, index, array) {
                    var isEdgeInvolved = false;
                    for (var nodeId of nodeUId) {
                        isEdgeInvolved = (
                            value[0].sort().join(" -- ") == 
                            [nodeUId, nodeId].sort().join(" -- "));
                    }
                    return !isEdgeInvolved;
                });
            } else if (Array.isArray(nodeVId)) {
                return removeEdges(edgeList, nodeVId, nodeUId);
            } else {
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

    // Helper: sort a nodeList by an order of "resources > groups > modes"
    compareNodeList(a, b) {
        var order = ["mode", "group", "resource"];
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
            if (nodeType == "mode")
                nodeType += "_L" + this.modeTree.getNodeLevel(node[0]);

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
                case "mode_L1":
                case "mode_L2":
                case "mode_L3":
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
                string += '\t"' + new String(node[0]) + '"';
                string += ' [';
                for (const attr in node[1]) {
                    if (attr[0] != '_') {
                        string += new String(attr) + '=';
                        string += '"' + new String(node[1][attr]) + '",';
                    } else {
                        // specific style for highlighted nodes
                        switch (attr) {
                            case "_highlightmode":
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
                '"' + new String(u) + '"' + 
                " -- " +
                '"' + new String(v)) + '"';

            string += ' [';
            for (const attr in edge[1]) {
                if (attr[0] != '_') {
                    if (attr == "contribution")
                        //string += "label" + '=';
                        string += new String(attr) + '=';
                    else
                        string += new String(attr) + '=';
                    string += '"' + new String(edge[1][attr]) + '",';
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

    createAugmentedModeNode(modeNodeId) {
        var modeNodeElem = new Object();
        modeNodeElem["label"] = modeNodeId.split(delim)[1].slice(1, -1);
        /*
        // the root node is "meaningless" therefore hidden
        if (this.modeTree.getNodeLevel(modeNodeId) == 0)
            modeNodeElem["style"] = "invis";
        */
        return [modeNodeId, modeNodeElem];
    }
}

