"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consoleLogger = consoleLogger;
function consoleLogger(verbose) {
    return {
        log(...params) {
            if (verbose) {
                console.log(`[${new Date().toISOString()}]`, ...params);
            }
        },
        warn(...params) {
            if (verbose) {
                console.warn(`[${new Date().toISOString()}]`, ...params);
            }
        },
        error(...params) {
            console.error(`[${new Date().toISOString()}]`, ...params);
        },
    };
}
