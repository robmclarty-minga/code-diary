import type { AggregateArgs } from "./types/aggregate.js";
export declare const parseAggregateArgs: (argv: string[]) => AggregateArgs;
export declare const runAggregate: (argv: string[]) => Promise<void>;
