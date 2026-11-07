const assert = require("assert");

describe("Telemetry & Monitor Error Handling (#1608)", () => {
  let unhandledRejections = [];
  let originalPost;
  let rowyService;

  const rejectionHandler = (reason) => {
    unhandledRejections.push(reason);
  };

  before(() => {
    process.on("unhandledRejection", rejectionHandler);
    rowyService = require("../build/rowyService");
    originalPost = rowyService.telemetryInstance.post;
  });

  after(() => {
    process.removeListener("unhandledRejection", rejectionHandler);
    rowyService.telemetryInstance.post = originalPost;
  });

  beforeEach(() => {
    unhandledRejections = [];
  });

  afterEach(() => {
    rowyService.telemetryInstance.post = originalPost;
  });

  it("handles rowy.events/monitor rejection (TLS error) gracefully without throwing or crashing", async () => {
    // Simulate TLS handshake failure / connection reset as reported in #1608
    rowyService.telemetryInstance.post = async () => {
      const err = new Error("schannel: failed to receive handshake, SSL/TLS connection failed");
      err.isAxiosError = true;
      throw err;
    };

    const result = await rowyService.telemetry("evaluateDerivative");
    assert.strictEqual(result, null, "Should return null on failure");
    assert.strictEqual(unhandledRejections.length, 0, "No unhandled rejections should occur");
  });

  it("handles rowy.events/error rejection gracefully without throwing", async () => {
    rowyService.telemetryInstance.post = async () => {
      const err = new Error("ECONNREFUSED 127.0.0.1:443");
      throw err;
    };

    const result = await rowyService.telemetryError(
      "evaluateDerivative",
      new Error("Evaluation timeout error")
    );
    assert.strictEqual(result, null, "Should return null on failure");
    assert.strictEqual(unhandledRejections.length, 0);
  });

  it("handles rowy.events/runtime-dependency-performance rejection gracefully without throwing", async () => {
    rowyService.telemetryInstance.post = async () => {
      throw new Error("HTTP 503 Service Unavailable");
    };

    const result = await rowyService.telemetryRuntimeDependencyPerformance({
      functionStartTime: Date.now(),
      functionEndTime: Date.now() + 50,
      yarnStartTime: Date.now(),
      yarnFinishTime: Date.now() + 20,
      dependenciesString: "lodash@4.17.21",
    });
    assert.strictEqual(result, null, "Should return null on failure");
    assert.strictEqual(unhandledRejections.length, 0);
  });

  it("does not cause unhandledPromiseRejection on synchronous fire-and-forget telemetry() calls", async () => {
    // When called from middleware (e.g. requireAuth: telemetry(req.path.slice(1))),
    // it is fired asynchronously without await.
    rowyService.telemetryInstance.post = async () => {
      const err = new Error("TLS handshake failure (PR_END_OF_FILE_ERROR)");
      err.isAxiosError = true;
      throw err;
    };

    // Fire without await
    rowyService.telemetry("evaluateDerivative");
    rowyService.telemetry("actionScript");
    rowyService.telemetry("connector");

    // Allow event loop ticks to resolve promises
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.strictEqual(
      unhandledRejections.length,
      0,
      `Expected 0 unhandled rejections, but received: ${JSON.stringify(unhandledRejections)}`
    );
  });

  it("returns response object when rowy.events/monitor is healthy and succeeds", async () => {
    const mockResponse = { status: 200, data: "OK" };
    rowyService.telemetryInstance.post = async () => mockResponse;

    const result = await rowyService.telemetry("evaluateDerivative");
    assert.deepStrictEqual(result, mockResponse);
    assert.strictEqual(unhandledRejections.length, 0);
  });
});
