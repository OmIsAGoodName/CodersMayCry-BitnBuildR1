import { Router, type Request, type Response } from "express";
import { z } from "zod";

const parseRequestSchema = z.object({
  message: z.string().min(1).max(20000),
  businessContext: z
    .object({
      businessType: z.string().optional(),
      operatorName: z.string().optional(),
    })
    .optional(),
});

const parseResponseSchema = z.object({
  customer: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().int().min(1).default(1),
        attributes: z.record(z.string(), z.string()).default({}),
      }),
    )
    .min(1),
  due_date: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  amount: z.number().nullable().optional(),
  paidAmount: z.number().min(0).default(0),
  status: z
    .enum(["new", "in_progress", "ready", "completed", "cancelled"])
    .default("new"),
  references_prior_order: z.boolean().default(false),
  referencesPriorOrder: z.boolean().default(false),
  confidence: z.number().min(0).max(1).default(0.8),
  needs_clarification: z.boolean().default(false),
  needsClarification: z.boolean().default(false),
  rawMessage: z.string().optional(),
});

const router = Router();

router.post("/inbox/parse", async (req: Request, res: Response) => {
  try {
    const parsedBody = parseRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        error: "Invalid request body",
        details: parsedBody.error.flatten(),
      });
    }

    const { message, businessContext } = parsedBody.data;
    const apiKey = process.env.OPENAI_API_KEY;

    if (apiKey) {
      try {
        const openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [
              {
                role: "system",
                content:
                  `You are a meticulous order parser for an offline-first single-operator business. Extract structured order data from Hinglish/Devanagari messages conforming strictly to schema.json:
{
  "customer": string | null,
  "items": [{ "description": string, "quantity": integer, "attributes": {} }],
  "due_date": "YYYY-MM-DD" | null,
  "amount": number | null,
  "references_prior_order": boolean,
  "confidence": float 0-1,
  "needs_clarification": boolean
}
Business context: ${JSON.stringify(businessContext ?? {})}`,
              },
              {
                role: "user",
                content: `Parse this customer message into the exact structured schema:\n${message}`,
              },
            ],
          }),
        });

        if (openAiResponse.ok) {
          const result = (await openAiResponse.json()) as {
            choices?: Array<{ message?: { content?: string } }>;
          };
          const contentText = result.choices?.[0]?.message?.content ?? "{}";
          const jsonCandidate = JSON.parse(contentText);
          const parsed = parseResponseSchema.parse({
            ...jsonCandidate,
            rawMessage: message,
            dueDate: jsonCandidate.due_date || jsonCandidate.dueDate,
            referencesPriorOrder: jsonCandidate.references_prior_order ?? jsonCandidate.referencesPriorOrder,
            needsClarification: jsonCandidate.needs_clarification ?? jsonCandidate.needsClarification,
          });
          return res.json(parsed);
        }
      } catch (err) {
        console.warn("OpenAI API call failed, falling back:", err);
      }
    }

    // Fallback response for offline API operation
    return res.status(503).json({
      error: "Online LLM unavailable, using client-side deterministic engine",
      fallback: true,
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to parse message",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
