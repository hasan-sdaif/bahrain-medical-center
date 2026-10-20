/**
 * AI assistant (backend-only via z-ai-web-dev-sdk) — administrative info
 * helper for the public site & staff. Never medical advice, no PHI in prompts.
 */
import { db } from "@/lib/db";
import { problem, jo } from "@/lib/api";
import type { RouteTable } from "./router";
import { json } from "./router";

const SYSTEM_AR = `أنت "مساعد المركز الطبي" في مركز طبي بمنامة البحرين. دورك إداري معلوماتي فقط:
- تجيب عن: مواعيد، تحضير الفحوصات (صيام/مثانة ممتلئة)، الباقات والأسعار، المواعيد بالباركود، تأمين بسمة/الخليج، السحب المنزلي بجميع المحافظات.
- تمتنع تماماً عن: التشخيص، النصائح العلاجية، قراءة نتائج، أو استقبال أي بيانات طبية أو هوية.
- للطوارئ: 999. للاستشارة: احجز موعداً.
أجب بإيجاز ودبلوماسية. إن كان السؤال طبياً فاعتذر بلطف وحوّل للحجز.`;

const SYSTEM_EN = `You are the "Medical Center Assistant" at a clinic in Manama, Bahrain. Administrative scope only:
- Answer: booking, test prep (fasting/full bladder), packages & pricing, barcode check-in, Basma/Gulf insurance, home draw coverage across all governorates.
- Never diagnose, give treatment advice, interpret results, or accept medical/identity data.
- Emergencies: 999. Consultations: book an appointment.
Be concise and courteous. If a question is medical, politely redirect to booking.`;

const routes: RouteTable = {
  "POST chat": async (req) => {
    const b = jo(await req.json()) as { message?: string; lang?: string; staff?: boolean };
    const message = (b.message ?? "").slice(0, 600);
    if (!message.trim()) return problem("VALIDATION");
    let answer = "";
    try {
      const { default: ZAI } = await import("z-ai-web-dev-sdk");
      const zai = await ZAI.create();
      const completion = await zai.chat.completions.create({
        messages: [
          { role: "assistant", content: b.lang === "en" ? SYSTEM_EN : SYSTEM_AR },
          { role: "user", content: message },
        ],
        thinking: { type: "disabled" },
      });
      answer = completion.choices[0]?.message?.content ?? "";
    } catch (e) {
      answer = b.lang === "en"
        ? "The smart assistant is momentarily unavailable. Call +973 1750 0000 or use the FAQ. Emergencies: 999."
        : "المساعد الذكي غير متاح لحظياً. اتصل +973 1750 0000 أو راجع الأسئلة الشائعة. للطوارئ 999.";
      console.error("[ai]", (e as Error).message);
    }
    await db.aiConversation.create({ data: { messages: [{ role: "user", text: message }, { role: "ai", text: answer.slice(0, 2000) }] } as never });
    return json({ answer });
  },
};
export default routes;
