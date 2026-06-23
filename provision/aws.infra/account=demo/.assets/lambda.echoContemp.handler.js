var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// ../../../../../../tmp/tmp.ooU2e3jMT3/handler.ts
var handler_exports = {};
__export(handler_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(handler_exports);
var getIsContempCaller = (payload) => {
  return typeof payload === "object" && payload !== null && "event" in payload && typeof payload.event === "object";
};
var getContempErrorResponse = (error, errorClass) => ({
  error: {
    _serde: "LambdaEndpointError::contemp",
    class: errorClass,
    message: error.message,
    cause: error.cause instanceof Error ? error.cause.message : void 0,
    details: error.details
  }
});
var getAncientErrorResponse = (error, errorType) => ({
  errorMessage: error.message,
  errorType,
  causeMessage: error.cause instanceof Error ? error.cause.message : void 0,
  details: error.details
});
var handler = async (payload) => {
  const isContempCaller = getIsContempCaller(payload);
  const event = isContempCaller ? payload.event : payload;
  try {
    if (event.action === "throwConstraintError") {
      const error = new Error("contemp constraint error");
      error.cause = new Error("cause message");
      error.details = { field: "message" };
      throw Object.assign(error, { name: "ConstraintError" });
    }
    if (event.action === "throwInternalError") {
      throw new Error("contemp internal error");
    }
    return {
      result: `contemp: ${event.message ?? "no message"}`
    };
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    if (error.name === "ConstraintError") {
      if (isContempCaller) {
        return getContempErrorResponse(error, "ConstraintError");
      }
      return getAncientErrorResponse(error, "BadRequestError");
    }
    if (isContempCaller) {
      return getContempErrorResponse(error, "Error");
    }
    return getAncientErrorResponse(error, "Error");
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  handler
});
