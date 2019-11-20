
var delim = '/::/';

class ModeTree {

    // NOTE: this is not a common tree --- each node records its children.
    constructor(modeNodeIdList, preference) {
        this.nodes = [];
        this.nodes.push(null);
        for (var i = 1; i <= 3; i++) {
            this.nodes.push(new Map());
        }

        this.viewType = preference;

        switch(this.viewType) {
            case "case_first":
                this.buildTreeCaseFirst(modeNodeIdList);
                break;
            case "time_first":
                //this.buildTreeTimeFirst(modeNodeIdList);
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

            if (!this.nodes[1].has(ctXX)) {
                this.nodes[1].set(ctXX, new Set());
            }
            this.nodes[1].get(ctXX).add(ctXtt);
                

            if (!this.nodes[2].has(ctXtt)) {
                this.nodes[2].set(ctXtt, new Set());
            }
            this.nodes[2].get(ctXtt).add(ctattt);

            if (!this.nodes[3].has(ctattt)) {
                this.nodes[3].set(ctattt, new Set());
            }
        }
    }

    // TODO
    buildTreeTimeFirst(modeNodeIdList) {
        //console.log("time first building");

        for (var modeNodeId of modeNodeIdList) {
            const [ct, at, tt] = this.parseModeTriple(modeNodeId);

            var XXtt = this.stringifyModeTriple(['*', '*', tt]);
            var ctXtt = this.stringifyModeTriple([ct, '*', tt]);
            var ctattt = this.stringifyModeTriple([ct, at, tt]);

            if (!this.nodes[1].has(XXtt)) {
                this.nodes[1].set(XXtt, new Set());
            }
            this.nodes[1].get(XXtt).add(ctXtt);

            if (!this.nodes[2].has(ctXtt)) {
                this.nodes[2].set(ctXtt, new Set());
            }
            this.nodes[2].get(ctXtt).add(ctattt);

            if (!this.nodes[3].has(ctattt)) {
                this.nodes[3].set(ctattt, new Set());
            }
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

    getChildNodes(modeNodeId) {
        var nodeLevel = this.getNodeLevel(modeNodeId);
        return this.nodes[nodeLevel].get(modeNodeId);
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


// class for handling data elements
class Factory {
    constructor(dotSrcString) {
        // singleton class
        if (!!Factory.instance) {
            return Factory.instance;
        }

        Factory.instance = this;

        this.nodeListResources = new Map();
        this.nodeListGroups = new Map();
        this.nodeListModes = new Map();

        this.nodeStatus = new Map();

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
            const [idStr, attrsStr] = lines[i].split('\t ');
            var id = cleanChar(idStr);
            var elem = Object();

            //console.log(idStr);
            //elem["id"] = cleanChar(idStr);
            
            var match = /\[*\]/g.exec(attrsStr);
            if (match) {
                var attrList = attrsStr.slice(1, match.index);
            } else {
                throw "Invalid data";
            }

            for (var key_val of attrList.split(',\n\t\t')) {
                //console.log(key_val.split('='));
                const [key, val] = key_val.split('=');
                elem[key] = cleanChar(val);
            }
            //console.log(elem);

            if (elem["_type"] == "node" && elem["_class"] == "group") {
                this.nodeListGroups.set(id, elem);
                this.nodeStatus.set(id, '');
            }
            else if (elem["_type"] == "node" && elem["_class"] == "resource") {
                this.nodeListResources.set(id, elem);
                this.nodeStatus.set(id, '');
            }
            else if (elem["_type"] == "node" && elem["_class"] == "mode") {
                this.nodeListModes.set(id, elem);
                this.nodeStatus.set(id, '');
                modeNodeIdList.push(id);
            }
            else if (elem["_type"] == "edge" && elem["_class"] == "group-resource") {
                const [groupNodeId, resourceNodeId] = id.split(' -> ');
                if (!this.edgeListGroupsResources.has(groupNodeId)) {
                    this.edgeListGroupsResources.set(groupNodeId, []);
                }
                this.edgeListGroupsResources.get(groupNodeId).push(resourceNodeId);

                if (!this.edgeListGroupsResources.has(resourceNodeId)) {
                    this.edgeListGroupsResources.set(resourceNodeId, []);
                }
                this.edgeListGroupsResources.get(resourceNodeId).push(groupNodeId);
            }
            else if (elem["_type"] == "edge" && elem["_class"] == "group-mode") {
                const [groupNodeId, modeNodeId] = id.split(' -> ');
                if (!this.edgeListGroupsModes.has(groupNodeId)) {
                    this.edgeListGroupsModes.set(groupNodeId, []);
                }
                this.edgeListGroupsModes.get(groupNodeId).push(modeNodeId);

                if (!this.edgeListGroupsModes.has(modeNodeId)) {
                    this.edgeListGroupsModes.set(modeNodeId, []);
                }
                this.edgeListGroupsModes.get(modeNodeId).push(groupNodeId);
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
        return Array.from(this.nodeListGroups.keys());
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
        return Array.from(this.nodeListResources.keys());
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
        return Array.from(this.nodeListModes.keys());
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
        const members = this.edgeListGroupsResources.get(groupNodeId);
        return members;
    }

    getCapabilityNodeIdsByGroup(groupNodeId) {
        const caps = this.edgeListGroupsModes.get(groupNodeId);
        return caps;
    }

    getGroupNodeIdsByResource(resourceNodeId) {
        const groups = this.edgeListGroupsResources.get(resourceNodeId);
        return groups;
    }

    getGroupNodeIdsByMode(modeNodeId) {
        const groups = this.edgeListGroupsModes.get(modeNodeId);
        return groups;
    }

    hasEdge(nodeUId, nodeVId) {
        if (nodeUId.indexOf("group") == 0) {
            if (nodeVId.indexOf("group") == 0) {
                // TODO: connections among groups
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

    findEdges(nodeIdList) {
        // return pairwise edges given a list of nodes (if they exist)
        var allEdges = [];
        for (var i = 0; i < nodeIdList.length - 1; i++) {
            var u = nodeIdList[i];
            for (var j = i + 1; j < nodeIdList.length; j++) {
                var v = nodeIdList[j];
                if (this.hasEdge(u, v)) {
                    allEdges.push([u, v])
                }
            }
        }
        return allEdges;
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
                        !nodeUId.includes(value[0]) && 
                        !nodeUId.includes(value[1]));
                });
            } else {
                return edgeList.filter(function(value, index, array) {
                    return (value[0] != nodeUId && value[1] != nodeUId);
                });
            }

        } else {
            return edgeList.filter(function(value, index, array) {
                return !(value.sort() == [nodeUId, nodeVId].sort());
            })
        }
    }

    // Helper: sort nodeList by an order of "resources > groups > modes"
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
        // node parts
        var nodeIdList = [];
        var nodeDotSrcString = 'node [style="filled"]\n';

        // sort nodeList by the customized order
        nodeList.sort(this.compareNodeList);

        for (var node of nodeList) {
            nodeIdList.push(node[0]);

            var string = '"' + new String(node[0]) + '"';
            string += ' ' + '[';
            for (const attr in node[1]) {
                if (attr[0] != '_') {
                    string += new String(attr) + '=';
                    string += '"' + new String(node[1][attr]) + '",';
                }
            }
            string = string.slice(0, -1);
            string += "];\n"
            nodeDotSrcString = nodeDotSrcString.concat(string);
        }

        // edge parts
        var edgeDotSrcString = "";
        // create edges based on all existing nodes
        for (const [u, v] of edgeList) {
            edgeDotSrcString = edgeDotSrcString.concat(
                '"' + new String(u) + '"' + 
                " -- " +
                '"' + new String(v) + '";\n');
        }

        return ("strict graph {\n" + nodeDotSrcString 
            + edgeDotSrcString + "\n}");
    }

    createAugmentedModeNode(modeNodeId) {
        var modeNodeElem = new Object();
        for (const [id, elem] of this.nodeListModes.entries()) {
            for (var attr in elem) {
                if (attr != "label")
                    modeNodeElem[attr] = elem[attr];
            }
            break;
        }
        modeNodeElem["label"] = modeNodeId.split(delim)[1]
            .slice(1, -1);
        return [modeNodeId, modeNodeElem];
    }


}

function attachListeners(elemList, graph) {
    // console.log(graph);
    // search for all node elements in an svg graph and attach listeners 
    graph.selectAll(".node").selectAll(function() {
        var nodeType = d3.select(this).
            select("title").text().split(delim)[0];

        switch(nodeType) {
            case "group":
                attachGroupNodeListeners(elemList, d3.select(this));
                break;
            case "resource":
                attachResourceNodeListeners(elemList, d3.select(this));
                break;
            case "mode":
                attachModeNodeListeners(elemList, d3.select(this));
                break;
            default:
                // do nothing
        }

    });
}

function attachGroupNodeListeners(elemList, groupNode) {
    var [nodeList, edgeList] = elemList;

    var nodeIdList = [];
    for (node of nodeList)
        nodeIdList.push(node[0]);
    
    // groups and member resources
    groupNode.on("contextmenu", function() {
        var groupId = d3.select(this).select("title").text();
        var memberIds = df.getMemberNodeIdsByGroup(groupId);

        if (df.nodeStatus.get(groupId) == "contextmenu") {
            //console.log("already clicked. Reverting");
            df.nodeStatus.set(groupId, '');
            renderOrgM(
                df.removeNodes(nodeList, memberIds),
                // TODO: how to deal with overlapped groups?
                df.removeEdges(edgeList, memberIds)
            );
        } else {
            //console.log("not clicked. Setting");
            df.nodeStatus.set(groupId, "contextmenu");
            renderOrgM(
                nodeList.concat(df.getResourceNodes(memberIds)),
                df.findEdges(nodeIdList.concat(memberIds))
            );
        }
    });

    // groups and capabilities
    groupNode.on("dblclick", function() {
        var groupId = d3.select(this).select("title").text();

        var capIds = df.getCapabilityNodeIdsByGroup(groupId);
        var firstLevelCapIds = [];
        for (var modeNodeId of capIds) {
            var grandParentNodeId = 
                df.modeTree.getGrandParentNodeFromLeaf(modeNodeId);
            firstLevelCapIds.push(grandParentNodeId);
        }

        if (df.nodeStatus.get(groupId) == "click") {
            //console.log("already clicked. Reverting");
            df.nodeStatus.set(groupId, '');
            renderOrgM(
                df.removeNodes(nodeList, firstLevelCapIds),
                df.removeEdges(edgeList, firstLevelCapIds)
            );
        } else {
            //console.log("not clicked. Setting");
            df.nodeStatus.set(groupId, "click");
            var firstLevelCaps = [];
            var newEdges = [];
            for (var nodeId of firstLevelCapIds) {
                firstLevelCaps.push(
                    df.createAugmentedModeNode(nodeId));
                newEdges.push([groupId, nodeId]);
            }

            renderOrgM(
                nodeList.concat(firstLevelCaps), 
                edgeList.concat(newEdges)
            );
        }
    });
}

function attachResourceNodeListeners(elemList, node) {
    /* do nothing
    node.on("click", function() {
        console.log("Click on a 'resource': " 
            + d3.select(this).select("title").text());
    });
    */
}

// TODO: how to scope to particular resource group?
function attachModeNodeListeners(elemList, modeNode) {
    /*
    node.on("click", function() {
        console.log("Click on a 'mode': " 
            + d3.select(this).select("title").text());
    });
    */
    var [nodeList, edgeList] = elemList;

    var nodeIdList = [];
    for (node of nodeList)
        nodeIdList.push(node[0]);

    modeNode.on("dblclick", function() {
        var modeId = d3.select(this).select("title").text();
        
        var childNodeIds = Array.from(df.modeTree.getChildNodes(modeId));
        //console.log(childNodeIds);
        //
        if (childNodeIds.length > 0) {
            if (df.nodeStatus.get(modeId) == "click") {
                //console.log("already clicked. Reverting");
                df.nodeStatus.set(modeId, '');
                renderOrgM(
                    df.removeNodes(nodeList, childNodeIds),
                    df.removeEdges(edgeList, childNodeIds)
                );
            } else {
                //console.log("not clicked. Setting");
                df.nodeStatus.set(modeId, "click");
                var descendants = [];
                var newEdges = [];
                for (var nodeId of childNodeIds) {
                    descendants.push(
                        df.createAugmentedModeNode(nodeId));
                    newEdges.push([modeId, nodeId]);
                }
                renderOrgM(
                    nodeList.concat(descendants),
                    edgeList.concat(newEdges)
                );
            }

        }
        
    });
    
}

