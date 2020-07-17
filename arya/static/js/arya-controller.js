/***********************************************************************/
// class for handling all interactions
// singleton class
class Waiter {
    constructor(df, sc) {
        // check existence
        if (!!Waiter.instance)
            return Waiter.instance;
        Waiter.instance = this;

        this.df = df;
        this.sc = sc;

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

    highlightModeNodesById(nodeList, modeIdBunch, flag) {
        var newNodeList = [];
        nodeList.forEach(function(node) {
            if (flag == true) {
                if (modeIdBunch.includes(node[0])) {
                    var dressedNode = Object.assign({}, node[1]);
                    dressedNode["_highlightmode"] = true;
                    newNodeList.push([node[0], dressedNode]);
                } else {
                    newNodeList.push(node);
                }
            } else {
                if (node[1]["_highlightmode"] != undefined) {
                    var unDressedNode = Object.assign({}, node[1]);
                    delete unDressedNode["_highlightmode"];
                    newNodeList.push([node[0], unDressedNode]);
                } else {
                    newNodeList.push(node);
                }
            }
        });
        return newNodeList;
    }

    highlightGroupNodebyId(nodeList, groupId, flag) {
        var newNodeList = [];
        nodeList.forEach(function(node) {
            if (flag == true) {
                if (groupId == node[0]) {
                    var dressedNode = Object.assign({}, node[1]);
                    dressedNode["_highlightgroup"] = true;
                    newNodeList.push([node[0], dressedNode]);
                } else {
                    newNodeList.push(node);
                }
            } else {
                if (node[1]["_highlightgroup"] != undefined) {
                    var unDressedNode = Object.assign({}, node[1]);
                    delete unDressedNode["_highlightgroup"];
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

        var initialEdgeList = [];

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
            var groupNodeName = d3.select(this).select("text").text();
            timer = setTimeout(function() {
                if (!prevent) {
                    var memberIds = self.df
                        .getMemberNodeIdsByGroup(groupNodeId);

                    var status = self.nodeStatusTracker.get("groups")
                        .get(groupNodeId).indexOf("click");
                    if (status == -1) {
                        //console.log("not clicked. Setting");
                        self.sc.toggleGroupName(groupNodeName);

                        self.nodeStatusTracker.get("groups")
                            .get(groupNodeId).push("click");
                        var newEdges = [];
                        for (var nodeId of memberIds) {
                            self.nodeStatusTracker.get("resources")
                                .get(nodeId).push(groupNodeId);
                            newEdges.push([
                                [nodeId, groupNodeId], 
                                Object.assign(
                                    {color: "gold"},
                                    self.df.getEdgeAttr(nodeId, groupNodeId)
                                )]);
                        }

                        renderOrgM(
                            nodeList.concat(self.df
                                .getResourceNodes(memberIds)),
                            edgeList.concat(newEdges)
                        );
                    } else {
                        //console.log("already clicked. Reverting");
                        self.sc.toggleGroupName();

                        self.nodeStatusTracker.get("groups")
                            .get(groupNodeId).splice(status, 1);
                        for (var nodeId of memberIds) {
                            self.nodeStatusTracker.get("resources")
                                .get(nodeId).splice(groupNodeId, 1);
                        }

                        var nonOverlapMemberIds = Array.from(
                            self.nodeStatusTracker.get("resources").keys())
                            .filter(resId => 
                                self.nodeStatusTracker.get("resources")
                                .get(resId).length == 0);


                        renderOrgM(
                            self.df.removeNodes(nodeList, nonOverlapMemberIds),
                            self.df.removeEdges(edgeList, nonOverlapMemberIds)
                        );
                    }
                }
                prevent = false;
            }, 750);
        });

        // groups and capabilities
        groupNode.on("dblclick", function() {
            clearTimeout(timer);
            prevent = true;

            var groupNodeId = d3.select(this).select("title").text();
            var groupNodeName = d3.select(this).select("text").text();

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
                self.sc.toggleGroupName(groupNodeName);

                self.nodeStatusTracker.set("focus", groupNodeId);

                // switch focus: there can only be one
                // remove all interaction markings from other nodes
                self.nodeStatusTracker.get("groups").forEach(
                    function(statusList, id, map) {
                        if (id == groupNodeId)
                            statusList.push("dblclick");
                        else
                            statusList.splice("dblclick", 1);
                });
                // remove all highlights
                var newNodeList = self.highlightModeNodesById(nodeList,
                    null, false);
                newNodeList = self.highlightGroupNodebyId(newNodeList,
                    null, false);
                // highlight current focus
                newNodeList = self.highlightGroupNodebyId(newNodeList,
                    groupNodeId, true);
                
                var allFirstLevelCaps = [];
                var newEdges = [];
                for (var nodeId of allFirstLevelCapIds) {
                    //self.nodeStatusTracker.get("modes").set(nodeId, []);
                    allFirstLevelCaps.push(
                        self.df.createAugmentedModeNode(nodeId));
                    if (capIds.indexOf(nodeId) != -1)
                        newEdges.push([
                            [groupNodeId, nodeId], 
                            {color: "cadetblue1"},
                        ]);
                }
                
                // highlight related capabilities
                newNodeList = self.highlightModeNodesById(
                    newNodeList.concat(allFirstLevelCaps), capIds, true);

                renderOrgM(
                    newNodeList,
                    edgeList.concat(newEdges)
                );
            } else {
                //console.log("already clicked. Reverting");
                self.sc.toggleGroupName();

                // remove focus
                self.nodeStatusTracker.set("focus", null);
                // remove interaction marking
                self.nodeStatusTracker.get("groups")
                    .get(groupNodeId).splice(status, 1);

                var allChildNodeIds = new Set();
                for (var firstLevelCapId of allFirstLevelCapIds) {
                    for (var child of 
                        self.df.modeTree.getChildNodes(firstLevelCapId, true))
                        allChildNodeIds.add(child);
                }
                allChildNodeIds = Array.from(allChildNodeIds);

                // remove all highlights
                var newNodeList = self.highlightModeNodesById(
                    //self.df.removeNodes(nodeList, allChildNodeIds),
                    nodeList,
                    null, false);
                newNodeList = self.highlightGroupNodebyId(newNodeList, 
                    groupNodeId, false);

                var newEdgeList = edgeList;
                //var newEdgeList = self.df.removeEdges(edgeList,
                //    allChildNodeIds);
                //newEdgeList = self.df.removeEdges(newEdgeList,
                //    groupNodeId, allFirstLevelCapIds);

                renderOrgM(
                    newNodeList,
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
            var modeNodeName = d3.select(this).select("text").text();
            var currentGroup = self.nodeStatusTracker.get("focus");
            var capIds = (currentGroup == null ? 
                null : self.df.getCapabilityNodeIdsByGroup(currentGroup));
            var childNodeIds = self.df.modeTree.getChildNodes(modeNodeId);
            
            if (self.df.modeTree.getNodeLevel(modeNodeId) == 1) {
                // dblclick on first level execution modes
                var status = self.nodeStatusTracker.get("modes")
                    .get(modeNodeId).indexOf("dblclick");

                if (status == -1) {
                    //console.log("not clicked. Setting");
                    self.sc.toggleModeCT(modeNodeName);

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
                        self.highlightModeNodesById(
                            nodeList.concat(descendants),
                            capIds, (capIds != null)),
                        edgeList.concat(newEdges)
                    );
                } else {
                    //console.log("already clicked. Reverting");
                    self.sc.toggleModeCT();
                    self.sc.toggleModeAT();
                    self.sc.toggleModeTT();

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
                // dblclick on second level execution modes
                var status = self.nodeStatusTracker.get("modes")
                    .get(modeNodeId).indexOf("dblclick");

                if (status == -1) {
                    renderProcMDot(null);

                    //console.log("not clicked. Setting");
                    self.sc.toggleModeTT(modeNodeName);

                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).push("dblclick");

                    // expand and show descendants
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
                        self.highlightModeNodesById(
                            nodeList.concat(descendants),
                            capIds, (capIds != null)),
                        edgeList.concat(newEdges)
                    );

                    // render process model with activity nodes highlighted
                    var [ct, x, tt] = self.df.modeTree.parseModeTriple(modeNodeId);

                    ct = ct == '' ? 'None' : ct;
                    var atsHighlighted = [];
                    for (var childNodeId of childNodeIds) {
                        if (capIds != null && capIds.includes(childNodeId)) {
                            atsHighlighted.push(
                                self.df.modeTree.parseModeTriple(childNodeId)[1]);
                        }
                    }

                    alert("Please wait for process model visualization" +
                        " to be refreshed.");
                    
                    var procMTitle = '(' + [ct, x, tt].join(',') + ')';
                    d3.request('./mine_process_model/' 
                        + ct + '/' + atsHighlighted.join(','))
                        .get(function(xhr) {
                        renderProcMDot(xhr.response, procMTitle);
                    });

                    // TODO: add request for displaying local diagnostics
                } else {
                    //console.log("already clicked. Reverting");
                    self.sc.toggleModeTT();
                    self.sc.toggleModeAT();

                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).splice(status, 1);
                    renderOrgM(
                        self.df.removeNodes(nodeList, 
                            self.df.modeTree.getChildNodes(modeNodeId, true)),
                        self.df.removeEdges(edgeList,
                            self.df.modeTree.getChildNodes(modeNodeId, true))
                    );
                }

            } else if (self.df.modeTree.getNodeLevel(modeNodeId) == 3) {
                // dblclick on third level execution modes
                var status = self.nodeStatusTracker.get("modes")
                    .get(modeNodeId).indexOf("dblclick");

                if (status == -1) {
                    //console.log("not clicked. Setting");
                    self.sc.toggleModeAT(modeNodeName);

                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).push("dblclick");
                } else {
                    //console.log("already clicked. Reverting");
                    self.sc.toggleModeAT();

                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).splice(status, 1);
                }
            }
            else {
                // do nothing (out of scope)
            } 
        });
        
    }

}


/***********************************************************************/
// class for handling the display of statistics on the panel
// NOTE: only local diagnostics need to be processed by the class,
//       as global conformance results are fixed once a model is given
// singleton class
class ScoreCard {
    constructor() {
        // check existence
        if (!!ScoreCard.instance)
            return ScoreCard.instance;
        ScoreCard.instance = this;
    }

    toggleGroupName(groupName) {
        if (groupName == null)
            $("#ld-group-name").text('-');
        else
            $("#ld-group-name").text(groupName);
    }

    toggleModeCT(typeName) {
        if (typeName == null) {
            $("#ld-mode-ct").text('-');
        } else {
            var typeName = typeName.split(',')[0];
            $("#ld-mode-ct").text(typeName);
        }
    }

    toggleModeAT(typeName) {
        if (typeName == null) {
            $("#ld-mode-at").text('-');
        } else {
            var typeName = typeName.split(',')[1];
            $("#ld-mode-at").text(typeName);
        }
    }

    toggleModeTT(typeName) {
        if (typeName == null) {
            $("#ld-mode-tt").text('-');
        } else {
            var typeName = typeName.split(',')[2];
            $("#ld-mode-tt").text(typeName);
        }
    }
}

