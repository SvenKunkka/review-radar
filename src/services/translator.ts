import axios from 'axios'

// Returns true if >15% of chars are Chinese
export function isChinese(text: string): boolean {
  const chinese = (text.match(/[一-鿿㐀-䶿豈-﫿]/g) ?? []).length
  return chinese > text.length * 0.15
}

// Use Ollama to generate a search-optimized query in the target language.
// This is intentionally NOT a literal translation — the LLM understands brand
// localization (Razer→雷蛇, Logitech→罗技) and produces the terms real users
// on those platforms actually type.
export async function adaptQueryForSearch(
  query: string,
  targetLang: 'zh' | 'en',
  ollamaBaseUrl: string,
  ollamaModel: string
): Promise<string> {
  const prompt = targetLang === 'zh'
    ? `You are a product search expert for Chinese platforms (Bilibili, Zhihu, Tieba, NGA).
Convert this product name to the Chinese search terms that Chinese gamers actually use.

Rules:
- Use official Chinese brand names: Logitech→罗技, Razer→雷蛇, Corsair→海盗船, HyperX→极度未知, SteelSeries→赛睿, Alienware→外星人, ASUS ROG→华硕ROG, MSI→微星, Kingston→金士顿, Valve→V社, Steam→Steam
- Keep model numbers exactly (e.g. "G502 X" stays "G502 X", "V4 Pro" stays "V4 Pro")
- Use Chinese gaming terms: mouse→鼠标, keyboard→键盘, headset→耳机, gamepad/controller→手柄, monitor→显示器, mousepad→鼠标垫, mechanical keyboard→机械键盘
- Output ONLY the Chinese search query, no explanation, no quotes, no punctuation at end

Product: ${query}
Chinese search query:`
    : `You are a product search expert for international platforms (Reddit, YouTube, Trustpilot).
Convert this Chinese product name to the English search terms that international users actually use.

Rules:
- Use official English brand names: 罗技→Logitech, 雷蛇→Razer, 海盗船→Corsair, 赛睿→SteelSeries, 华硕→ASUS, 微星→MSI, V社→Valve
- Keep model numbers exactly as-is
- Use English gaming terms: 鼠标→mouse, 键盘→keyboard, 耳机→headset, 手柄→gamepad or controller, 显示器→monitor
- Output ONLY the English search query, no explanation, no quotes, no punctuation at end

Product: ${query}
English search query:`

  try {
    const resp = await axios.post(
      `${ollamaBaseUrl.replace(/\/$/, '')}/api/chat`,
      {
        model: ollamaModel,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        options: { num_predict: 60, temperature: 0.1 }
      },
      { timeout: 20000 }
    )
    const result: string = (resp.data?.message?.content ?? '').trim()
      .replace(/^["'「『]|["'」』]$/g, '')  // strip surrounding quotes the model sometimes adds
      .trim()
    if (result && result.length > 0 && result.length < 200) {
      return result
    }
  } catch (err: any) {
    console.warn('[Translator] Ollama query adaptation failed:', err.message)
  }
  return query // fallback: use original query unchanged
}
