"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const atom_1 = require("atom");
const callbacks_1 = require("./callbacks");
const events_1 = require("events");
const stream_1 = require("stream");
const byline = require("byline");
exports.CommandWithResponse = new Set([
    "compileOnSaveAffectedFileList",
    "compileOnSaveEmitFile",
    "completionEntryDetails",
    "completions",
    "configure",
    "definition",
    "format",
    "occurrences",
    "projectInfo",
    "quickinfo",
    "references",
    "reload",
    "rename",
]);
class TypescriptServiceClient {
    constructor(tsServerPath, version) {
        this.tsServerPath = tsServerPath;
        this.version = version;
        this.events = new events_1.EventEmitter();
        this.seq = 0;
        /** Extra args passed to the tsserver executable */
        this.tsServerArgs = [];
        this.emitPendingRequests = (pending) => {
            this.events.emit("pendingRequestsChange", pending);
        };
        this.onMessage = (res) => {
            if (isResponse(res)) {
                const req = this.callbacks.remove(res.request_seq);
                if (req) {
                    if (window.atom_typescript_debug) {
                        console.log("received response for", res.command, "in", Date.now() - req.started, "ms", "with data", res.body);
                    }
                    if (res.success) {
                        req.resolve(res);
                    }
                    else {
                        req.reject(new Error(res.message));
                    }
                }
                else {
                    console.warn("unexpected response:", res);
                }
            }
            else if (isEvent(res)) {
                if (window.atom_typescript_debug) {
                    console.log("received event", res);
                }
                this.events.emit(res.event, res.body);
            }
        };
        this.callbacks = new callbacks_1.Callbacks(this.emitPendingRequests);
    }
    executeChange(args) {
        return this.execute("change", args);
    }
    executeClose(args) {
        return this.execute("close", args);
    }
    executeCompileOnSaveAffectedFileList(args) {
        return this.execute("compileOnSaveAffectedFileList", args);
    }
    executeCompileOnSaveEmitFile(args) {
        return this.execute("compileOnSaveEmitFile", args);
    }
    executeCompletions(args) {
        return this.execute("completions", args);
    }
    executeCompletionDetails(args) {
        return this.execute("completionEntryDetails", args);
    }
    executeConfigure(args) {
        return this.execute("configure", args);
    }
    executeDefinition(args) {
        return this.execute("definition", args);
    }
    executeFormat(args) {
        return this.execute("format", args);
    }
    executeGetErr(args) {
        return this.execute("geterr", args);
    }
    executeGetErrForProject(args) {
        return this.execute("geterrForProject", args);
    }
    executeOccurances(args) {
        return this.execute("occurrences", args);
    }
    executeOpen(args) {
        return this.execute("open", args);
    }
    executeProjectInfo(args) {
        return this.execute("projectInfo", args);
    }
    executeQuickInfo(args) {
        return this.execute("quickinfo", args);
    }
    executeReferences(args) {
        return this.execute("references", args);
    }
    executeReload(args) {
        return this.execute("reload", args);
    }
    executeRename(args) {
        return this.execute("rename", args);
    }
    executeSaveTo(args) {
        return this.execute("saveto", args);
    }
    execute(command, args) {
        return tslib_1.__awaiter(this, void 0, void 0, function* () {
            if (!this.serverPromise) {
                throw new Error("Server is not running");
            }
            return this.sendRequest(yield this.serverPromise, command, args, exports.CommandWithResponse.has(command));
        });
    }
    on(name, listener) {
        this.events.on(name, listener);
        return () => {
            this.events.removeListener(name, listener);
        };
    }
    sendRequest(cp, command, args, expectResponse) {
        const req = {
            seq: this.seq++,
            command,
            arguments: args
        };
        if (window.atom_typescript_debug) {
            console.log("sending request", command, "with args", args);
        }
        setImmediate(() => {
            try {
                cp.stdin.write(JSON.stringify(req) + "\n");
            }
            catch (error) {
                const callback = this.callbacks.remove(req.seq);
                if (callback) {
                    callback.reject(error);
                }
                else {
                    console.error(error);
                }
            }
        });
        if (expectResponse) {
            return this.callbacks.add(req.seq, command);
        }
    }
    startServer() {
        if (!this.serverPromise) {
            this.serverPromise = new Promise((resolve, reject) => {
                if (window.atom_typescript_debug) {
                    console.log("starting", this.tsServerPath);
                }
                const cp = new atom_1.BufferedNodeProcess({
                    command: this.tsServerPath,
                    args: this.tsServerArgs,
                }).process;
                cp.once("error", err => {
                    console.error("tsserver failed with", err);
                    this.callbacks.rejectAll(err);
                    reject(err);
                });
                cp.once("exit", code => {
                    const err = new Error("tsserver: exited with code: " + code);
                    console.error(err);
                    this.callbacks.rejectAll(err);
                    reject(err);
                });
                messageStream(cp.stdout).on("data", this.onMessage);
                cp.stderr.on("data", data => console.warn("tsserver stderr:", data.toString()));
                // We send an unknown command to verify that the server is working.
                this.sendRequest(cp, "ping", null, true).then(res => resolve(cp), err => resolve(cp));
            });
            return this.serverPromise.catch(error => {
                this.serverPromise = undefined;
                throw error;
            });
        }
        else {
            throw new Error(`Server already started: ${this.tsServerPath}`);
        }
    }
}
exports.TypescriptServiceClient = TypescriptServiceClient;
function isEvent(res) {
    return res.type === "event";
}
function isResponse(res) {
    return res.type === "response";
}
function messageStream(input) {
    return input.pipe(byline()).pipe(new MessageStream());
}
/** Helper to parse the tsserver output stream to a message stream  */
class MessageStream extends stream_1.Transform {
    constructor() {
        super({ objectMode: true });
    }
    _transform(buf, encoding, callback) {
        const line = buf.toString();
        try {
            if (line.startsWith("{")) {
                this.push(JSON.parse(line));
            }
            else if (!line.startsWith("Content-Length:")) {
                console.warn(line);
            }
        }
        catch (error) {
            console.error("client: failed to parse: ", line);
        }
        finally {
            callback(null);
        }
    }
}
//# sourceMappingURL=client.js.map