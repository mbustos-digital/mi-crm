const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby_23_qeSIefcroRVovHosH68fccOWudjyhEEMQ9urQEwyDDY4OqyKHM19OK9fwlNUJiQ/exec'

// Extrae el mensaje útil de una respuesta HTML de error de Google Apps Script.
// Las páginas de error típicas traen el mensaje real dentro de <pre>, <div id="error"> o
// después de frases como "TypeError:", "ReferenceError:", "Exception:" o "Script function not found:".
function extractErrorFromHtml(html) {
  if (!html || typeof html !== 'string') return 'respuesta vacía'

  // 1) Buscar mensaje dentro de <pre>…</pre> (Apps Script lo usa para stack traces)
  const preMatch = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i)
  if (preMatch && preMatch[1]) {
    const inner = preMatch[1].replace(/<[^>]*>/g, '').trim()
    if (inner) return inner.slice(0, 800)
  }

  // 2) Buscar patrones de error conocidos en el texto plano
  const plain = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const errorPatterns = [
    /(?:TypeError|ReferenceError|SyntaxError|RangeError|Exception|Error):[^.]{10,500}/i,
    /Script function not found:[^.]{1,300}/i,
    /Authorization is required[^.]{1,300}/i,
    /Service invoked too many times[^.]{1,300}/i,
    /(?:No se pudo abrir el archivo|No se encontr\u00f3 la p\u00e1gina|file not found|archivo no encontrado)[^.]{0,300}/i,
  ]
  for (const rx of errorPatterns) {
    const m = plain.match(rx)
    if (m) return m[0].trim().slice(0, 800)
  }

  // 3) Fallback: devolver snippet del texto plano
  return plain.slice(0, 500) || 'respuesta no-JSON sin mensaje identificable'
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')

  try {
    if (req.method === 'POST') {
      // POST: reenviar el body completo como JSON a Apps Script.
      // Code.v2.gs parsea e.postData.contents directamente, sin decodeURIComponent.
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        redirect: 'follow',
      })
      const text = await response.text()
      try {
        const data = JSON.parse(text)
        return res.status(200).json(data)
      } catch {
        const detail = extractErrorFromHtml(text)
        console.error('[proxy POST] Apps Script non-JSON response:', {
          status: response.status,
          url: response.url,
          bodySnippet: text.slice(0, 1500),
        })
        return res.status(500).json({
          error: `Apps Script devolvió HTML en vez de JSON: ${detail}`,
          httpStatus: response.status,
          finalUrl: response.url,
        })
      }
    }

    // GET: pasar los query params tal cual.
    // Code.v2.gs ya NO usa decodeURIComponent, así que codificación simple basta.
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined && v !== null) params.append(k, v)
    }
    const url = `${APPS_SCRIPT_URL}?${params.toString()}`

    const response = await fetch(url, { redirect: 'follow' })
    const text = await response.text()

    try {
      const data = JSON.parse(text)
      res.status(200).json(data)
    } catch {
      const detail = extractErrorFromHtml(text)
      console.error('[proxy GET] Apps Script non-JSON response:', {
        status: response.status,
        url: response.url,
        bodySnippet: text.slice(0, 1500),
      })
      res.status(500).json({
        error: `Apps Script devolvió HTML en vez de JSON: ${detail}`,
        httpStatus: response.status,
        finalUrl: response.url,
      })
    }
  } catch (err) {
    res.status(500).json({ error: 'Error al conectar con Google Sheets: ' + err.message })
  }
}
