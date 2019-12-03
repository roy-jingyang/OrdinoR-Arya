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

    attachSVGListeners(elemList, graph) {
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
        var timer = 0;
        var prevent = false;
        groupNode.on("click", function() {
            var groupNodeId = d3.select(this).select("title").text();
            timer = setTimeout(function() {
                if (!prevent) {
                    var memberIds = self.df
                        .getMemberNodeIdsByGroup(groupNodeId);

                    var status = self.nodeStatusTracker.get("groups")
                        .get(groupNodeId).indexOf("click");
                    if (status == -1) {
                        //console.log("not clicked. Setting");
                        self.nodeStatusTracker.set("focus", groupNodeId);
                        self.nodeStatusTracker.get("groups")
                            .get(groupNodeId).push("click");
                        var newEdges = [];
                        for (var nodeId of memberIds) {
                            newEdges.push([[nodeId, groupNodeId], {}]);
                        }

                        renderOrgM(
                            nodeList.concat(self.df
                                .getResourceNodes(memberIds)),
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
                }
                prevent = false;
            }, 800);
        });

        // groups and capabilities
        groupNode.on("dblclick", function() {
            clearTimeout(timer);
            prevent = true;

            var groupNodeId = d3.select(this).select("title").text();

            var capIds = self.df.getCapabilityNodeIdsByGroup(groupNodeId);

            var allFirstLevelCapIds = new Set();
            for (var modeNodeId of df.getAllModeNodeIds()) {
                var grandParentNodeId = df.modeTree
                    .getGrandParentNodeFromLeaf(modeNodeId);
                allFirstLevelCapIds.add(grandParentNodeId);
            }
            allFirstLevelCapIds = Array.from(allFirstLevelCapIds);

            var status = self.nodeStatusTracker.get("groups")
                .get(groupNodeId).indexOf("dblclick");
            if (status == -1) {
                //console.log("not clicked. Setting");
                self.nodeStatusTracker.set("focus", groupNodeId);

                // broadcasting changes: there can only be one focus
                self.nodeStatusTracker.get("groups").forEach(
                    function(statusList, id, map) {
                        if (id == groupNodeId) {
                            statusList.push("dblclick");
                        } else {
                            statusList.splice(status, 1);
                        }
                });
                
                // TODO: how to switch focus?

                var allFirstLevelCaps = [];
                var newEdges = [];
                for (var nodeId of allFirstLevelCapIds) {
                    self.nodeStatusTracker.get("modes")
                        .set(nodeId, []);
                    allFirstLevelCaps.push(
                        self.df.createAugmentedModeNode(nodeId));
                    if (capIds.indexOf(nodeId) != -1)
                        newEdges.push([[groupNodeId, nodeId], {}]);
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

                var newEdgeList = self.df.removeEdges(edgeList,
                    allChildNodeIds);
                newEdgeList = self.df.removeEdges(newEdgeList,
                    groupNodeId, allFirstLevelCapIds);

                renderOrgM(
                    self.highlightNodesById(
                        self.df.removeNodes(nodeList, allChildNodeIds),
                        null, false),
                    newEdgeList
                );
                renderProcMDot(null);
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

    attachModeNodeListeners(elemList, modeNode) {
        var self = this;

        var [nodeList, edgeList] = elemList;

        var nodeIdList = [];
        for (var node of nodeList)
            nodeIdList.push(node[0]);

        modeNode.on("dblclick", function() {
            var modeNodeId = d3.select(this).select("title").text();
            var currentGroup = self.nodeStatusTracker.get("focus");
            var capIds = (currentGroup == null ? 
                null : self.df.getCapabilityNodeIdsByGroup(currentGroup));
            var childNodeIds = self.df.modeTree.getChildNodes(modeNodeId);
            
            if (self.df.modeTree.getNodeLevel(modeNodeId) < 2) {
                var status = self.nodeStatusTracker.get("modes")
                    .get(modeNodeId).indexOf("dblclick");

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
                        newEdges.push([[modeNodeId, nodeId], {}]);
                    }
                    renderOrgM(
                        self.highlightNodesById(
                            nodeList.concat(descendants),
                            capIds, (capIds != null)),
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
            } else if (self.df.modeTree.getNodeLevel(modeNodeId) == 2) {
                // click on second level execution modes
                var [ct, x, tt] = self.df.modeTree.parseModeTriple(modeNodeId);
                var atsHighlighted = [];
                for (var childNodeId of childNodeIds) {
                    if (capIds != null && capIds.includes(childNodeId)) {
                        atsHighlighted.push(
                            self.df.modeTree.parseModeTriple(childNodeId)[1]);
                    }
                }
                
                renderProcMDot(null);
                alert("Please wait for process model visualization" +
                    " to be refreshed.");
                var procMTitle = '(' + [ct, x, tt].join(',') + ')';
                d3.request('./get_process_model/' 
                    + ct + '/' + atsHighlighted.join(','))
                    .get(function(xhr) {
                    renderProcMDot(xhr.response, procMTitle);
                });
            }
            
        });
        
    }

    attachButtonListeners(allButtons) {
        allButtons.on("click", function(button) {
            switch (this["id"]) {
                case "download_org_m_vis":
                    break;
                case "download_proc_m_vis":
                    break;
                default:
                    // do nothing
            }
        });
    }
}

