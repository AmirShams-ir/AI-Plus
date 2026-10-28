import { afterEach, expect, test } from "bun:test";
import { getExternalModels } from "@/lib/models";

const originalProviders = process.env.CF_AI_GATEWAY_PROVIDERS;

afterEach(() => {
  if (originalProviders === undefined) {
    delete process.env.CF_AI_GATEWAY_PROVIDERS;
  } else {
    process.env.CF_AI_GATEWAY_PROVIDERS = originalProviders;
  }
});

test("enables External Models for providers listed at runtime", () => {
  process.env.CF_AI_GATEWAY_PROVIDERS = " google ,";
  expect(getExternalModels().map((model) => model.provider)).toEqual(["google"]);
});

test("omits External Models whose provider is not listed", () => {
  process.env.CF_AI_GATEWAY_PROVIDERS = "";
  expect(getExternalModels()).toEqual([]);
});
