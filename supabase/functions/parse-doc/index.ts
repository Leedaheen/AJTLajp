/**
 * Supabase Edge Function — 사용계획서 파싱
 * 업로드된 이미지를 Claude Vision API로 분석하여 반입 신청 폼 데이터를 반환합니다.
 *
 * 배포: supabase functions deploy parse-doc
 * 시크릿: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
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
  예: "[16M] : 2대" → [{"spec":"16M","qty":2}], "14m - 8대" → [{"spec":"14M","qty":8}],
      "7.79M" → [{"spec":"8M","qty":해당수량}]
- location: 사용 장소 전체 (예: "P5,P6-복합동 1층 H~K/43~61")
- floor: 층 정보만 (예: "1층", "7층") — location에서 추출
- work_content: 작업 내용 (예: "인입고압, LV 트레이 작업")
- start_date: 요청기간 시작일 → YYYY-MM-DD 형식
  예: "'26.6.10" → "2026-06-10", "26/06/23" → "2026-06-23", "2026.05.20" → "2026-05-20"
- end_date: 요청기간 종료일 → YYYY-MM-DD 형식
- site_code: 문서에서 P4 언급 있으면 "P4", P5 언급 있으면 "P5", 둘 다면 "P4", 없으면 null

추출 불가 필드는 null로 설정하세요.

예시 응답 (이 형식 그대로):
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
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  if (!ANTHROPIC_API_KEY) {
    return json({ error: "ANTHROPIC_API_KEY 시크릿이 설정되지 않았습니다." }, 503);
  }

  // FormData에서 파일 추출
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "multipart/form-data 파싱 실패" }, 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return json({ error: "file 필드가 없습니다." }, 400);
  }

  const MAX_BYTES = 10 * 1024 * 1024; // 10MB
  if (file.size > MAX_BYTES) {
    return json({ error: "파일 크기가 10MB를 초과합니다." }, 400);
  }

  const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "application/pdf"];
  if (!ALLOWED.includes(file.type)) {
    return json({ error: `지원하지 않는 파일 형식: ${file.type}` }, 400);
  }

  // PDF는 현재 미지원 (Edge Function 환경에서 변환 불가) — 안내 메시지 반환
  if (file.type === "application/pdf") {
    return json({ error: "PDF는 지원하지 않습니다. JPG/PNG로 변환 후 업로드해주세요." }, 400);
  }

  // base64 인코딩
  const buffer = await file.arrayBuffer();
  const bytes  = new Uint8Array(buffer);
  const b64    = btoa(String.fromCharCode(...bytes));
  const mediaType = (file.type || "image/jpeg") as
    "image/jpeg" | "image/png" | "image/gif" | "image/webp";

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
              source: { type: "base64", media_type: mediaType, data: b64 },
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
    return json({ error: `Claude API 오류 (${claudeResp.status}): ${errBody}` }, 502);
  }

  const claudeJson = await claudeResp.json();
  const rawText: string = claudeJson?.content?.[0]?.text?.trim() ?? "";

  // JSON 블록 추출
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
