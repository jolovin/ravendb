/// <reference path="../../typings/tsd.d.ts" />

import database = require("models/resources/database");
import appUrl = require("common/appUrl");
import getSingleAuthTokenCommand = require("commands/auth/getSingleAuthTokenCommand");
import messagePublisher = require("common/messagePublisher");
import abstractWebSocketClient = require("common/abstractWebSocketClient");

class liveIndexPerformanceWebSocketClient extends abstractWebSocketClient<Raven.Client.Data.Indexes.IndexPerformanceStats[]> {

    private readonly onData: (data: Raven.Client.Data.Indexes.IndexPerformanceStats[]) => void;

    private isoParser = d3.time.format.iso;

    private mergedData: Raven.Client.Data.Indexes.IndexPerformanceStats[] = [];

    private pendingDataToApply: Raven.Client.Data.Indexes.IndexPerformanceStats[] = [];
    private updatesPaused = false;

    constructor(db: database, onData: (data: Raven.Client.Data.Indexes.IndexPerformanceStats[]) => void) {
        super(db);
        this.onData = onData;
    }

    get connectionDescription() {
        return "Live Indexing Performance";
    }

    protected webSocketUrlFactory(token: singleAuthToken) {
        const connectionString = "singleUseAuthToken=" + token.Token;
        return "/indexes/performance/live?" + connectionString;
    }

    get autoReconnect() {
        return false;
    }

    pauseUpdates() {
        this.updatesPaused = true;
    }

    resumeUpdates() {
        this.updatesPaused = false;

        if (this.pendingDataToApply.length) {
            this.mergeIncomingData(this.pendingDataToApply);
        }
        this.pendingDataToApply = [];
        this.onData(this.mergedData);
    }

    protected onMessage(e: Raven.Client.Data.Indexes.IndexPerformanceStats[]) {
        if (this.updatesPaused) {
            this.pendingDataToApply.push(...e);
        } else {
            this.mergeIncomingData(e);
            this.onData(this.mergedData);
        }
    }

    private mergeIncomingData(e: Raven.Client.Data.Indexes.IndexPerformanceStats[]) {
        e.forEach(incomingIndexStats => {
            const indexName = incomingIndexStats.IndexName;

            let existingIndexStats = this.mergedData.find(x => x.IndexName === indexName);

            if (!existingIndexStats) {
                existingIndexStats = {
                    IndexId: incomingIndexStats.IndexId,
                    IndexName: incomingIndexStats.IndexName,
                    Performance: []
                };
                this.mergedData.push(existingIndexStats);
            }

            const idToIndexCache = new Map<number, number>();
            existingIndexStats.Performance.forEach((v, idx) => {
                idToIndexCache.set(v.Id, idx);
            });

            incomingIndexStats.Performance.forEach(incomingPerf => {

                const withCache = incomingPerf as IndexingPerformanceStatsWithCache;
                withCache.CompletedAsDate = incomingPerf.Completed ? this.isoParser.parse(incomingPerf.Completed) : undefined;
                withCache.StartedAsDate = this.isoParser.parse(incomingPerf.Started)

                if (idToIndexCache.has(incomingPerf.Id)) {
                    // update 
                    const indexToUpdate = idToIndexCache.get(incomingPerf.Id);
                    existingIndexStats.Performance[indexToUpdate] = incomingPerf;
                } else {
                    // this shouldn't invalidate idToIndexCache as we always append only
                    existingIndexStats.Performance.push(incomingPerf);
                }
            });
        });
    }

}

export = liveIndexPerformanceWebSocketClient;
