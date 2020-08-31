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
        for (var resourceNodeId of this.df.getAllResourceNodeIds())
            this.nodeStatusTracker.get("resources").set(resourceNodeId, []);

        this.nodeStatusTracker.set("groups", new Map());
        for (var groupNodeId of this.df.getAllGroupNodeIds())
            this.nodeStatusTracker.get("groups").set(groupNodeId, []);

        this.nodeStatusTracker.set("modes", new Map());
        for (var modeNodeId of this.df.getAllModeNodeIds()) {
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
        var self = this;

        var allGroupNodes = self.df.getGroupNodes(
            self.df.getAllGroupNodeIds());

        var allFirstLevelModeNodes = [];
        for (var modeNodeId of self.df.getAllModeNodeIds()) {
            var grandParentNodeId = self.df.modeTree
                .getGrandParentNodeFromLeaf(modeNodeId);
            allFirstLevelModeNodes.push(self.df.createAugmentedModeNode(
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
            timer = setTimeout(function() {
                if (!prevent) {
                    var memberIds = self.df
                        .getMemberNodeIdsByGroup(groupNodeId);

                    var status = self.nodeStatusTracker.get("groups")
                        .get(groupNodeId).indexOf("click");
                    if (status == -1) {
                        //console.log("not clicked. Setting");
                        self.nodeStatusTracker.get("groups")
                            .get(groupNodeId).push("click");
                        self.sc.toggleGroupInfo(groupNodeId);

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
                        self.nodeStatusTracker.get("groups")
                            .get(groupNodeId).splice(status, 1);
                        if (self.nodeStatusTracker.get("groups")
                            .get(groupNodeId).length == 0)
                            self.sc.toggleGroupInfo();

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

            var capIds = self.df.getCapabilityNodeIdsByGroup(groupNodeId);

            var allFirstLevelCapIds = new Set();
            for (var modeNodeId of self.df.getAllModeNodeIds()) {
                var grandParentNodeId = self.df.modeTree
                    .getGrandParentNodeFromLeaf(modeNodeId);
                allFirstLevelCapIds.add(grandParentNodeId);
            }
            allFirstLevelCapIds = Array.from(allFirstLevelCapIds);

            var status = self.nodeStatusTracker.get("groups")
                .get(groupNodeId).indexOf("dblclick");
            if (status == -1) {
                //console.log("not clicked. Setting");

                // switch focus: there can only be one group under focus

                // remove all highlights
                var newNodeList = self.highlightModeNodesById(nodeList,
                    null, false);
                newNodeList = self.highlightGroupNodebyId(newNodeList,
                    null, false);
                // remove all edges to caps
                var newEdgeList = self.df.removeEdges(edgeList,
                    self.nodeStatusTracker.get("focus"), 
                    allFirstLevelCapIds);

                // highlight current focus
                self.sc.toggleGroupInfo(groupNodeId);

                // remove all interaction markings from other nodes
                self.nodeStatusTracker.set("focus", groupNodeId);
                self.nodeStatusTracker.get("groups").forEach(
                    function(statusList, id, map) {
                        if (id == groupNodeId)
                            statusList.push("dblclick");
                        else
                            statusList.splice("dblclick", 1);
                });

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
                    newEdgeList.concat(newEdges)
                );
            } else {
                //console.log("already clicked. Reverting");
                // remove focus
                self.nodeStatusTracker.set("focus", null);
                // remove interaction marking
                self.nodeStatusTracker.get("groups")
                    .get(groupNodeId).splice(status, 1);
                if (self.nodeStatusTracker.get("groups")
                    .get(groupNodeId).length == 0)
                    self.sc.toggleGroupInfo();

                var allChildNodeIds = new Set();
                for (var firstLevelCapId of allFirstLevelCapIds) {
                    for (var child of 
                        self.df.modeTree.getChildNodes(firstLevelCapId, true))
                        allChildNodeIds.add(child);
                }
                allChildNodeIds = Array.from(allChildNodeIds);

                // remove all highlights on modes related to the group
                var newNodeList = self.highlightModeNodesById(
                    //self.df.removeNodes(nodeList, allChildNodeIds),
                    nodeList,
                    null, false);
                newNodeList = self.highlightGroupNodebyId(newNodeList, 
                    groupNodeId, false);

                var newEdgeList = self.df.removeEdges(edgeList,
                    groupNodeId, allFirstLevelCapIds);

                renderOrgM(
                    newNodeList,
                    newEdgeList
                );
                renderProcM();
                renderLDMemContr();
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
                    self.sc.toggleModeInfo();

                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).splice(status, 1);
                    renderOrgM(
                        self.df.removeNodes(nodeList, 
                            self.df.modeTree.getChildNodes(modeNodeId, true)),
                        self.df.removeEdges(edgeList,
                            self.df.modeTree.getChildNodes(modeNodeId, true))
                    );
                    renderProcM();
                    renderLDMemContr();
                }
            } else if (self.df.modeTree.getNodeLevel(modeNodeId) == 2) {
                // dblclick on second level execution modes
                var status = self.nodeStatusTracker.get("modes")
                    .get(modeNodeId).indexOf("dblclick");

                if (status == -1) {
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

                    // render process model with activity highlighted
                    renderProcM();
                    var [ct, x, tt] = self.df.modeTree.parseModeTriple(modeNodeId);

                    var atsHighlighted = [];
                    for (var childNodeId of childNodeIds) {
                        if (capIds != null && capIds.includes(childNodeId)) {
                            atsHighlighted.push(
                                self.df.modeTree.parseModeTriple(childNodeId)[1]
                            );
                        }
                    }

                    d3.request("/visualize_process_model") 
                        .header("Content-Type", "application/json")
                        .on("error", function(error) {
                            // TODO: toggle the modal for notification
                            console.log("error occured when visualize" +
                                "process model");
                            /*
                            toggleModal(
                                "Error occured",
                                "Unable to build process model visualization."
                            );
                            */
                        })
                        .on("load", function(xhr) {
                            var respData = JSON.parse(xhr.response);
                            renderProcM(
                                respData["dotsrc"],
                                respData["hl_activities"]
                            );
                        })
                        .post(JSON.stringify({
                            "case_type": ct,
                            "activity_types": atsHighlighted.join(','),
                            "time_type": tt
                        }));

                } else {
                    //console.log("already clicked. Reverting");
                    self.sc.toggleModeTT();
                    self.sc.toggleModeAT();
                    self.sc.toggleModeInfo();

                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).splice(status, 1);
                    renderOrgM(
                        self.df.removeNodes(nodeList, 
                            self.df.modeTree.getChildNodes(modeNodeId, true)),
                        self.df.removeEdges(edgeList,
                            self.df.modeTree.getChildNodes(modeNodeId, true))
                    );
                    renderProcM();
                    renderLDMemContr();
                }

            } else if (self.df.modeTree.getNodeLevel(modeNodeId) == 3) {
                // dblclick on third level execution modes
                var status = self.nodeStatusTracker.get("modes")
                    .get(modeNodeId).indexOf("dblclick");

                if (status == -1) {
                    //console.log("not clicked. Setting");
                    self.sc.toggleModeAT(modeNodeName);
                    self.sc.toggleModeInfo(modeNodeId);

                    self.nodeStatusTracker.get("modes")
                        .get(modeNodeId).push("dblclick");

                    var [ct, at, tt] = self.df.modeTree.parseModeTriple(modeNodeId);

                    var currentGroup = self.nodeStatusTracker.get("focus");
                    d3.request("/query_mode_event_number")
                        .header("Content-Type", "application/json")
                        .response(function(xhr) {
                            var respData = JSON.parse(xhr.response);

                            $("#ld-mode-events-num > .score-card-val").text(
                                respData["mode_event_number"]
                            );
                            if (respData.hasOwnProperty("mode_group_event_number")) {
                                $("#ld-mode-group-events-num > .score-card-val").text(
                                    respData["mode_group_event_number"]
                                );
                            } else {
                                $("#ld-mode-group-events-num > .score-card-val").text(
                                    '-'
                                );
                            }
                        })
                        .post(JSON.stringify({
                            "case_type": ct,
                            "activity_type": at,
                            "time_type": tt,
                            "group_id": currentGroup == null ?
                                null : currentGroup.split(delim)[1]
                        }));
                    d3.request("/query_local_diagnostic_measures")
                        .header("Content-Type", "application/json")
                        .response(function(xhr) {
                            var respData = JSON.parse(xhr.response);
                            
                            $("#ld-relative-focus > .score-card-val").text(
                                respData["group_relative_focus"].toFixed(3)
                            );
                            $("#ld-relative-stake > .score-card-val").text(
                                respData["group_relative_stake"].toFixed(3)
                            );
                            $("#ld-coverage > .score-card-val").text(
                                respData["group_coverage"].toFixed(3)
                            );
                            renderLDMemContr(
                                respData["group_member_contribution"]
                            );
                        })
                        .post(JSON.stringify({
                            "case_type": ct,
                            "activity_type": at,
                            "time_type": tt,
                            "group_id": currentGroup == null ?
                                null : currentGroup.split(delim)[1]
                        }));
                            
                } else {
                    //console.log("already clicked. Reverting");
                    //self.sc.toggleModeAT();
                    //self.sc.toggleModeInfo();

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
    constructor(df) {
        // check existence
        if (!!ScoreCard.instance)
            return ScoreCard.instance;
        ScoreCard.instance = this;

        this.df = df;
    }

    toggleGroupInfo(groupNodeId) {
        var self = this;

        if (groupNodeId == null) {
            $("#ld-group-name > .score-card-val").text('-');
            $("#ld-group-mem-num > .score-card-val").text('-');
            $("#ld-group-cap-num > .score-card-val").text('-');
            $("#ld-group-events-num > .score-card-val").text('-');
            $("#ld-mode-group-events-num > .score-card-val").text('-');
            $("#ld-relative-focus > .score-card-val").text('-');
            $("#ld-relative-stake > .score-card-val").text('-');
            $("#ld-coverage > .score-card-val").text('-');
        } else {
            $("#ld-group-name > .score-card-val").text(
                self.df.nodeListGroups.get(groupNodeId)["label"]
            );
            $("#ld-group-mem-num > .score-card-val").text(
                self.df.getMemberNodeIdsByGroup(groupNodeId).length
            );
            $("#ld-group-cap-num > .score-card-val").text(
                self.df.getNumCapabilitiesByGroup(groupNodeId)
            );
            d3.request("/query_group_event_number")
                .header("Content-Type", "application/json")
                .response(function(xhr) {
                    $("#ld-group-events-num > .score-card-val").text(
                        xhr.responseText
                    );
                })
                .post(JSON.stringify({
                    "group_id": groupNodeId.split(delim)[1]
                }));
        }
    }

    toggleModeInfo(modeNodeId) {
        var self = this;

        if (modeNodeId == null) {
            $("#ld-mode-events-num > .score-card-val").text('-');
            $("#ld-mode-group-events-num > .score-card-val").text('-');
            $("#ld-mode-group-num > .score-card-val").text('-');
        } else {
            $("#ld-mode-group-num > .score-card-val").text(
                self.df.getGroupNodeIdsByMode(modeNodeId).length
            );
        }
    }

    toggleModeCT(typeName) {
        if (typeName == null) {
            $("#ld-mode-ct > .score-card-val").text('-');
        } else {
            var typeName = typeName.split(',')[0];
            $("#ld-mode-ct > .score-card-val").text(typeName);
        }
    }

    toggleModeAT(typeName) {
        if (typeName == null) {
            $("#ld-mode-at > .score-card-val").text('-');
        } else {
            var typeName = typeName.split(',')[1];
            $("#ld-mode-at > .score-card-val").text(typeName);
        }
    }

    toggleModeTT(typeName) {
        if (typeName == null) {
            $("#ld-mode-tt > .score-card-val").text('-');
        } else {
            var typeName = typeName.split(',')[2];
            $("#ld-mode-tt > .score-card-val").text(typeName);
        }
    }
}

