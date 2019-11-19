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
        var trimQuote = function(str) {
            return str.replace(/"/g, '');
        }

        var lines = dotSrcString.split(";\n\t");
        //var strHead = lines[0];
        for (var i = 1; i < lines.length; i++) {
            const [idStr, attrsStr] = lines[i].split('\t ');
            var id = trimQuote(idStr);
            var elem = Object();

            //console.log(idStr);
            //elem["id"] = trimQuote(idStr);
            
            var match = /\[*\]/g.exec(attrsStr);
            if (match) {
                var attrList = attrsStr.slice(1, match.index);
            } else {
                throw "Invalid data";
            }

            for (var key_val of attrList.split(',\n\t\t')) {
                //console.log(key_val.split('='));
                const [key, val] = key_val.split('=');
                elem[key] = trimQuote(val);
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
                return this.getMemberNodeIdsByGroup(nodeUId).
                    includes(nodeVId);
            }
            else if (nodeVId.indexOf("mode") == 0) {
                return (nodeVId in this.getCapabilityNodeIdsByGroup(nodeUId));
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

    // TODO: to be debugged.
    compileDotString(nodeList) {
        // node parts
        var nodeIdList = [];
        var nodeDotSrcString = 'node [style="filled"]\n';
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

function attachListeners(curr, graph) {
    // console.log(graph);
    // search for all node elements in an svg graph and attach listeners 
    graph.selectAll(".node").selectAll(function() {
        var nodeType = d3.select(this).
            select("title").text().split(delim)[0];

        switch(nodeType) {
            case "group":
                attachGroupNodeListeners(curr, d3.select(this));
                break;
            case "resource":
                attachResourceNodeListeners(curr, d3.select(this));
                break;
            case "mode":
                attachModeNodeListeners(curr, d3.select(this));
                break;
            default:
                // do nothing
        }

    });
}

function attachGroupNodeListeners(curr, node) {
    node.on("click", function() {
        var groupId = d3.select(this).select("title").text();

        if (df.nodeStatus.get(groupId) == "clicked") {
            console.log("already clicked. Reverting");
            console.log(groupId);
            df.nodeStatus.set(groupId, '');
            var memberIds = df.getMemberNodeIdsByGroup(groupId);
            renderOrgM(curr.filter(function(value, index, array) {
                return !(memberIds.includes(value[0]));
            }));
        } else {
            console.log("not clicked. Setting");
            df.nodeStatus.set(groupId, "clicked");
            var members = df.getResourceNodes(
                df.getMemberNodeIdsByGroup(groupId));
            renderOrgM(curr.concat(members));
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

