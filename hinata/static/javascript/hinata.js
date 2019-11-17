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
            }
            else if (elem["_type"] == "node" && elem["_class"] == "resource") {
                this.nodeListResources.set(id, elem);
            }
            else if (elem["_type"] == "node" && elem["_class"] == "mode") {
                this.nodeListModes.set(id, elem);
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
                elems.push(this.nodeListGroups.get(id)); 
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
                elems.push(this.nodeListResources.get(id)); 
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
                elems.push(this.nodeListModes.get(id)); 
            }
        }
        return elems;
    }

    getMemberNodesByGroup(groupNodeId) {
        const members = this.edgeListGroupsResources.get(groupNodeId);
        return members;
    }

    getCapabilityNodesByGroup(groupNodeId) {
        const caps = this.edgeListGroupsModes.get(groupNodeId);
        return caps;
    }

    getGroupNodesByResource(resourceNodeId) {
        const groups = this.edgeListGroupsResources.get(resourceNodeId);
        return groups;
    }

    getGroupNodesByMode(modeNodeId) {
        const groups = this.edgeListGroupsModes.get(modeNodeId);
        return groups;
    }

    compileDotString(nodeIdList) {
        var nodeList = this.getGroupNodes(nodeIdList).concat(
            this.getResourceNodes(nodeIdList),
            this.getModeNodes(nodeIdList));

    }

}

