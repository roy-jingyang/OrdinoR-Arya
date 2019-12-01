/***********************************************************************/
// class for handling all interactions
// singleton class
class Waiter {
    constructor(df) {
        // check existence
        if (!!Waiter.instance)
            return Waiter.instance;
        Waiter.instance = this;

        this.df = df;

        this.nodeStatusTracker = new Map();

        this.nodeStatusTracker.set("focus", null);

        this.nodeStatusTracker.set("resources", new Map());
        for (var resourceNodeId of df.getAllResourceNodeIds())
            this.nodeStatusTracker.get("resources").set(resourceNodeId, []);

        this.nodeStatusTracker.set("groups", new Map());
        for (var groupNodeId of df.getAllGroupNodeIds())
            this.nodeStatusTracker.get("groups").set(groupNodeId, []);

        this.nodeStatusTracker.set("modes", new Map());
        for (var modeNodeId of df.getAllModeNodeIds()) {
            this.nodeStatusTracker.get("modes").set(modeNodeId, []);
            var parentNodeId = this.df.modeTree
                .getParentNodeFromLeaf(modeNodeId);
            if (!this.nodeStatusTracker.has(parentNodeId))
                this.nodeStatusTracker.get("modes").set(parentNodeId, []);
            var grandParentNodeId = this.df.modeTree
                .getGrandParentNodeFromLeaf(modeNodeId);
            if (!this.nodeStatusTracker.has(grandParentNodeId))
                this.nodeStatusTracker.get("modes").set(grandParentNodeId, []);
        }
    }

    highlightNodesById(nodeList, nbunch, flag) {
        var newNodeList = [];
        nodeList.forEach(function(node) {
            if (flag == true) {
                if (nbunch.includes(node[0])) {
                    var dressedNode = Object.assign({}, node[1]);
                    dressedNode["_highlight"] = true;
                    newNodeList.push([node[0], dressedNode]);
                } else {
                    newNodeList.push(node);
                }
            } else {
                if (node[1]["_highlight"] != undefined) {
                    var unDressedNode = Object.assign({}, node[1]);
                    delete unDressedNode["_highlight"];
                    newNodeList.push([node[0], unDressedNode]);
                } else {
                    newNodeList.push(node);
                }
            }
        });
        return newNodeList;
    }

    resetToInit() {
        var allGroupNodes = df.getGroupNodes(df.getAllGroupNodeIds());

        var allFirstLevelModeNodes = [];
        for (var modeNodeId of df.getAllModeNodeIds()) {
            var grandParentNodeId = df.modeTree
                .getGrandParentNodeFromLeaf(modeNodeId);
            allFirstLevelModeNodes.push(df.createAugmentedModeNode(
                grandParentNodeId));
        }
        var initialNodeList = allGroupNodes.concat(allFirstLevelModeNodes);

        var initialEdgeList = this.df.findEdges(initialNodeList);

        return [initialNodeList, initialEdgeList];

    }

    attachListeners(elemList, graph) {
        var self = this;

        // console.log(graph);
        // search for all node elements in an svg graph and attach listeners 
        graph.selectAll(".node").selectAll(function() {
            var nodeType = d3.select(this).
                select("title").text().split(delim)[0];

            switch(nodeType) {
                case "group":
                    self.attachGroupNodeListeners(
                        elemList, d3.select(this));
                    break;
                case "resource":
                    self.attachResourceNodeListeners(
                        elemList, d3.select(this));
                    break;
                case "mode":
                    self.attachModeNodeListeners(
                        elemList, d3.select(this));
                    break;
                default:
                    // do nothing
            }

        });

    }

