/** Accept only a JSON object, optionally enclosed in known model/fence framing. */
export function parseReportJson(raw: string): unknown {
  let text = raw.trim().replace(/^\uFEFF/, '').trim();
  text = text.replace(/^(?:<bos>)?\s*<start_of_turn>model\s*/, '');
  text = text.replace(/(?:(?:<end_of_turn>|<eos>|<\/s>|<\|im_end\|>)\s*)+$/, '').trim();
  const fence = /^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i.exec(text);
  if (fence) text = fence[1].trim();
  try {
    if (!text.startsWith('{') || !text.endsWith('}') || text.length > 20_000) throw new Error();
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error('The local model returned an invalid report format. Tap Send to retry. Your transcript is saved.');
  }
}
