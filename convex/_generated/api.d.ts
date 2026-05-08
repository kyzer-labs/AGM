/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admins from "../admins.js";
import type * as candidates from "../candidates.js";
import type * as elections from "../elections.js";
import type * as exports from "../exports.js";
import type * as internal_ from "../internal.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_cycle from "../lib/cycle.js";
import type * as lib_photoUrl from "../lib/photoUrl.js";
import type * as lib_results from "../lib/results.js";
import type * as lib_setup from "../lib/setup.js";
import type * as positions from "../positions.js";
import type * as results from "../results.js";
import type * as rubric from "../rubric.js";
import type * as sessions from "../sessions.js";
import type * as voters from "../voters.js";
import type * as votes from "../votes.js";
import type * as whitelist from "../whitelist.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admins: typeof admins;
  candidates: typeof candidates;
  elections: typeof elections;
  exports: typeof exports;
  internal: typeof internal_;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/cycle": typeof lib_cycle;
  "lib/photoUrl": typeof lib_photoUrl;
  "lib/results": typeof lib_results;
  "lib/setup": typeof lib_setup;
  positions: typeof positions;
  results: typeof results;
  rubric: typeof rubric;
  sessions: typeof sessions;
  voters: typeof voters;
  votes: typeof votes;
  whitelist: typeof whitelist;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
