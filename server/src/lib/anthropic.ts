import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;

export const aiEnabled = Boolean(apiKey);

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

export const AI_MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5";
