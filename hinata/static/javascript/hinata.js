var delim = '/::/';

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
            string = string.slice(0, string.length - 1);
            string += "];\n"
            nodeDotSrcString = nodeDotSrcString.concat(string);
        }

        // edge parts
        var edgeDotSrcString = "";
        if (edgeList === null) {
            var edgeList = this.findEdges(nodeIdList);
        }

        // create edges based on all existing nodes
        for (const [u, v] of this.findEdges(nodeIdList)) {
            edgeDotSrcString = edgeDotSrcString.concat(
                '"' + new String(u) + '"' + 
                " -- " +
                '"' + new String(v) + '";\n');
        }

        return ("strict graph {\n" + nodeDotSrcString 
            + edgeDotSrcString + "\n}");
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

function attachGroupNodeListeners(elemList, node) {
    const [nodeList, edgeList] = elemList;

    node.on("contextmenu", function() {
        var groupId = d3.select(this).select("title").text();
        if (df.nodeStatus.get(groupId) == "contextmenu") {
            //console.log("already clicked. Reverting");
            df.nodeStatus.set(groupId, '');
            var memberIds = df.getMemberNodeIdsByGroup(groupId);
            renderOrgM(
                nodeList.filter(function(value, index, array) {
                    return !(memberIds.includes(value[0]));
                }), 
                null
            );
        } else {
            //console.log("not clicked. Setting");
            df.nodeStatus.set(groupId, "contextmenu");
            var members = df.getResourceNodes(
                df.getMemberNodeIdsByGroup(groupId));
            renderOrgM(nodeList.concat(members), null);
        }
    });

    node.on("dblclick", function() {
        var groupId = d3.select(this).select("title").text();
        if (df.nodeStatus.get(groupId) == "click") {
            //console.log("already clicked. Reverting");
            df.nodeStatus.set(groupId, '');
            var capIds = df.getCapabilityNodeIdsByGroup(groupId);
            renderOrgM(
                nodeList.filter(function(value, index, array) {
                    return !(capIds.includes(value[0]));
                }), 
                null
            );
        } else {
            //console.log("not clicked. Setting");
            df.nodeStatus.set(groupId, "click");
            var caps = df.getModeNodes(
                df.getCapabilityNodeIdsByGroup(groupId));
            renderOrgM(nodeList.concat(caps), null);
        }
    });
}

function attachResourceNodeListeners(node) {
    /*
    node.on("click", function() {
        console.log("Click on a 'resource': " 
            + d3.select(this).select("title").text());
    });
    */
}

function attachModeNodeListeners(node) {
    /*
    node.on("click", function() {
        console.log("Click on a 'mode': " 
            + d3.select(this).select("title").text());
    });
    */
}
// Display all member resources when double-click on a group. -->

// (Revert) Hide all member resources. -->

// Display all related execution modes when click on a group. -->

// (Revert) Hide all related execution modes. -->

// Display all participating groups when click on a resource. -->

