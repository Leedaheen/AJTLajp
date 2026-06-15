/**
 * Supabase Edge Function — 사용계획서 파싱
 * 프론트엔드에서 base64로 변환한 이미지를 JSON으로 수신하여
 * Claude Vision API로 분석 후 폼 데이터를 반환합니다.
 */

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info",
};

const PARSE_PROMPT = `이 이미지는 건설 현장의 "Table Lift 사용계획서" 문서입니다.
다음 필드를 추출해서 반드시 JSON 형식으로만 답하세요. 설명 없이 JSON만 출력하세요.

추출 항목:
- company: 협력사명 (예: "㈜신보", "세보엠이씨" 등, 주식회사 기호 포함)
- specs: 장비 제원 및 수량 배열. 각 항목은 {"spec": "16M", "qty": 2} 형태.
  제원은 6M/8M/10M/12M/14M/16M/16M굴절/18M/20M굴절 중 가장 가까운 값으로 정규화하세요.
  예: "[16M] : 2대" → [{"spec":"16M","qty":2}], "14m - 8대" → [{"spec":"14M","qty":8}]
- location: 사용 장소 전체 (예: "P5,P6-복합동 1층 H~K/43~61")
- floor: 층 정보만 (예: "1층", "7층")
- work_content: 작업 내용 (예: "인입고압, LV 트레이 작업")
- start_date: 요청기간 시작일 → YYYY-MM-DD 형식 (예: "'26.6.10" → "2026-06-10")
- end_date: 요청기간 종료일 → YYYY-MM-DD 형식
- site_code: P4 언급 있으면 "P4", P5 언급 있으면 "P5", 둘 다면 "P4", 없으면 null

추출 불가 필드는 null로 설정하세요.

예시 응답:
{
  "company": "㈜신보",
  "specs": [{"spec": "16M", "qty": 2}],
  "location": "P5,P6-복합동 1층 H~K/43~61",
  "floor": "1층",
  "work_content": "인입고압, LV 트레이 작업",
  "start_date": "2026-06-10",
  "end_date": "2026-12-30",
  "site_code": "P5"
}`;

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY 시크릿이 설정되지 않았습니다." }, 503);
  }

  // JSON body: { image: "<base64>", mediaType: "image/jpeg" }
  let body: { image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "JSON 파싱 실패" }, 400);
  }

  const { image, mediaType = "image/jpeg" } = body;
  if (!image) {
    return json({ error: "image 필드가 없습니다." }, 400);
  }

  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  const safeType = ALLOWED_TYPES.includes(mediaType) ? mediaType : "image/jpeg";

  // Claude Vision API 호출
  let claudeResp: Response;
  try {
    claudeResp = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key":         ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type":      "application/json",
      },
      body: JSON.stringify({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 1024,
        messages: [{
          role: "user",
          content: [
            {
              type:   "image",
              source: { type: "base64", media_type: safeType, data: image },
            },
            { type: "text", text: PARSE_PROMPT },
          ],
        }],
      }),
    });
  } catch (e) {
    return json({ error: `Claude API 연결 실패: ${(e as Error).message}` }, 502);
  }

  if (!claudeResp.ok) {
    const errBody = await claudeResp.text();
    // 크레딧 부족 등 사용자 친화적 메시지로 변환
    if (claudeResp.status === 400 && errBody.includes("credit_balance")) {
      return json({ error: "AI 인식 서비스 크레딧이 소진되었습니다. 관리자에게 문의해주세요." }, 503);
    }
    if (claudeResp.status === 529 || claudeResp.status === 503) {
      return json({ error: "AI 서비스가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요." }, 503);
    }
    return json({ error: `문서 인식 서비스 오류 (${claudeResp.status}). 잠시 후 다시 시도해주세요.` }, 502);
  }

  const claudeJson = await claudeResp.json();
  const rawText: string = claudeJson?.content?.[0]?.text?.trim() ?? "";

  let jsonStr = rawText;
  const blockMatch = rawText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (blockMatch) {
    jsonStr = blockMatch[1];
  } else {
    const start = rawText.indexOf("{");
    const end   = rawText.lastIndexOf("}") + 1;
    if (start >= 0 && end > start) jsonStr = rawText.slice(start, end);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return json({ error: "문서를 인식하지 못했습니다. 선명한 이미지로 다시 시도해주세요." }, 422);
  }

  return json({ success: true, data: parsed });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}
