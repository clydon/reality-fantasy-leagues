import { NextResponse } from "next/server";

// The action schema for the Game Your Show custom GPT (docs/custom-gpt.md): one call, fetch a brief by
// its code. Import it in the GPT editor from https://www.gameyourshow.com/api/briefs/openapi.json.
export function GET(req: Request) {
  const origin = new URL(req.url).origin;
  return NextResponse.json({
    openapi: "3.1.0",
    info: { title: "Game Your Show briefs", version: "1.0.0", description: "Fetches the instructions for one Game Your Show task." },
    servers: [{ url: origin }],
    paths: {
      "/api/briefs/{code}": {
        get: {
          operationId: "getBrief",
          summary: "Get the instructions for a task the user started in Game Your Show",
          parameters: [{ name: "code", in: "path", required: true, schema: { type: "string" }, description: "The brief code from the user's message" }],
          responses: {
            "200": {
              description: "The task's full instructions",
              content: { "application/json": { schema: { type: "object", properties: { instructions: { type: "string" } } } } },
            },
            "404": { description: "Expired or unknown code" },
          },
        },
      },
    },
  });
}
