import {performance} from "perf_hooks";

export class Profiler {
    constructor() {
        this.functionTimings = {};
        this.callCounts = {};
        this.startTimes = {};
        this.callStack = [];
        this.children = {};
        this.enabled = true;
    }

    // Start timing a function
    start(functionName) {
        if (!this.enabled) return;

        // Create the hierarchical name based on the call stack
        let hierarchicalName = functionName;
        if (this.callStack.length > 0) {
            const parent = this.callStack[this.callStack.length - 1];
            hierarchicalName = `${parent} > ${functionName}`;

            // Track parent-child relationships
            if (!this.children[parent]) {
                this.children[parent] = new Set();
            }
            this.children[parent].add(hierarchicalName);
        }

        if (!this.startTimes[hierarchicalName]) {
            this.startTimes[hierarchicalName] = [];
        }

        this.startTimes[hierarchicalName].push(performance.now());
        this.callStack.push(hierarchicalName);
    }

    // End timing a function
    end(functionName) {
        if (!this.enabled || this.callStack.length === 0) return;

        const hierarchicalName = this.callStack.pop();

        // Verify we're ending the correct function
        if (!hierarchicalName.endsWith(functionName)) {
            console.warn(`Profiler: Expected to end "${functionName}", but current function is "${hierarchicalName}"`);
            // Try to find the function in the stack and restore proper state
            const index = this.callStack.findIndex(name => name.endsWith(` > ${functionName}`) || name === functionName);
            if (index >= 0) {
                // Remove all functions up to the found one
                const toEnd = this.callStack.splice(index);
                toEnd.forEach(name => {
                    if (this.startTimes[name] && this.startTimes[name].length > 0) {
                        this.startTimes[name].pop();
                    }
                });
            }
            return;
        }

        if (!this.startTimes[hierarchicalName] || this.startTimes[hierarchicalName].length === 0) {
            console.warn(`Profiler: No start time for "${hierarchicalName}"`);
            return;
        }

        const endTime = performance.now();
        const startTime = this.startTimes[hierarchicalName].pop();
        const duration = endTime - startTime;

        if (!this.functionTimings[hierarchicalName]) {
            this.functionTimings[hierarchicalName] = 0;
            this.callCounts[hierarchicalName] = 0;
        }

        this.functionTimings[hierarchicalName] += duration;
        this.callCounts[hierarchicalName]++;
    }

    // Reset all timings
    reset() {
        this.functionTimings = {};
        this.callCounts = {};
        this.startTimes = {};
        this.callStack = [];
        this.children = {};
    }

    // Build a hierarchical tree from the collected data
    buildHierarchicalTree() {
        const tree = { name: 'root', children: [], totalTimeMs: 0 };

        // Find all top-level functions (those without > in their name)
        const topLevelFunctions = Object.keys(this.functionTimings)
            .filter(name => !name.includes(' > '));

        // For each top-level function, build its subtree
        for (const funcName of topLevelFunctions) {
            if (this.children[funcName]) {
                const node = this._buildSubtree(funcName);
                tree.children.push(node);
                tree.totalTimeMs += node.totalTimeMs;
            } else {
                tree.children.push({
                    name: funcName,
                    totalTimeMs: this.functionTimings[funcName],
                    callCount: this.callCounts[funcName],
                    children: []
                });
                tree.totalTimeMs += this.functionTimings[funcName];
            }
        }

        return tree;
    }

    // Helper to build a subtree for a function
    _buildSubtree(funcName) {
        const childrenSet = this.children[funcName] || new Set();
        const children = Array.from(childrenSet);

        const node = {
            name: funcName,
            totalTimeMs: this.functionTimings[funcName],
            callCount: this.callCounts[funcName],
            children: []
        };

        for (const childName of children) {
            if (this.children[childName]) {
                const childNode = this._buildSubtree(childName);
                node.children.push(childNode);
            } else {
                node.children.push({
                    name: childName,
                    totalTimeMs: this.functionTimings[childName],
                    callCount: this.callCounts[childName],
                    children: []
                });
            }
        }

        return node;
    }

    // Generate a report of all function timings
    generateReport(totalTime) {
        const report = {
            totalTimeMs: totalTime,
            functions: {},
            hierarchicalTree: this.buildHierarchicalTree()
        };

        // Sort functions by total time (descending)
        const sortedFunctions = Object.keys(this.functionTimings).sort(
            (a, b) => this.functionTimings[b] - this.functionTimings[a]
        );

        for (const functionName of sortedFunctions) {
            const timeMs = this.functionTimings[functionName];
            const calls = this.callCounts[functionName];
            const percentageOfTotal = (timeMs / totalTime) * 100;
            const avgTimePerCall = timeMs / calls;

            // Extract parent-child relationship for UI display
            let displayName = functionName;
            let parentName = null;
            if (functionName.includes(' > ')) {
                const parts = functionName.split(' > ');
                displayName = parts.pop(); // Last part is the function name
                parentName = parts.join(' > '); // Rest is the parent path
            }

            report.functions[functionName] = {
                totalTimeMs: timeMs,
                callCount: calls,
                percentageOfTotal: percentageOfTotal.toFixed(2),
                avgTimePerCallMs: avgTimePerCall.toFixed(3),
                displayName,
                parentName
            };
        }

        return report;
    }
}