    attachGroupNodeListeners(elemList, groupNode) {
        var self = this;

        var [nodeList, edgeList] = elemList;

        var nodeIdList = [];
        for (var node of nodeList)
            nodeIdList.push(node[0]);
        
        // groups and member resources
        groupNode.on("contextmenu", function() {
            var groupNodeId = d3.select(this).select("title").text();

            var memberIds = self.df.getMemberNodeIdsByGroup(groupNodeId);

            var status = self.nodeStatusTracker.get("groups")
                .get(groupNodeId).indexOf("contextmenu");
            if (status == -1) {
                //console.log("not clicked. Setting");
                self.nodeStatusTracker.set("focus", groupNodeId);
                self.nodeStatusTracker.get("groups")
                    .get(groupNodeId).push("contextmenu");
                var newEdges = [];
                for (var nodeId of memberIds) {
                    newEdges.push([nodeId, groupNodeId]);
                }

                renderOrgM(
                    nodeList.concat(self.df.getResourceNodes(memberIds)),
                    edgeList.concat(newEdges)
                );
            } else {
                //console.log("already clicked. Reverting");
                self.nodeStatusTracker.set("focus", null);
                self.nodeStatusTracker.get("groups")
                    .get(groupNodeId).splice(status, 1);

                renderOrgM(
                    self.df.removeNodes(nodeList, memberIds),
                    // TODO: how to deal with overlapped groups?
                    self.df.removeEdges(edgeList, memberIds)
                );
            }
        });

        // groups and capabilities
        groupNode.on("dblclick", function() {
            var groupNodeId = d3.select(this).select("title").text();

            var capIds = self.df.getCapabilityNodeIdsByGroup(groupNodeId);

            var allFirstLevelCapIds = new Set();
            for (var modeNodeId of df.getAllModeNodeIds()) {
                var grandParentNodeId = df.modeTree
                    .getGrandParentNodeFromLeaf(modeNodeId);
                allFirstLevelCapIds.add(grandParentNodeId);
            }

            var status = self.nodeStatusTracker.get("groups")
                .get(groupNodeId).indexOf("dblclick");
            if (status == -1) {
                //console.log("not clicked. Setting");
                self.nodeStatusTracker.set("focus", groupNodeId);
                self.nodeStatusTracker.get("groups")
                    .get(groupNodeId).push("dblclick");

                var allFirstLevelCaps = [];
                var newEdges = [];
                for (var nodeId of allFirstLevelCapIds) {
                    self.nodeStatusTracker.get("modes")
                        .set(nodeId, []);
                    allFirstLevelCaps.push(
                        self.df.createAugmentedModeNode(nodeId));
                    if (capIds.indexOf(nodeId) != -1)
                        newEdges.push([groupNodeId, nodeId]);
                }

                renderOrgM(
                    self.highlightNodesById(
                        nodeList.concat(allFirstLevelCaps), 
                        capIds, true),
                    edgeList.concat(newEdges)
                );
            } else {
                //console.log("already clicked. Reverting");
                self.nodeStatusTracker.set("focus", null);
                self.nodeStatusTracker.get("groups")
                    .get(groupNodeId).splice(status, 1);

                var allChildNodeIds = new Set();
                for (var firstLevelCapId of allFirstLevelCapIds) {
                    for (var child of 
                        self.df.modeTree.getChildNodes(firstLevelCapId, true))
                        allChildNodeIds.add(child);
                }
                allChildNodeIds = Array.from(allChildNodeIds);

                renderOrgM(
                    self.highlightNodesById(
                        self.df.removeNodes(nodeList, allChildNodeIds),
                        null, false),
                    []
                );
            }
        });
    }

    attachResourceNodeListeners(elemList, node) {
        /* do nothing
        node.on("click", function() {
            console.log("Click on a 'resource': " 
                + d3.select(this).select("title").text());
        });
        */
    }

    // TODO: how to scope to particular resource group?
    attachModeNodeListeners(elemList, modeNode) {
        var self = this;

        var [nodeList, edgeList] = elemList;

        var nodeIdList = [];
        for (var node of nodeList)
            nodeIdList.push(node[0]);

        modeNode.on("dblclick", function() {
            var modeNodeId = d3.select(this).select("title").text();
            
            var childNodeIds = self.df.modeTree.getChildNodes(modeNodeId);
            //var childNodeCapIds = ;
            //console.log(childNodeIds);

            if (childNodeIds.length > 0) {
                var status = self.nodeStatusTracker.get("modes")
                    .get(modeNodeId).indexOf("dblclick");

                var currentGroup = self.nodeStatusTracker.get("focus");
                var capIds = (currentGroup == null ? 
                    null : self.df.getCapabilityNodeIdsByGroup(currentGroup));

                if (status == -1) {
                    //console.log("not clicked. Setting");
                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).push("dblclick");

                    var descendants = [];
                    var newEdges = [];
                    for (var nodeId of childNodeIds) {
                        self.nodeStatusTracker.get("modes")
                            .set(nodeId, []);
                        descendants.push(
                            self.df.createAugmentedModeNode(nodeId));
                        newEdges.push([modeNodeId, nodeId]);
                    }
                    renderOrgM(
                        self.highlightNodesById(
                            nodeList.concat(descendants),
                            capIds, true ? capIds != null : false),
                        edgeList.concat(newEdges)
                    );
                } else {
                    //console.log("already clicked. Reverting");
                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).splice(status, 1);
                    renderOrgM(
                        self.df.removeNodes(nodeList, 
                            self.df.modeTree.getChildNodes(modeNodeId, true)),
                        self.df.removeEdges(edgeList,
                            self.df.modeTree.getChildNodes(modeNodeId, true))
                    );
                }
            }
            
        });
        
    }

}

